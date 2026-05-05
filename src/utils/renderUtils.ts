import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export async function renderTimelineToVideo(
  clips: any[],
  width: number,
  height: number,
  fps: number = 30,
  onProgress: (progress: number) => void,
  canvas: HTMLCanvasElement,
  drawFrame: (time: number) => void // New callback to trigger frame drawing
): Promise<Blob> {
  const duration = Math.max(...clips.map(c => c.startTime + (c.trimEnd - c.trimStart)), 0);
  const totalFrames = Math.max(Math.floor(duration * fps), 1);
  
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height,
    },
    fastStart: 'in-memory'
  });

  // Initialize video encoder
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error(e)
  });

  await videoEncoder.configure({
    codec: 'avc1.424028',
    width,
    height,
    bitrate: 4e6
  });

  for (let i = 0; i < totalFrames; i++) {
    const time = i / fps;
    
    // Call the draw callback to update the canvas to the specific frame
    drawFrame(time);
    
    const frame = new VideoFrame(canvas, { timestamp: i * (1000000 / fps) });
    videoEncoder.encode(frame);
    frame.close();
    
    onProgress((i / totalFrames) * 100);
  }

  await videoEncoder.flush();
  muxer.finalize();
  
  const { buffer } = muxer.target as ArrayBufferTarget;
  return new Blob([buffer], { type: 'video/mp4' });
}
