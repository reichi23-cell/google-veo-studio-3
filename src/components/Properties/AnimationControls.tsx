/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Timer, ChevronLeft, ChevronRight, Key } from 'lucide-react';
import { VideoClip, Keyframe } from '../../types';

interface PremiereControlRowProps {
  label: string;
  prop: string;
  value: number;
  clip: VideoClip;
  currentTime: number;
  onValueChange: (val: number) => void;
  toggleKeyframes: (prop: string) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  removeKeyframe?: (clipId: string, prop: string, time: number) => void;
}

export function PremiereControlRow({ 
  label, prop, value, clip, currentTime, onValueChange, toggleKeyframes, 
  unit = "", min = -Infinity, max = Infinity, step = 1, removeKeyframe
}: PremiereControlRowProps) {
  const keyframes = (clip.keyframes as any)[prop] || [] as Keyframe[];
  const isAnimating = keyframes.length > 0;
  const internalTime = (currentTime - clip.startTime) * clip.speed + clip.trimStart;
  const hasKeyframeAtNow = keyframes.some((k: Keyframe) => Math.abs(k.time - internalTime) < 0.05);
  const duration = (clip.trimEnd - clip.trimStart) / clip.speed;

  return (
    <div className="group/row py-3 space-y-2 border-b border-white/[0.03] last:border-0">
      <div className="flex items-center justify-between group-hover/row:bg-white/[0.02] -mx-2 px-2 rounded-md transition-colors">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => toggleKeyframes(prop)}
            tabIndex={-1}
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isAnimating ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'border-zinc-800 text-zinc-600 hover:border-zinc-500'}`}
            title="Toggle Animation"
          >
            <Timer size={12} className={isAnimating ? 'animate-pulse' : ''} />
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover/row:text-zinc-300 transition-colors">{label}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
             <button tabIndex={-1} className="text-zinc-700 hover:text-zinc-300 transition-colors p-0.5"><ChevronLeft size={14} /></button>
             <button 
               onClick={() => onValueChange(value)}
               tabIndex={-1}
               className={`transition-all ${hasKeyframeAtNow ? 'text-blue-500' : 'text-zinc-700 hover:text-zinc-400'}`}
             >
               <div className={`w-2.5 h-2.5 rotate-45 border-2 ${hasKeyframeAtNow ? 'bg-blue-500 border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'border-current'}`} />
             </button>
             <button tabIndex={-1} className="text-zinc-700 hover:text-zinc-300 transition-colors p-0.5"><ChevronRight size={14} /></button>
          </div>
          
          <div className="min-w-[70px] relative">
            <input 
              type="text"
              readOnly
              value={`${value.toFixed(1)}${unit}`}
              className={`bg-transparent text-right text-[13px] font-mono font-bold outline-none w-full cursor-ew-resize select-none transition-all ${hasKeyframeAtNow ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]' : 'text-blue-400 hover:text-blue-300'}`}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.stopPropagation();
                  e.preventDefault();
                  const increment = (e.shiftKey ? step * 10 : step);
                  const baseline = (prop === 'scale' || prop === 'opacity' || prop === 'brightness' || prop === 'contrast' || prop === 'saturation' || prop === 'volume') ? 1 : 0;
                  
                  let newVal = value + (e.key === 'ArrowRight' ? increment : -increment);
                  
                  // Snap logic for arrow keys: if we're close to baseline, hit it exactly
                  if (Math.abs(value - baseline) > 0.001 && Math.abs(newVal - baseline) < increment * 0.5) {
                    newVal = baseline;
                  }
                  
                  onValueChange(Math.max(min, Math.min(max, newVal)));
                }
              }}
              onMouseDown={(e) => {
                const target = e.currentTarget;
                target.focus();
                const startX = e.clientX;
                const startValue = value;
                const baseline = (prop === 'scale' || prop === 'opacity' || prop === 'brightness' || prop === 'contrast' || prop === 'saturation' || prop === 'volume') ? 1 : 0;
                
                const handleMove = (mv: MouseEvent) => {
                  const delta = (mv.clientX - startX) * (step * 0.5);
                  let newVal = startValue + delta;
                  
                  // Sticky snap logic: if within threshold, stay at baseline
                  const snapThreshold = step * 10;
                  if (Math.abs(newVal - baseline) < snapThreshold) {
                    newVal = baseline;
                  } else {
                    // Offset to prevent sudden jump when leaving snap zone
                    newVal = newVal > baseline ? newVal - snapThreshold : newVal + snapThreshold;
                  }
                  
                  onValueChange(Math.max(min, Math.min(max, newVal)));
                };
                const handleUp = () => {
                  window.removeEventListener('mousemove', handleMove);
                  window.removeEventListener('mouseup', handleUp);
                };
                window.addEventListener('mousemove', handleMove);
                window.addEventListener('mouseup', handleUp);
              }}
            />
          </div>
        </div>
      </div>

      {/* Keyframe Timeline Lane */}
      <div className="relative h-5 bg-black/60 rounded-lg border border-white/[0.05] shadow-inner overflow-hidden">
        <div className="absolute inset-0 flex items-center px-1">
          <div className="w-full h-px bg-white/10" />
        </div>
        
        {keyframes.map((k: Keyframe, i: number) => (
          <div 
            key={i}
            onContextMenu={(e) => {
              e.preventDefault();
              if (removeKeyframe) removeKeyframe(clip.id, prop, k.time);
            }}
            className="absolute w-2 h-2 bg-blue-500 rotate-45 -translate-x-1 top-1.5 shadow-[0_0_10px_rgba(59,130,246,0.6)] z-10 border border-blue-300/30 cursor-pointer hover:bg-red-500 transition-colors"
            style={{ left: `${((k.time - clip.trimStart) / clip.speed) / duration * 100}%` }}
            title="Right click to delete keyframe"
          />
        ))}

        <div 
          className="absolute h-full w-px bg-white/40 z-20 pointer-events-none"
          style={{ left: `${((currentTime - clip.startTime)) / duration * 100}%` }}
        />
      </div>
    </div>
  );
}

export function Scrubber({ label, value, onChange, suffix = "", step = 1, prop, clip, currentTime, toggleKeyframe }: any) {
  const isKeyframed = prop && clip?.keyframes && (clip.keyframes as any)[prop]?.length > 0;
  
  return (
    <div className="space-y-2 py-3 border-b border-white/[0.03]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           {prop && toggleKeyframe && (
             <button 
               onClick={() => toggleKeyframe(clip!.id, prop)}
               tabIndex={-1}
               className={`p-1 rounded-md transition-colors ${isKeyframed ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-600 hover:text-zinc-400'}`}
             >
               <Key size={12} />
             </button>
           )}
           <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <input 
            type="number" 
            value={parseFloat(value.toFixed(2))}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            step={step}
            className="w-16 bg-zinc-900 border border-white/[0.05] text-right text-[11px] font-mono text-blue-400 outline-none hover:border-blue-500/50 rounded-md px-2 py-0.5 transition-all"
          />
          <span className="text-[9px] text-zinc-600 font-bold uppercase">{suffix}</span>
        </div>
      </div>
      <div className="relative h-1.5 bg-black rounded-full overflow-hidden border border-white/[0.05]">
        <input 
          type="range"
          min={prop === 'scale' ? 0.1 : prop === 'opacity' ? 0 : 0}
          max={prop === 'scale' ? 5 : prop === 'opacity' ? 1 : 1}
          step={step}
          value={value}
          tabIndex={-1}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
        />
        <div className="absolute inset-y-0 left-0 bg-blue-600/40 rounded-full" style={{ width: `${(value / (prop === 'scale' ? 5 : 1)) * 100}%` }} />
      </div>
    </div>
  );
}

export function KeyframeLane({ label, prop, clip, currentTime, toggleKeyframe }: any) {
  const keyframes = (clip.keyframes as any)[prop] || [] as Keyframe[];
  const isKeyframed = keyframes.length > 0;
  const duration = (clip.trimEnd - clip.trimStart) / clip.speed;
  
  return (
    <div className="flex items-center h-10 group/lane border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors px-2">
      <div className="w-28 flex items-center gap-2">
        <button 
          onClick={() => toggleKeyframe(clip.id, prop)}
          tabIndex={-1}
          className={`p-1 rounded-md transition-colors ${isKeyframed ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-600 hover:text-zinc-400'}`}
        >
          <Key size={12} />
        </button>
        <span className="text-[10px] text-zinc-500 font-black uppercase tracking-tight truncate">{label}</span>
      </div>
      
      <div className="flex-1 relative h-5 bg-black/40 rounded-md mx-2 overflow-hidden border border-white/[0.05]">
        <div className="absolute inset-0 flex items-center px-1">
          <div className="w-full h-px bg-white/[0.05]" />
        </div>
        {keyframes.map((kf: Keyframe, i: number) => (
           <div 
             key={i}
             className="absolute w-2 h-2 bg-blue-500 rotate-45 -translate-x-1 top-1.5 shadow-[0_0_8px_rgba(59,130,246,0.6)] cursor-pointer border border-blue-300/30"
             style={{ left: `${((kf.time - clip.trimStart) / clip.speed) / duration * 100}%` }}
           />
        ))}
        
        <div 
          className="absolute top-0 bottom-0 w-px bg-white/20"
          style={{ left: `${((currentTime - clip.startTime)) / duration * 100}%` }}
        />
      </div>
    </div>
  );
}
