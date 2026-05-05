/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { VideoClip } from '../../types';
import { PremiereControlRow } from '../Properties/AnimationControls';

interface PropertiesPanelProps {
  clip: VideoClip;
  updateClipProp: (prop: string, val: number) => void;
  resetClipProps: (props: string[]) => void;
  togglePropKeyframes: (prop: string) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  removeKeyframe: (clipId: string, prop: string, time: number) => void;
}

function getInterpolatedValue(keyframes: any[] | undefined, defaultValue: number, time: number): number {
  if (!keyframes || keyframes.length === 0) return defaultValue;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (time >= start.time && time <= end.time) {
      const t = (time - start.time) / (end.time - start.time);
      return start.value + (end.value - start.value) * t;
    }
  }
  return defaultValue;
}

export function PropertiesPanel({
  clip,
  updateClipProp,
  resetClipProps,
  togglePropKeyframes,
  currentTime,
  setCurrentTime,
  removeKeyframe
}: PropertiesPanelProps) {
  const internalTime = (currentTime - clip.startTime) * clip.speed + clip.trimStart;
  const clipDuration = (clip.trimEnd - clip.trimStart) / clip.speed;
  const relativeTime = Math.max(0, Math.min(clipDuration, currentTime - clip.startTime));
  const progress = (relativeTime / clipDuration) * 100;

  // Handle Delete key to remove keyframes at current time
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Find properties with keyframes at current time
        const props = Object.keys(clip.keyframes || {});
        props.forEach(p => {
          const kfs = (clip.keyframes as any)[p] || [];
          const hasKf = kfs.some((k: any) => Math.abs(k.time - internalTime) < 0.05);
          if (hasKf) {
            removeKeyframe(clip.id, p, internalTime);
          }
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clip, internalTime, removeKeyframe]);

  return (
    <div className="space-y-6">
      {/* Clip Navigator / Scrubber */}
      <div className="space-y-3 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Clip Navigator
          </h3>
          <span className="text-[10px] font-mono text-zinc-500 tracking-tighter">
            {relativeTime.toFixed(2)}s / {clipDuration.toFixed(2)}s
          </span>
        </div>
        <div 
          className="relative h-8 bg-black/40 rounded-lg border border-white/5 cursor-crosshair group overflow-hidden"
          onMouseDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const update = (moveE: MouseEvent | React.MouseEvent) => {
              const x = Math.max(0, Math.min(rect.width, moveE.clientX - rect.left));
              const newRelative = (x / rect.width) * clipDuration;
              setCurrentTime(clip.startTime + newRelative);
            };
            update(e);
            const onMouseMove = (mE: MouseEvent) => update(mE);
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
        >
          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-10 flex justify-between px-1 pointer-events-none">
            {[...Array(10)].map((_, i) => <div key={i} className="w-px h-full bg-white" />)}
          </div>
          
          {/* Progress fill */}
          <div 
            className="absolute inset-y-0 left-0 bg-blue-500/10 border-r border-blue-500/50 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
          
          {/* Playhead indicator */}
          <div 
            className="absolute inset-y-0 w-0.5 bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)] z-10"
            style={{ left: `${progress}%` }}
          >
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-blue-400 rounded-full border-2 border-[#111]" />
          </div>

          {/* Hover indicator */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
             <div className="h-full w-px bg-white/20" id="scrubber-hover" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Transform</h3>
          <button 
            onClick={() => resetClipProps(['x', 'y', 'scale', 'rotation', 'opacity'])}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all group"
            title="Reset Transformations"
          >
            <RotateCcw size={10} className="group-hover:rotate-[-45deg] transition-transform" />
            Reset
          </button>
        </div>
        <div className="bg-black/20 rounded-xl p-2 space-y-1">
          <PremiereControlRow 
            label="Position X" prop="x" value={getInterpolatedValue(clip.keyframes?.x, clip.x ?? 0, internalTime)} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('x', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="px"
          />
          <PremiereControlRow 
            label="Position Y" prop="y" value={getInterpolatedValue(clip.keyframes?.y, clip.y ?? 0, internalTime)} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('y', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="px"
          />
          <PremiereControlRow 
            label="Scale" prop="scale" value={getInterpolatedValue(clip.keyframes?.scale, clip.scale ?? 1, internalTime)} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('scale', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="x" min={0.1} max={10} step={0.1}
          />
          <PremiereControlRow 
            label="Rotation" prop="rotation" value={getInterpolatedValue(clip.keyframes?.rotation, clip.rotation ?? 0, internalTime)} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('rotation', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="°"
          />
          <PremiereControlRow 
            label="Opacity" prop="opacity" value={getInterpolatedValue(clip.keyframes?.opacity, clip.opacity ?? 1, internalTime)} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('opacity', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="%" min={0} max={1} step={0.01}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Speed & Timing</h3>
        <div className="bg-black/20 rounded-xl p-2">
          <PremiereControlRow 
            label="Speed" prop="speed" value={clip.speed ?? 1} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('speed', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="x" min={0.1} max={10} step={0.1}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Color Correction</h3>
          <button 
            onClick={() => resetClipProps(['temperature', 'tint', 'brightness', 'contrast', 'saturation'])}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all group"
            title="Reset Color Correction"
          >
            <RotateCcw size={10} className="group-hover:rotate-[-45deg] transition-transform" />
            Reset
          </button>
        </div>
        <div className="bg-black/20 rounded-xl p-2 space-y-1">
          <PremiereControlRow 
            label="Temperature" prop="temperature" value={clip.temperature ?? 0} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('temperature', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="" min={-100} max={100} step={1}
          />
          <PremiereControlRow 
            label="Tint" prop="tint" value={clip.tint ?? 0} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('tint', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="" min={-100} max={100} step={1}
          />
          <PremiereControlRow 
            label="Brightness" prop="brightness" value={clip.brightness ?? 1} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('brightness', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="x" min={0} max={3} step={0.01}
          />
          <PremiereControlRow 
            label="Contrast" prop="contrast" value={clip.contrast ?? 1} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('contrast', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="x" min={0} max={3} step={0.01}
          />
          <PremiereControlRow 
            label="Saturation" prop="saturation" value={clip.saturation ?? 1} 
            clip={clip} currentTime={currentTime} 
            onValueChange={(v) => updateClipProp('saturation', v)} 
            toggleKeyframes={togglePropKeyframes} 
            removeKeyframe={removeKeyframe}
            unit="x" min={0} max={3} step={0.01}
          />
        </div>
      </div>

      {clip.type === 'audio' && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Audio</h3>
          <div className="bg-black/20 rounded-xl p-2">
            <PremiereControlRow 
              label="Volume" prop="volume" value={getInterpolatedValue(clip.keyframes?.volume, clip.volume ?? 1, internalTime)} 
              clip={clip} currentTime={currentTime} 
              onValueChange={(v) => updateClipProp('volume', v)} 
              toggleKeyframes={togglePropKeyframes} 
              removeKeyframe={removeKeyframe}
              unit="%" min={0} max={1} step={0.01}
            />
          </div>
        </div>
      )}
    </div>
  );
}
