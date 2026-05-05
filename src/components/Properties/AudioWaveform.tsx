import React, { useEffect, useRef } from 'react';
import { getWaveformData } from '../../utils/audioUtils';

interface AudioWaveformProps {
  audioUrl: string;
  width: number;
  height: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ audioUrl, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const data = await getWaveformData(audioUrl, Math.floor(width / 2));
      if (!isMounted || !canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#10b981'; // Tailwind emerald-500
      
      const mid = height / 2;
      data.forEach((amp, i) => {
        const h = amp * height;
        ctx.fillRect(i * 2, mid - h / 2, 1, h);
      });
    })();
    return () => { isMounted = false; };
  }, [audioUrl, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="pointer-events-none" />;
};
