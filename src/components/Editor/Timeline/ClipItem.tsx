import React from 'react';
import { Video, Music, ImageIcon, Eye, Link as LinkIcon } from 'lucide-react';
import { VideoClip } from '../../../types';
import { formatTime } from '../../../utils/timeUtils';

interface ClipItemProps {
  clip: VideoClip;
  zoom: number;
  trackTops: number[];
  trackHeight: number;
  expandedClipIds: string[];
  selectedClipIds: string[];
  isSplitMode: boolean;
  audioWaveforms: { [id: string]: string };
  onMouseDown: (e: React.MouseEvent, clip: VideoClip) => void;
  onDoubleClick: (e: React.MouseEvent, clip: VideoClip) => void;
  onContextMenu: (e: React.MouseEvent, clip: VideoClip) => void;
  onTrimStartMouseDown: (e: React.MouseEvent, clip: VideoClip) => void;
  onTrimEndMouseDown: (e: React.MouseEvent, clip: VideoClip) => void;
  onExtractFrame?: (clip: VideoClip) => void; // Added for direct button access
}

export const ClipItem: React.FC<ClipItemProps> = ({
  clip, zoom, trackTops, trackHeight, expandedClipIds, selectedClipIds, isSplitMode, audioWaveforms,
  onMouseDown, onDoubleClick, onContextMenu, onTrimStartMouseDown, onTrimEndMouseDown,
  onExtractFrame
}) => {
  const isExpanded = expandedClipIds.includes(clip.id);
  const isSelected = selectedClipIds.includes(clip.id);
  const duration = (clip.trimEnd - clip.trimStart) / clip.speed;

  return (
    <div 
      onMouseDown={(e) => onMouseDown(e, clip)}
      onDoubleClick={(e) => onDoubleClick(e, clip)}
      onContextMenu={(e) => onContextMenu(e, clip)}
      className={`absolute h-[56px] rounded-xl border transition-all cursor-grab active:cursor-grabbing group
        ${isSelected 
          ? (selectedClipIds.length > 1 
            ? 'border-green-500 bg-green-500/30 ring-1 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)] z-30' 
            : 'border-blue-500 bg-blue-500/30 ring-1 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] z-30')
          : clip.groupId 
            ? 'border-red-500 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
            : (clip.track === 6 
              ? 'border-teal-500/50 bg-teal-900/40 hover:bg-teal-800/40' 
              : 'border-white/10 bg-zinc-800/80 hover:bg-zinc-700/80 backdrop-blur-sm')
        }`}
      style={{ 
        left: (clip.startTime || 0) * zoom, 
        width: Math.max(2, duration * zoom), 
        top: trackTops[clip.track] + 4,
        overflow: 'hidden',
        height: isExpanded ? 120 : trackHeight - 8,
        zIndex: isSelected ? 30 : 10
      }}
    >
      {/* Real Thumbnail Background */}
      { (clip.type === 'video' || clip.type === 'image') && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {clip.type === 'video' && !clip.thumbnail ? (
            <video src={clip.url} className="w-full h-full object-cover opacity-80" preload="metadata" />
          ) : (
            <img src={clip.thumbnail || clip.url} className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
          )}
        </div>
      )}

      {/* Audio Waveform Background */}
      {clip.type === 'audio' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center px-4 opacity-40">
           {audioWaveforms[clip.id] ? (
             <img src={audioWaveforms[clip.id]} className="w-full h-full object-fill" alt="waveform" />
           ) : (
             <div className="w-full h-8 flex items-center gap-px animate-pulse">
                {[30, 60, 45, 80, 50, 90, 40, 70, 55, 85].map((h, idx) => (
                   <div key={idx} className="flex-1 bg-teal-400/50 rounded-full" style={{ height: `${h}%` }} />
                ))}
             </div>
           )}
        </div>
      )}

      <div className="absolute inset-0 bg-black/10 transition-colors hover:bg-black/0" />
      
      {/* Extract Button - Only for video, visible on hover or selection */}
      {clip.type === 'video' && (
        <button 
          onClick={(e) => { e.stopPropagation(); onExtractFrame?.(clip); }}
          className={`absolute top-1 right-1 z-50 p-1.5 rounded-lg bg-blue-600 text-white shadow-lg transition-all 
            ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'}`}
          title="Extract Final Frame"
        >
          <Eye size={12} strokeWidth={3} />
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/5" />
      
      <div className="flex h-full items-center px-2 pointer-events-none justify-between w-full relative z-10">
         <div className="flex items-center min-w-0">
           {clip.type === 'video' ? <Video size={10} className="mr-2 text-blue-400 shrink-0" /> : clip.type === 'audio' ? <Music size={10} className="mr-2 text-teal-300 shrink-0" /> : <ImageIcon size={10} className="mr-2 text-purple-400 shrink-0" />}
           {clip.groupId && <LinkIcon size={8} className="mr-1.5 text-yellow-400 shrink-0" />}
           <span className="text-[10px] truncate leading-none font-medium">{clip.name}</span>
         </div>
         <span className="text-[8px] font-mono text-zinc-500 shrink-0 ml-2">
           {formatTime(duration).split('.')[0]}
         </span>
      </div>

      {/* Trim Handles */}
      <div className="absolute inset-y-0 left-0 w-2 cursor-ew-resize hover:bg-blue-400/50 z-10" onMouseDown={(e) => onTrimStartMouseDown(e, clip)} />
      <div className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-blue-400/50 z-10" onMouseDown={(e) => onTrimEndMouseDown(e, clip)} />
    </div>
  );
};
