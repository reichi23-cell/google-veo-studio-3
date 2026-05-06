import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isLoaded = false;

/**
 * ffmpeg.wasm を遅延ロードする（初回のみCDNからフェッチ）
 */
async function getFFmpeg(onProgress?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  ffmpegInstance = ffmpeg;

  ffmpeg.on('log', ({ message }) => {
    console.log('[ffmpeg]', message);
  });

  onProgress?.('ffmpeg をロード中...');

  // Electronでは CDN から WASM をロード（SharedArrayBuffer が必要な場合は electron-main 側で許可が必要）
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  isLoaded = true;
  onProgress?.('ffmpeg ロード完了');
  return ffmpeg;
}

export interface FfmpegExportClip {
  url: string;        // Object URL or local file URL
  path?: string;      // local file path (Electron)
  startTime: number;  // position on timeline (sec)
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
  type: 'video' | 'audio' | 'image';
}

export interface FfmpegExportOptions {
  clips: FfmpegExportClip[];
  /** 全体の長さ (sec) */
  duration: number;
  /** 出力アスペクト比 */
  aspectRatio: '16:9' | '9:16';
  onProgress?: (percent: number, message: string) => void;
  abortSignal?: AbortSignal;
}

/**
 * ffmpeg.wasm を使って映像クリップを連結・BGMをミックスして MP4 を返す。
 *
 * 映像は -c copy（再エンコードなし）で連結するため高速。
 * BGMや音量調整がある場合のみ音声を再エンコードする。
 */
export async function ffmpegExport(options: FfmpegExportOptions): Promise<Blob> {
  const { clips, duration, aspectRatio, onProgress, abortSignal } = options;

  const ffmpeg = await getFFmpeg((msg) => onProgress?.(0, msg));

  const videoClips = clips.filter(c => c.type === 'video' || c.type === 'image').sort((a, b) => a.startTime - b.startTime);
  const audioClips = clips.filter(c => c.type === 'audio').sort((a, b) => a.startTime - b.startTime);
  const hasExplicitAudio = audioClips.length > 0;

  if (videoClips.length === 0) {
    throw new Error('書き出す映像クリップがありません');
  }

  onProgress?.(5, 'クリップを読み込み中...');

  // --- 1. 各クリップをメモリに書き込む ---
  const inputFiles: string[] = [];

  for (let i = 0; i < videoClips.length; i++) {
    if (abortSignal?.aborted) throw new Error('Export cancelled');
    const clip = videoClips[i];
    const fname = `v${i}.mp4`;
    try {
      const data = await fetchFile(clip.url);
      await ffmpeg.writeFile(fname, data);
      inputFiles.push(fname);
    } catch (e) {
      console.warn(`クリップ ${i} の読み込みに失敗:`, e);
    }
    onProgress?.(5 + (i / videoClips.length) * 30, `映像 ${i + 1}/${videoClips.length} 読み込み中`);
  }

  if (abortSignal?.aborted) throw new Error('Export cancelled');

  // --- 2. 映像クリップを連結 ---
  // concat demuxer 用のリストファイルを作成
  // trimStart/trimEnd を考慮してカット点を指定する
  onProgress?.(35, '映像クリップを連結中...');

  if (inputFiles.length === 1) {
    // 1本だけの場合はコピーするだけ
    const clip = videoClips[0];
    const trimDur = (clip.trimEnd - clip.trimStart) / (clip.speed || 1);
    await ffmpeg.exec([
      '-ss', String(clip.trimStart),
      '-t', String(trimDur),
      '-i', inputFiles[0],
      '-c', 'copy',
      'video_merged.mp4'
    ]);
  } else {
    // 複数クリップ: 各クリップをトリムして一時ファイルを作り、後で concat
    const trimmedFiles: string[] = [];
    for (let i = 0; i < videoClips.length; i++) {
      if (abortSignal?.aborted) throw new Error('Export cancelled');
      const clip = videoClips[i];
      const trimDur = (clip.trimEnd - clip.trimStart) / (clip.speed || 1);
      const out = `vt${i}.mp4`;

      const args = [
        '-ss', String(clip.trimStart),
        '-t', String(trimDur),
        '-i', inputFiles[i],
        '-c', 'copy',
        out
      ];
      // Speed 調整（再エンコード必要）
      if (clip.speed && clip.speed !== 1) {
        // setpts と atempo でスピード変更
        args.splice(args.indexOf('-c'), 2); // -c copy を除去
        args.push(
          '-vf', `setpts=${1 / clip.speed}*PTS`,
          '-af', `atempo=${clip.speed}`,
          out
        );
      }
      await ffmpeg.exec(args);
      trimmedFiles.push(out);
      onProgress?.(35 + (i / videoClips.length) * 25, `トリム ${i + 1}/${videoClips.length}`);
    }

    // concat list
    const concatList = trimmedFiles.map(f => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatList));

    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat.txt',
      '-c', 'copy',
      'video_merged.mp4'
    ]);

    // 一時ファイル削除
    for (const f of trimmedFiles) {
      try { await ffmpeg.deleteFile(f); } catch (_) {}
    }
  }

  onProgress?.(60, '音声を処理中...');

  if (abortSignal?.aborted) throw new Error('Export cancelled');

  let outputFile = 'video_merged.mp4';

  // --- 3. BGM がある場合は音声ミックス ---
  if (hasExplicitAudio) {
    const audioInputArgs: string[] = [];
    const filterParts: string[] = [];
    let mixInputs = '[0:a]';

    for (let i = 0; i < audioClips.length; i++) {
      const clip = audioClips[i];
      const fname = `a${i}.mp4`;
      const data = await fetchFile(clip.url);
      await ffmpeg.writeFile(fname, data);
      audioInputArgs.push('-i', fname);
      const delay = Math.round(clip.startTime * 1000);
      const vol = clip.volume ?? 1;
      const clipDur = (clip.trimEnd - clip.trimStart) / (clip.speed || 1);
      filterParts.push(
        `[${i + 1}:a]atrim=start=${clip.trimStart}:duration=${clipDur},asetpts=PTS-STARTPTS,volume=${vol},adelay=${delay}|${delay}[a${i}]`
      );
      mixInputs += `[a${i}]`;
    }

    const filterStr = filterParts.join(';') + ';' + mixInputs + `amix=inputs=${audioClips.length + 1}:duration=longest[aout]`;

    await ffmpeg.exec([
      '-i', 'video_merged.mp4',
      ...audioInputArgs,
      '-filter_complex', filterStr,
      '-map', '0:v',
      '-map', '[aout]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', String(duration),
      'output.mp4'
    ]);
    outputFile = 'output.mp4';

    for (let i = 0; i < audioClips.length; i++) {
      try { await ffmpeg.deleteFile(`a${i}.mp4`); } catch (_) {}
    }
  } else {
    // BGMなし: そのままコピー + 長さをトリム
    await ffmpeg.exec([
      '-i', 'video_merged.mp4',
      '-t', String(duration),
      '-c', 'copy',
      'output.mp4'
    ]);
    outputFile = 'output.mp4';
  }

  onProgress?.(90, 'ファイルを生成中...');

  if (abortSignal?.aborted) throw new Error('Export cancelled');

  // --- 4. 結果を取得 ---
  const data = await ffmpeg.readFile(outputFile) as Uint8Array;
  const blob = new Blob([data.buffer], { type: 'video/mp4' });

  // クリーンアップ
  for (const f of inputFiles) { try { await ffmpeg.deleteFile(f); } catch (_) {} }
  try { await ffmpeg.deleteFile('video_merged.mp4'); } catch (_) {}
  try { await ffmpeg.deleteFile('output.mp4'); } catch (_) {}
  try { await ffmpeg.deleteFile('concat.txt'); } catch (_) {}

  onProgress?.(100, '完了');
  return blob;
}
