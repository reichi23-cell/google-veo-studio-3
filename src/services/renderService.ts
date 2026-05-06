import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

async function readAudioArrayBuffer(clip: any): Promise<ArrayBuffer> {
  const fs = (window as any).require?.('fs');
  if (fs && clip.path) {
    try {
      const buffer = fs.readFileSync(clip.path);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (e) {
      console.warn("fs read failed, falling back to fetch", e);
    }
  }
  const res = await fetch(clip.url);
  return res.arrayBuffer();
}

// Export-only renderer: draws directly onto an OffscreenCanvas without touching
// the live preview HTMLCanvasElement, eliminating the double-draw overhead.
export async function renderTimeline(
  clips: any[],
  canvas: HTMLCanvasElement,
  onProgress: (progress: number) => void,
  renderFrame: (time: number, target?: OffscreenCanvas) => Promise<void> | void,
  abortSignal?: AbortSignal
): Promise<Blob> {
  if (!window.VideoEncoder) {
    throw new Error("VideoEncoder (WebCodecs) is not supported in this browser.");
  }

  // Resolve output resolution from canvas aspect ratio, clamped to even numbers
  const targetHeight = 1080;
  const width = Math.floor((targetHeight * (canvas.width / canvas.height)) / 2) * 2;
  const height = targetHeight;

  // Robust duration calculation
  let timelineEnd = 0;
  clips.forEach(c => {
    const dur = (c.trimEnd - c.trimStart) / (c.speed || 1);
    timelineEnd = Math.max(timelineEnd, c.startTime + dur);
  });
  if (timelineEnd <= 0) timelineEnd = 5;

  // Dedicated OffscreenCanvas — renderFrame writes here directly.
  const offscreenCanvas = new OffscreenCanvas(width, height);

  const hasAudioTrack = clips.some(c => c.type === 'audio' || (c.type === 'video' && c.volume > 0));

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    audio: hasAudioTrack ? { codec: 'aac', numberOfChannels: 2, sampleRate: 44100 } : undefined,
    fastStart: 'in-memory'
  });

  let chunksProduced = 0;
  let encoderError: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => { chunksProduced++; muxer.addVideoChunk(chunk, meta); },
    error: (e) => { console.error("VideoEncoder Error:", e); encoderError = e; }
  });

  let config: VideoEncoderConfig = {
    codec: 'avc1.640033',
    width,
    height,
    bitrate: 10_000_000,
    framerate: 30,
    latencyMode: 'quality'
  };

  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) {
    console.warn("High Profile not supported, falling back to Baseline");
    config.codec = 'avc1.42E01F';
  }
  videoEncoder.configure(config);

  let audioEncoder: AudioEncoder | null = null;
  if (hasAudioTrack) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => { console.error("AudioEncoder Error:", e); encoderError = e; }
    });
    audioEncoder.configure({ codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: 44100, bitrate: 128_000 });
  }

  // --- 1. Audio Phase ---
  if (hasAudioTrack && audioEncoder) {
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, Math.max(1, Math.ceil(sampleRate * timelineEnd)), sampleRate);

    for (const clip of clips) {
      if (clip.type === 'audio' || (clip.type === 'video' && clip.volume > 0)) {
        try {
          const arrayBuffer = await readAudioArrayBuffer(clip);
          const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
          const source = offlineCtx.createBufferSource();
          source.buffer = audioBuffer;
          const gain = offlineCtx.createGain();
          gain.gain.value = clip.volume ?? 1;
          source.connect(gain);
          gain.connect(offlineCtx.destination);
          const clipDuration = (clip.trimEnd - clip.trimStart) / (clip.speed || 1);
          source.start(clip.startTime, clip.trimStart, clipDuration);
          source.playbackRate.value = clip.speed ?? 1;
        } catch (err) {
          console.warn(`Failed to process audio for clip ${clip.id}:`, err);
        }
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    const samplesPerChunk = 1024;
    for (let i = 0; i < renderedBuffer.length; i += samplesPerChunk) {
      if (abortSignal?.aborted) throw new Error("Export cancelled");
      if (encoderError) throw encoderError;

      const end = Math.min(i + samplesPerChunk, renderedBuffer.length);
      const size = end - i;
      const chunkData = new Float32Array(size * 2);
      const left = renderedBuffer.getChannelData(0);
      const right = renderedBuffer.getChannelData(1);
      for (let j = 0; j < size; j++) {
        chunkData[j] = left[i + j];
        chunkData[size + j] = right[i + j];
      }
      const audioData = new AudioData({
        format: 'f32-planar', sampleRate: 44100, numberOfFrames: size, numberOfChannels: 2,
        timestamp: (i / 44100) * 1_000_000, data: chunkData
      });
      audioEncoder.encode(audioData);
      audioData.close();
    }
    await audioEncoder.flush();
  }

  // --- 2. Video Phase ---
  const fps = 30;
  const totalFrames = Math.ceil(timelineEnd * fps);

  for (let f = 0; f < totalFrames; f++) {
    if (abortSignal?.aborted) throw new Error("Export cancelled");
    if (encoderError) throw encoderError;

    // Backpressure: allow up to 30 frames in flight before throttling.
    // Higher threshold keeps the GPU encoder saturated without OOM risk.
    while (videoEncoder.encodeQueueSize > 30) {
      await new Promise(r => setTimeout(r, 5));
      if (encoderError) throw encoderError;
    }

    const time = f / fps;

    // Render directly into the OffscreenCanvas — no intermediate copy needed.
    await renderFrame(time, offscreenCanvas);

    const frame = new VideoFrame(offscreenCanvas, {
      timestamp: Math.round(time * 1_000_000),
      duration: Math.round(1_000_000 / fps)
    });
    videoEncoder.encode(frame, { keyFrame: f % 60 === 0 });
    frame.close();

    onProgress((f / totalFrames) * 100);
  }

  // --- 3. Finalize ---
  if (videoEncoder.state !== 'closed') await videoEncoder.flush();

  if (chunksProduced === 0 && totalFrames > 0) {
    throw new Error("No video frames were produced by the encoder. Check your hardware compatibility.");
  }
  if (encoderError) throw encoderError;

  muxer.finalize();
  const { buffer } = muxer.target as ArrayBufferTarget;
  return new Blob([buffer], { type: 'video/mp4' });
}
