import React, { useRef, useState, useEffect } from 'react';
import { Sparkles, Zap, Music, Scissors, Magnet, Trash2, Clock, Layers as LayersIcon, Eye, EyeOff, VolumeX, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VideoClip, Asset } from '../../../types';
import { RULER_HEIGHT } from '../../../constants/layout';
import { formatTime } from '../../../utils/timeUtils';
import { useTimelineInteraction } from '../../../hooks/useTimelineInteraction';
import { TimeRuler } from './TimeRuler';
import { ClipItem } from './ClipItem';

interface TimelineProps {
  clips: VideoClip[];
  assets: Asset[];
  history: any[];
  setClips: React.Dispatch<React.SetStateAction<VideoClip[]>>;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  zoom: number;
  setZoom: (z: number) => void;
  duration: number;
  trackHeights: number[];
  trackTops: number[];
  isSnapEnabled: boolean;
  setIsSnapEnabled: (snap: boolean) => void;
  snapLineX: number | null;
  setSnapLineX: (x: number | null) => void;
  selectedClipIds: string[];
  setSelectedClipIds: React.Dispatch<React.SetStateAction<string[]>>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  isSplitMode: boolean;
  setIsSplitMode: (split: boolean) => void;
  isAutoXEnabled: boolean;
  setIsAutoXEnabled: (val: boolean) => void;
  isAutoFadeEnabled: boolean;
  setIsAutoFadeEnabled: (val: boolean) => void;
  isAutoFadeBgmEnabled: boolean;
  setIsAutoFadeBgmEnabled: (val: boolean) => void;
  deleteSelectedClips: () => void;
  rippleDelete: () => void;
  updateClipProp: (id: string, prop: string, val: any) => void;
  splitClipsAtPlayhead: () => void;
  onExtractFrame: (clip: VideoClip) => void;
  onExportClip: (clip: VideoClip) => void;
  detachAudio: () => void;
  timelineHeight: number;
  audioWaveforms: { [id: string]: string };
  expandedClipIds: string[];
  setExpandedClipIds: React.Dispatch<React.SetStateAction<string[]>>;
  hiddenTracks: number[];
  soloTracks: number[];
  muteAudioTracks: number[];
  setHiddenTracks: React.Dispatch<React.SetStateAction<number[]>>;
  setSoloTracks: React.Dispatch<React.SetStateAction<number[]>>;
  setMuteAudioTracks: React.Dispatch<React.SetStateAction<number[]>>;
  processFiles: (files: File[], targetTrack?: number, startTime?: number, addToTimeline?: boolean) => void;
  autoFadeDuration: number;
  setAutoFadeDuration: (val: number) => void;
  bgmFadeOutDuration: number;
  setBgmFadeOutDuration: (val: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const Timeline: React.FC<TimelineProps> = (props) => {
  const {
    clips, assets, history, setClips, currentTime, setCurrentTime, zoom, setZoom, duration,
    trackHeights, trackTops, isSnapEnabled, setIsSnapEnabled, snapLineX, setSnapLineX,
    selectedClipIds, setSelectedClipIds, isPlaying, setIsPlaying, playbackRate, setPlaybackRate, isSplitMode, setIsSplitMode,
    isAutoXEnabled, setIsAutoXEnabled, isAutoFadeEnabled, setIsAutoFadeEnabled,
    isAutoFadeBgmEnabled, setIsAutoFadeBgmEnabled, deleteSelectedClips, rippleDelete, updateClipProp,
    splitClipsAtPlayhead, onExtractFrame, onExportClip, detachAudio, timelineHeight, audioWaveforms, expandedClipIds,
    setExpandedClipIds, hiddenTracks, soloTracks, muteAudioTracks,
    setHiddenTracks, setSoloTracks, setMuteAudioTracks,
    processFiles,
    autoFadeDuration, setAutoFadeDuration,
    bgmFadeOutDuration, setBgmFadeOutDuration,
    onDragStart, onDragEnd
  } = props;

  const trackHeaderRef = useRef<HTMLDivElement>(null);
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clip: VideoClip | null } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const getTrackFromY = (y: number) => {
    for (let i = 0; i < 7; i++) {
       if (y >= trackTops[i] && (i === 6 || y < trackTops[i+1])) return i;
    }
    return y < RULER_HEIGHT ? 0 : 6;
  };

  const {
    setIsDraggingClip, setIsTrimmingClip, setIsScrubbing, setIsSelecting,
    selectionRect, setSelectionRect, dragInfo, isScrubbing, isSelecting, isDraggingClip, isTrimmingClip
  } = useTimelineInteraction(clips, setClips, zoom, isSnapEnabled, currentTime, setSnapLineX, getTrackFromY);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleClipMouseDown = (e: React.MouseEvent, clip: VideoClip) => {
    if (isSplitMode) {
      splitClipsAtPlayhead();
      setIsSplitMode(false);
      e.stopPropagation();
      return;
    }
    if (e.button === 2) return; 
    e.stopPropagation();
    
    const isMod = e.metaKey || e.ctrlKey;
    let newSelection = [...selectedClipIds];
    const members = clip.groupId ? clips.filter(x => x.groupId === clip.groupId).map(x => x.id) : [clip.id];

    if (isMod) {
      const anyMemberSelected = members.some(id => newSelection.includes(id));
      if (anyMemberSelected) {
        newSelection = newSelection.filter(id => !members.includes(id));
      } else {
        newSelection = Array.from(new Set([...newSelection, ...members]));
      }
    } else {
      if (!newSelection.includes(clip.id)) {
        newSelection = members;
      }
    }
    
    setSelectedClipIds(newSelection);
    setIsDraggingClip(true);
    onDragStart?.(); // notify App.tsx to freeze video seeks during drag
    const states: { [id: string]: any } = {};
    newSelection.forEach(id => {
       const c = clips.find(x => x.id === id);
       if (c) states[id] = { startTime: c.startTime, track: c.track, trimStart: c.trimStart, trimEnd: c.trimEnd };
    });
    dragInfo.current = {
       clipId: clip.id,
       startX: e.clientX,
       startY: e.clientY,
       originalStates: states
    };
  };

  return (
    <div className="bg-[#0a0a0a] border-t border-white/5 flex flex-col overflow-hidden" style={{ height: timelineHeight }}>
       <div className="h-14 bg-[#111] border-b border-white/5 flex items-center px-6 justify-between">
        <div className="flex items-center h-full">
          <div className="flex items-center gap-4 border-r border-white/5 pr-6 h-6">
            <button onClick={() => setIsAutoXEnabled(!isAutoXEnabled)} className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${isAutoXEnabled ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/50' : 'text-zinc-500 hover:text-white'}`}>
              <Sparkles size={12} /> <span className="text-[10px] font-bold uppercase tracking-widest">Auto X</span>
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsAutoFadeEnabled(!isAutoFadeEnabled)} className={`flex items-center gap-2 px-3 py-1 rounded-l-full transition-all ${isAutoFadeEnabled ? 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/50' : 'text-zinc-500 hover:text-white'}`}>
                <Zap size={12} /> <span className="text-[10px] font-bold uppercase tracking-widest">Auto Fade</span>
              </button>
              <div className="flex items-center bg-zinc-900 border border-white/5 rounded-r-full px-2 h-6">
                <input 
                  type="number" step="0.1" min="0" value={autoFadeDuration} 
                  onChange={(e) => setAutoFadeDuration(parseFloat(e.target.value) || 0)}
                  className="bg-transparent text-[10px] font-mono text-purple-400 w-8 outline-none text-center"
                />
                <span className="text-[8px] text-zinc-600 font-bold uppercase ml-1">s</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsAutoFadeBgmEnabled(!isAutoFadeBgmEnabled)} className={`flex items-center gap-2 px-3 py-1 rounded-l-full transition-all ${isAutoFadeBgmEnabled ? 'bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/50' : 'text-zinc-500 hover:text-white'}`}>
                <Music size={12} /> <span className="text-[10px] font-bold uppercase tracking-widest">Auto Fade BGM</span>
              </button>
              <div className="flex items-center bg-zinc-900 border border-white/5 rounded-r-full px-2 h-6">
                <input 
                  type="number" step="0.1" min="0" value={bgmFadeOutDuration} 
                  onChange={(e) => setBgmFadeOutDuration(parseFloat(e.target.value) || 0)}
                  className="bg-transparent text-[10px] font-mono text-teal-400 w-8 outline-none text-center"
                />
                <span className="text-[8px] text-zinc-600 font-bold uppercase ml-1">s</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-8 pl-6">
            <button onClick={splitClipsAtPlayhead} className={`flex items-center gap-2 transition-colors group ${isSplitMode ? 'text-red-500' : 'text-zinc-500 hover:text-white'}`}>
              <Scissors size={14} className="group-hover:scale-110 transition-transform" /> <span className="text-[10px] font-bold uppercase tracking-widest">Split</span>
            </button>
            <button onClick={() => setIsSnapEnabled(!isSnapEnabled)} className={`flex items-center gap-2 transition-colors ${isSnapEnabled ? 'text-blue-400' : 'text-zinc-500 hover:text-white'}`}>
              <Magnet size={14} className={isSnapEnabled ? 'rotate-12' : ''} /> <span className="text-[10px] font-bold uppercase tracking-widest">Snap</span>
            </button>
            <button onClick={deleteSelectedClips} className="flex items-center gap-2 text-zinc-500 hover:text-red-400 transition-colors">
              <Trash2 size={14} /> <span className="text-[10px] font-bold uppercase tracking-widest">Delete</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
              <Clock size={12} className="text-zinc-500" /> <span className="text-[10px] font-mono text-zinc-400 tracking-tighter w-16 text-center">{formatTime(currentTime)}</span>
           </div>
            <div className="flex items-center gap-2 h-8 bg-black/20 p-1 rounded-lg">
               <button onClick={() => setZoom(Math.max(10, zoom - 10))} className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white">-</button>
               <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden"> <div className="h-full bg-blue-500" style={{ width: `${(zoom / 500) * 100}%` }} /> </div>
               <button onClick={() => setZoom(Math.min(500, zoom + 10))} className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white">+</button>
            </div>
        </div>
       </div>

       <div className="flex-1 flex overflow-hidden">
          <div className="w-32 flex flex-col border-r border-white/5 bg-[#0a0a0a] overflow-hidden">
             <div className="h-[54px] border-b border-white/5 flex items-center px-4 bg-[#080808]">
                <LayersIcon size={12} className="text-zinc-500 mr-2" /> <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tracks</span>
             </div>
             <div className="flex-1 overflow-hidden" ref={trackHeaderRef}>
                {[0, 1, 2, 3, 4, 5, 6].map((t) => (
                   <div 
                     key={t} 
                     className={`border-b border-white/10 flex items-center justify-between px-3 group hover:bg-white/5 transition-colors ${t === 6 ? 'cursor-pointer active:scale-95' : ''}`} 
                     style={{ height: trackHeights[t] }}
                     onClick={() => {
                        if (t === 6) fileInputRef.current?.click();
                     }}
                   >
                     <div className="flex flex-col gap-0.5">
                       <span className={`text-[10px] font-black uppercase tracking-[0.1em] transition-colors leading-none ${t === 6 ? 'text-blue-400 group-hover:text-blue-300' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                         {t < 3 ? `V${t+1}` : t < 6 ? `A${t-2}` : 'BGM'}
                       </span>
                       <span className="text-[8px] text-zinc-700 font-bold uppercase">{t < 3 ? 'Video' : 'Audio'}</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        {t < 3 ? (
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setHiddenTracks(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
                             }} 
                             className={`w-7 h-7 rounded flex items-center justify-center transition-all ${hiddenTracks.includes(t) ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-zinc-900/50 text-zinc-500 border border-white/5 hover:border-white/20'}`}
                             title="Toggle Visibility"
                           >
                             {hiddenTracks.includes(t) ? <EyeOff size={12} strokeWidth={2.5} /> : <Eye size={12} strokeWidth={2.5} />}
                           </button>
                        ) : (
                           <div className="flex items-center gap-1">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setSoloTracks(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
                               }} 
                               className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-black border transition-all ${soloTracks.includes(t) ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:border-white/20'}`}
                               title="Solo"
                             >
                               S
                             </button>
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setMuteAudioTracks(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
                               }} 
                               className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-black border transition-all ${muteAudioTracks.includes(t) ? 'bg-red-500 text-white border-red-500' : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:border-white/20'}`}
                               title="Mute"
                             >
                               M
                             </button>
                           </div>
                        )}
                     </div>
                  </div>
                ))}
             </div>
          </div>

          <div 
            ref={timelineViewportRef} id="timeline-viewport" className="flex-1 overflow-auto relative select-none custom-scrollbar"
            onScroll={(e) => { if (trackHeaderRef.current) trackHeaderRef.current.scrollTop = e.currentTarget.scrollTop; }}
            onMouseDown={(e) => {
               const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
               const x = e.clientX - rect.left + (e.currentTarget as HTMLElement).scrollLeft;
               const y = e.clientY - rect.top;
               if (y < RULER_HEIGHT) { setIsScrubbing(true); setCurrentTime(Math.max(0, x / zoom)); }
               else { 
                 if (e.button === 0) {
                   setIsSelecting(true); 
                   setSelectionRect({ x, y, width: 0, height: 0 }); 
                   if (!(e.metaKey || e.ctrlKey)) setSelectedClipIds([]); 
                 }
               }
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, clip: null });
            }}
            onMouseMove={(e) => {
               if (isScrubbing) {
                 const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                 const x = e.clientX - rect.left + (e.currentTarget as HTMLElement).scrollLeft;
                 setCurrentTime(Math.max(0, x / zoom));
               } else if (isSelecting && selectionRect) {
                 const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                 const x = e.clientX - rect.left + (e.currentTarget as HTMLElement).scrollLeft;
                 const y = e.clientY - rect.top;
                 setSelectionRect(prev => prev ? { ...prev, width: x - prev.x, height: y - prev.y } : null);
               }
            }}
            onMouseUp={() => {
               if (isSelecting && selectionRect) {
                  const minX = Math.min(selectionRect.x, selectionRect.x + selectionRect.width);
                  const maxX = Math.max(selectionRect.x, selectionRect.x + selectionRect.width);
                  const minY = Math.min(selectionRect.y, selectionRect.y + selectionRect.height);
                  const maxY = Math.max(selectionRect.y, selectionRect.y + selectionRect.height);
                  const targets = clips.filter(clip => {
                     const clipX = clip.startTime * zoom;
                     const clipY = trackTops[clip.track] + 4;
                     const clipW = ((clip.trimEnd - clip.trimStart) / clip.speed) * zoom;
                     const clipH = expandedClipIds.includes(clip.id) ? 120 : 56;
                     return clipX < maxX && clipX + clipW > minX && clipY < maxY && clipY + clipH > minY;
                  });
                  setSelectedClipIds(prev => Array.from(new Set([...prev, ...targets.map(t => t.id)])));
               }
               setIsScrubbing(false); setIsSelecting(false); setSelectionRect(null);
               onDragEnd?.(); // always reset drag flag on any mouseup in timeline
            }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDragEnter={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
               e.preventDefault();
               setIsDraggingOver(false);
               
               let assetIds: string[] = [];
               try {
                  const assetIdsStr = e.dataTransfer.getData('assetIds');
                  const singleAssetId = e.dataTransfer.getData('assetId');
                  assetIds = assetIdsStr ? JSON.parse(assetIdsStr) : (singleAssetId ? [singleAssetId] : []);
               } catch (err) {
                  const singleAssetId = e.dataTransfer.getData('assetId');
                  if (singleAssetId) assetIds = [singleAssetId];
               }
               
               const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
               const x = e.clientX - rect.left + (e.currentTarget as HTMLElement).scrollLeft;
               const baseTrack = getTrackFromY(e.clientY - rect.top);
               let dropTime = Math.max(0, x / zoom);

               const files = Array.from(e.dataTransfer.files);
               if (files.length > 0) {
                  processFiles(files, Math.min(6, baseTrack), dropTime, true);
                  return;
               }

               if (assetIds.length > 0) {
                  const newClips: VideoClip[] = [];
                  assetIds.forEach((id, index) => {
                     const asset = assets.find(a => a.id === id) || (history as any[]).find(h => h.id === id);
                     if (!asset) return;
                     newClips.push({
                        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${index}`, 
                        assetId: asset.id, name: asset.name || asset.prompt?.substring(0, 15) || "Asset",
                        type: asset.type, startTime: dropTime, trimStart: 0, trimEnd: asset.duration || (asset.type === 'image' ? 5 : 0),
                        track: Math.min(6, baseTrack), x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, speed: 1, volume: 1,
                        url: asset.url || asset.resultUrl, keyframes: {}, path: asset.path
                     });
                     dropTime += (asset.duration || 5) + 0.5;
                  });
                  setClips(prev => [...prev, ...newClips]);
               }
            }}
          >
             <AnimatePresence>
               {isDraggingOver && (
                 <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[200] bg-blue-500/10 border-2 border-blue-500 border-dashed pointer-events-none flex items-center justify-center"
                 >
                    <div className="bg-blue-600 px-4 py-2 rounded-full text-white text-xs font-black uppercase tracking-widest shadow-xl">
                      Drop to Add to Timeline
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>
             <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)`, backgroundSize: `${zoom}px 100%` }} />
             
             <div className={`absolute top-0 bottom-0 ${isSplitMode ? 'bg-red-500 w-1' : 'bg-blue-500 w-0.5'} z-[100] cursor-ew-resize shadow-[0_0_10px_rgba(59,130,246,0.5)]`} style={{ left: currentTime * zoom }}>
               <div className={`absolute top-0 left-1/2 -translate-x-1/2 ${isSplitMode ? 'w-10 bg-red-600 h-6' : 'w-3 h-5 bg-blue-500'} rounded-b-full shadow-lg flex items-center justify-center transition-all`}>
                 {isSplitMode ? <Scissors size={10} className="text-white" /> : <div className="w-0.5 h-2 bg-white/30 rounded-full" />}
               </div>
             </div>

             {snapLineX !== null && <div className="absolute top-0 bottom-0 w-px bg-yellow-400 z-[90] shadow-[0_0_5px_rgba(250,204,21,0.5)]" style={{ left: snapLineX }} />}

             {selectionRect && <div className="absolute border border-blue-500 bg-blue-500/20 z-[200] pointer-events-none" style={{ left: Math.min(selectionRect.x, selectionRect.x + selectionRect.width), top: Math.min(selectionRect.y, selectionRect.y + selectionRect.height), width: Math.abs(selectionRect.width), height: Math.abs(selectionRect.height) }} />}

             <div className="relative" style={{ minWidth: (duration || 60) * zoom, height: '100%' }}>
                <TimeRuler duration={duration} zoom={zoom} />
                <div className="absolute inset-0 pointer-events-none">
                   {[0, 1, 2, 3, 4, 5, 6].map(t => (
                      <div key={t} className="absolute left-0 right-0 border-b border-white/5 opacity-20" style={{ top: trackTops[t], height: trackHeights[t], backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px)`, backgroundSize: `${zoom}px 100%` }} />
                   ))}
                </div>
                {clips.filter(c => !hiddenTracks.includes(c.track)).map(clip => (
                  <ClipItem 
                    key={clip.id} clip={clip} zoom={zoom} trackTops={trackTops} 
                    trackHeight={trackHeights[clip.track]}
                    expandedClipIds={expandedClipIds} selectedClipIds={selectedClipIds} 
                    isSplitMode={isSplitMode} audioWaveforms={audioWaveforms} onMouseDown={handleClipMouseDown} 
                    onDoubleClick={() => setExpandedClipIds(prev => prev.includes(clip.id) ? prev.filter(id => id !== clip.id) : [...prev, clip.id])}
                    onTrimStartMouseDown={(e) => { e.stopPropagation(); onDragStart?.(); setIsTrimmingClip('start'); dragInfo.current = { clipId: clip.id, startX: e.clientX, startY: e.clientY, originalStates: { [clip.id]: { startTime: clip.startTime, track: clip.track, trimStart: clip.trimStart, trimEnd: clip.trimEnd } } }; }}
                    onTrimEndMouseDown={(e) => { e.stopPropagation(); onDragStart?.(); setIsTrimmingClip('end'); dragInfo.current = { clipId: clip.id, startX: e.clientX, startY: e.clientY, originalStates: { [clip.id]: { startTime: clip.startTime, track: clip.track, trimStart: clip.trimStart, trimEnd: clip.trimEnd } } }; }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, clip });
                      if (!selectedClipIds.includes(clip.id)) setSelectedClipIds([clip.id]);
                    }}
                    onExtractFrame={onExtractFrame}
                  />
                ))}
             </div>
          </div>
       </div>

       {contextMenu && (
          <div 
            className="fixed z-[1000] bg-zinc-900 border border-white/10 rounded-lg shadow-2xl py-1 min-w-[180px] backdrop-blur-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button 
              onClick={() => { 
                const newRate = playbackRate === 2 ? 1 : 2;
                setPlaybackRate(newRate);
                setContextMenu(null); 
              }}
              className="w-full text-left px-4 py-2 hover:bg-zinc-800 text-xs font-bold flex items-center gap-2 text-yellow-400 border-b border-white/10"
            >
              <Zap size={12} fill="currentColor" /> 
              Preview at {playbackRate === 2 ? 'Normal (1x)' : 'Double (2x)'}
            </button>

            <button 
              onClick={() => { splitClipsAtPlayhead(); setContextMenu(null); }}
              className="w-full text-left px-4 py-2 hover:bg-blue-600 text-xs font-medium flex items-center gap-2"
            >
              <Scissors size={12} /> Split at Playhead
            </button>
            
            <button 
              onClick={() => { 
                const targetClips = contextMenu.clip ? [contextMenu.clip] : clips.filter(c => selectedClipIds.includes(c.id));
                const anyNot2x = targetClips.some(c => (c.speed || 1) !== 2);
                const newSpeed = anyNot2x ? 2 : 1;
                targetClips.forEach(c => updateClipProp(c.id, 'speed', newSpeed));
                setContextMenu(null); 
              }}
              className="w-full text-left px-4 py-2 hover:bg-blue-600 text-xs font-medium flex items-center gap-2 border-b border-white/5 pb-2 mb-1"
            >
              <Zap size={12} /> 
              {(() => {
                const targetClips = contextMenu.clip ? [contextMenu.clip] : clips.filter(c => selectedClipIds.includes(c.id));
                const anyNot2x = targetClips.some(c => (c.speed || 1) !== 2);
                const count = targetClips.length;
                return anyNot2x ? `Double Speed (2x)${count > 1 ? ` for ${count} clips` : ''}` : `Normal Speed (1x)${count > 1 ? ` for ${count} clips` : ''}`;
              })()}
            </button>
            
            {/* Single/Multi Video Clip Actions */}
            {(contextMenu.clip?.type === 'video' || clips.filter(c => selectedClipIds.includes(c.id)).some(c => c.type === 'video')) && (
              <>
                <button 
                  onClick={() => { 
                    const target = contextMenu.clip || clips.find(c => c.id === selectedClipIds[0]);
                    if (target) onExportClip(target); 
                    setContextMenu(null); 
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-blue-600 text-xs font-bold flex items-center gap-2 text-green-400 hover:text-white"
                >
                  <Download size={12} /> Export & Save as Asset
                </button>
                <button 
                  onClick={() => { 
                    const target = contextMenu.clip || clips.find(c => c.id === selectedClipIds[0]);
                    if (target) onExtractFrame(target); 
                    setContextMenu(null); 
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-blue-600 text-xs font-medium flex items-center gap-2 text-blue-400 hover:text-white"
                >
                  <Eye size={12} /> Extract Final Frame
                </button>
                <button 
                  onClick={() => { detachAudio(); setContextMenu(null); }}
                  className="w-full text-left px-4 py-2 hover:bg-blue-600 text-xs font-medium flex items-center gap-2"
                >
                  <VolumeX size={12} /> Detach Audio {selectedClipIds.length > 1 ? `(${clips.filter(c => selectedClipIds.includes(c.id) && c.type === 'video').length} clips)` : ''}
                </button>
              </>
            )}
            
            <button 
              onClick={() => { rippleDelete(); setContextMenu(null); }}
              className="w-full text-left px-4 py-2 hover:bg-orange-600 text-xs font-bold flex items-center gap-2 text-orange-400 hover:text-white"
            >
              <Trash2 size={12} /> Ripple Delete {selectedClipIds.length > 1 ? `(${selectedClipIds.length} clips)` : ''}
            </button>

            <button 
              onClick={() => { deleteSelectedClips(); setContextMenu(null); }}
              className="w-full text-left px-4 py-2 hover:bg-red-600 text-xs font-medium flex items-center gap-2"
            >
              <Trash2 size={12} /> Delete {selectedClipIds.length > 1 ? `(${selectedClipIds.length} clips)` : ''}
            </button>
          </div>
        )}

       <input 
         type="file" 
         ref={fileInputRef} 
         className="hidden" 
         multiple 
         accept="audio/*" 
         onChange={(e) => {
           if (e.target.files) processFiles(Array.from(e.target.files), 6, currentTime, true);
           e.target.value = '';
         }}
       />
    </div>
  );
};
