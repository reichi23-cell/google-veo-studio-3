import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Play, Pause, SkipBack, Volume2, VolumeX, RotateCcw, Activity, Zap } from 'lucide-react';
import { formatTime } from '../../utils/timeUtils';
import { VideoClip } from '../../types';

interface PreviewSectionProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  aspectRatio: '16:9' | '9:16';
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  masterVolume: number;
  duration: number;
  setIsPlaying: (playing: boolean) => void;
  togglePlayback: () => void;
  setCurrentTime: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  clips: VideoClip[];
  selectedClipIds: string[];
  updateClipProp: (id: string, prop: string, val: any) => void;
}

export const PreviewSection: React.FC<PreviewSectionProps> = ({
  canvasRef,
  aspectRatio,
  currentTime,
  isPlaying,
  playbackRate,
  masterVolume,
  duration,
  setIsPlaying,
  togglePlayback,
  setCurrentTime,
  setPlaybackRate,
  clips,
  selectedClipIds,
  updateClipProp
}) => {
  const [levels, setLevels] = useState({ master: 0, clips: 0, bgm: 0 });
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef<{ startX: number, startY: number, originalX: number, originalY: number } | null>(null);

  // Sync canvas resolution with display size
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        
        canvasRef.current.width = width * dpr;
        canvasRef.current.height = height * dpr;
        canvasRef.current.style.width = `${width}px`;
        canvasRef.current.style.height = `${height}px`;
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [canvasRef]);

  const { activeStatus, isDoubleSpeed } = useMemo(() => {
    const activeClips = clips.filter(c => currentTime >= c.startTime && currentTime <= (c.startTime + (c.trimEnd - c.trimStart) / c.speed));
    const isClipsActive = activeClips.some(c => c.track < 6);
    const isBgmActive = activeClips.some(c => c.track === 6);
    const isDoubleSpeed = activeClips.some(c => c.speed === 2);
    return { 
      activeStatus: { isClipsActive, isBgmActive }, 
      isDoubleSpeed 
    };
  }, [clips, currentTime]);

  useEffect(() => {
    const updateMeter = () => {
      if (isPlaying) {
        const base = masterVolume * 100;
        const newClips = activeStatus.isClipsActive ? (Math.random() * base * 0.7 + base * 0.3) : 0;
        const newBgm = activeStatus.isBgmActive ? (Math.random() * base * 0.7 + base * 0.3) : 0;
        setLevels({ master: Math.max(newClips, newBgm), clips: newClips, bgm: newBgm });
      } else {
        setLevels(prev => ({ master: Math.max(0, prev.master - 5), clips: Math.max(0, prev.clips - 5), bgm: Math.max(0, prev.bgm - 5) }));
      }
      rafRef.current = requestAnimationFrame(updateMeter);
    };
    rafRef.current = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, masterVolume, activeStatus]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (selectedClipIds.length === 0) return;
    const clip = clips.find(c => c.id === selectedClipIds[0]);
    if (!clip) return;

    setIsDragging(true);
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      originalX: clip.x || 0,
      originalY: clip.y || 0
    };

    const onMouseMove = (moveE: MouseEvent) => {
      if (!dragInfo.current) return;
      const dx = moveE.clientX - dragInfo.current.startX;
      const dy = moveE.clientY - dragInfo.current.startY;
      
      // Update x and y
      updateClipProp(selectedClipIds[0], 'x', dragInfo.current.originalX + dx);
      updateClipProp(selectedClipIds[0], 'y', dragInfo.current.originalY + dy);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      dragInfo.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const MeterBar = ({ label, value, colorClass }: { label: string, value: number, colorClass: string }) => (
    <div className="flex flex-col gap-1 flex-1">
      <div className="flex justify-between items-center px-1">
        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-tighter">{label}</span>
        <span className="text-[7px] font-mono text-zinc-600">{Math.round(value)}%</span>
      </div>
      <div className="h-1 bg-black/60 rounded-full overflow-hidden flex p-[0.5px]">
        <div className={`h-full ${colorClass} transition-all duration-75 rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );

  return (
    <div className="flex-1 bg-[#050505] flex flex-col items-center justify-between p-2 relative min-w-0 overflow-hidden shadow-inner">
      <div className="flex-1 w-full relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div 
            ref={containerRef}
            onMouseDown={handleMouseDown}
            className={`relative group overflow-hidden rounded-xl bg-black shadow-2xl border border-white/5 flex items-center justify-center transition-all ${isDragging ? 'cursor-grabbing border-blue-500/50' : 'cursor-grab'}`} 
            style={{ 
              aspectRatio: aspectRatio === '16:9' ? '16/9' : '9/16', 
              maxWidth: '100%',
              maxHeight: '100%',
              width: '100%',
              height: '100%'
            }}
          >
            <canvas ref={canvasRef} className="w-full h-full object-contain pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col items-center gap-6 mt-4">
        {/* Audio Mixer */}
        <div className="w-full max-w-md bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl">
          <div className="flex items-center gap-2">
            <Activity size={10} className="text-blue-500" />
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">Live Mixer</span>
          </div>
          <div className="flex gap-4">
            <MeterBar label="Master" value={levels.master} colorClass="bg-blue-500" />
            <MeterBar label="Clips" value={levels.clips} colorClass="bg-green-500" />
            <MeterBar label="BGM" value={levels.bgm} colorClass="bg-purple-500" />
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-4 px-6 py-3 bg-[#111]/80 backdrop-blur-2xl rounded-full border border-white/10 shadow-2xl relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-2 z-50">
            {playbackRate === 2 && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white rounded-md text-[9px] font-black animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                <Activity size={10} fill="currentColor" />
                PREVIEW x2
              </div>
            )}
            {isDoubleSpeed && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-400 text-black rounded-md text-[9px] font-black animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.4)]">
                <Zap size={10} fill="currentColor" />
                CLIP x2
              </div>
            )}
          </div>
          
          <button onClick={() => setCurrentTime(0)} className="text-zinc-500 hover:text-white transition-all">
            <SkipBack size={16} />
          </button>
          
          <button 
            onClick={() => {
              if (isPlaying && playbackRate === -1) setIsPlaying(false);
              else { setPlaybackRate(-1); setIsPlaying(true); }
            }} 
            className={`transition-all ${isPlaying && playbackRate === -1 ? 'text-blue-400' : 'text-zinc-500 hover:text-white'}`}
          >
            <RotateCcw size={16} />
          </button>

          <button 
            onClick={togglePlayback} 
            className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl"
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
          </button>

          <div className="w-px h-4 bg-white/10 mx-2" />

          <div className="flex items-baseline gap-1.5 min-w-[100px]">
            <span className="font-mono text-xl tracking-tighter text-blue-400 font-black tabular-nums">
              {formatTime(currentTime).split('.')[0]}
            </span>
            <span className="font-mono text-[10px] text-zinc-600 font-bold">
              / {formatTime(duration).split('.')[0]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
