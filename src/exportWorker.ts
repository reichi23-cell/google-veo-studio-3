/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple placeholder for export worker
// In a real app, this would use mp4-muxer and VideoEncoder
self.onmessage = async (e: MessageEvent) => {
  const { type, duration, fps } = e.data;
  if (type === 'START_EXPORT') {
    const totalFrames = duration * fps;
    for (let i = 0; i < totalFrames; i++) {
      if (i % 10 === 0) {
        self.postMessage({ type: 'PROGRESS', progress: (i / totalFrames) * 100 });
      }
      // Request frame from main thread
      self.postMessage({ type: 'REQUEST_FRAME', time: i / fps, frameIndex: i });
      // Wait for frame (simplified)
      await new Promise(r => setTimeout(r, 50));
    }
    self.postMessage({ type: 'PROGRESS', progress: 100 });
    self.postMessage({ type: 'EXPORT_COMPLETE', buffer: new ArrayBuffer(0) });
  }
};
