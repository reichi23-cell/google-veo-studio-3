/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BeatAnalysisResult {
  bpm: number;
  peaks: { time: number; energy: number }[];
  energyGraph: number[];
}

/**
 * 音声ファイルURLから実際の振幅波形データを抽出します。
 */
export async function getWaveformData(audioUrl: string, samples: number = 200): Promise<number[]> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // チャンネルデータを取得（モノラルに簡素化）
    const rawData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    const result = [];
    
    for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[blockSize * i + j]);
        }
        result.push(sum / blockSize);
    }
    
    // 正規化
    const max = Math.max(...result);
    return result.map(v => v / max);
  } catch (e) {
    console.error("Failed to extract waveform:", e);
    return Array.from({ length: samples }, () => 0.5); // Fallback
  }
}

export function analyzeAudioBeats(audioUrl: string): BeatAnalysisResult {
  // スタブとしてデフォルト値を返す（白画面解消を優先）
  console.log("Stubb analyzeAudioBeats called for:", audioUrl);
  return { 
    bpm: 120, 
    peaks: [], 
    energyGraph: Array.from({ length: 100 }, () => Math.random()) 
  };
}

export function generateWaveformImage(energyGraph: number[]): string {
  const canvas = document.createElement('canvas');
  canvas.width = energyGraph.length * 2;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#10b981';
    energyGraph.forEach((energy, i) => {
      const h = energy * 30;
      ctx.fillRect(i * 2, 20 - h / 2, 1, h);
    });
  }
  return canvas.toDataURL();
}
