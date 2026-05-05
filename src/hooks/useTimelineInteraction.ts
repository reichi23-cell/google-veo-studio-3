import React, { useState, useRef, useEffect } from 'react';
import { VideoClip } from '../types';

export function useTimelineInteraction(
  clips: VideoClip[],
  setClips: React.Dispatch<React.SetStateAction<VideoClip[]>>,
  zoom: number,
  isSnapEnabled: boolean,
  currentTime: number,
  setSnapLineX: (x: number | null) => void,
  getTrackFromY: (y: number) => number
) {
  const [isDraggingClip, setIsDraggingClip] = useState(false);
  const [isTrimmingClip, setIsTrimmingClip] = useState<'start' | 'end' | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const dragInfo = useRef<{
    clipId: string;
    startX: number;
    startY: number;
    originalStates: { [id: string]: any };
    isDuplicating?: boolean;
  } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfo.current) return;
      const { clipId, startX, originalStates, isDuplicating } = dragInfo.current;

      if (isDraggingClip) {
        // Handle Option+Drag Duplication
        if (e.altKey && !isDuplicating) {
          dragInfo.current.isDuplicating = true;
          const newClips: VideoClip[] = [];
          const newOriginalStates: { [id: string]: any } = {};
          
          Object.keys(originalStates).forEach(id => {
            const originalClip = clips.find(c => c.id === id);
            if (originalClip) {
              const newId = `clip_copy_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              const copy = { ...originalClip, id: newId };
              newClips.push(copy);
              newOriginalStates[newId] = originalStates[id];
            }
          });

          if (newClips.length > 0) {
            setClips(prev => [...prev, ...newClips]);
            dragInfo.current.originalStates = newOriginalStates;
            dragInfo.current.clipId = newClips[0].id;
          }
          return;
        }

        const deltaX = (e.clientX - startX) / zoom;
        const timelineViewport = document.getElementById('timeline-viewport');
        const timelineRect = timelineViewport?.getBoundingClientRect();
        const nextTrack = timelineRect ? getTrackFromY(e.clientY - timelineRect.top + (timelineViewport?.scrollTop || 0)) : 0;
        
        const originalClicked = originalStates[clipId];
        const deltaTrack = originalClicked ? (nextTrack - originalClicked.track) : 0;

        setClips(prev => prev.map(c => {
          const original = originalStates[c.id];
          if (original) {
            let newStartTime = (original.startTime || 0) + deltaX;
            let targetTrack = (original.track || 0) + deltaTrack;
            
            if (c.type === 'video' || c.type === 'image' || c.type === 'text') {
              targetTrack = Math.max(0, Math.min(2, targetTrack));
            } else if (c.type === 'audio') {
              targetTrack = Math.max(3, Math.min(6, targetTrack));
            }

            if (isSnapEnabled) {
              const snapPoints = [0, currentTime];
              clips.forEach(other => {
                if (originalStates[other.id]) return;
                const otherSpeed = other.speed || 1;
                const otherDur = Math.max(0, ((other.trimEnd || 0) - (other.trimStart || 0))) / otherSpeed;
                snapPoints.push(other.startTime || 0);
                snapPoints.push((other.startTime || 0) + otherDur);
              });

              let snapped = false;
              const cSpeed = c.speed || 1;
              const cDur = Math.max(0, ((c.trimEnd || 0) - (c.trimStart || 0))) / cSpeed;
              for (const pt of snapPoints) {
                if (!isFinite(pt)) continue;
                if (Math.abs(newStartTime - pt) < 0.2) {
                  newStartTime = pt;
                  setSnapLineX(pt * zoom);
                  snapped = true;
                  break;
                }
                if (Math.abs((newStartTime + cDur) - pt) < 0.2) {
                  newStartTime = pt - cDur;
                  setSnapLineX(pt * zoom);
                  snapped = true;
                  break;
                }
              }
              if (!snapped) {
                newStartTime = Math.round(newStartTime * 10) / 10;
                setSnapLineX(null);
              }
            }
            const safeStartTime = isFinite(newStartTime) ? Math.max(0, newStartTime) : (original.startTime || 0);
            return { ...c, startTime: safeStartTime, track: targetTrack };
          }
          return c;
        }));
      } else if (isTrimmingClip) {
        const deltaX = (e.clientX - startX) / zoom;
        setClips(prev => prev.map(c => {
          if (c.id === clipId) {
            const original = originalStates[c.id];
            if (isTrimmingClip === 'start') {
              const newStartTime = Math.max(0, original.startTime + deltaX);
              const newTrimStart = original.trimStart + (newStartTime - original.startTime) * c.speed;
              if (newTrimStart >= 0 && newTrimStart < c.trimEnd) {
                return { ...c, startTime: newStartTime, trimStart: newTrimStart };
              }
            } else {
              const newDuration = (original.trimEnd - original.trimStart) / c.speed + deltaX;
              const newTrimEnd = original.trimStart + newDuration * c.speed;
              if (newTrimEnd > c.trimStart) {
                return { ...c, trimEnd: newTrimEnd };
              }
            }
          }
          return c;
        }));
      }
    };

    const handleMouseUp = () => {
      dragInfo.current = null;
      setIsDraggingClip(false);
      setIsTrimmingClip(null);
      setIsScrubbing(false);
      setSnapLineX(null);
    };

    if (isDraggingClip || isTrimmingClip || isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingClip, isTrimmingClip, isScrubbing, zoom, isSnapEnabled, currentTime, clips, setClips, getTrackFromY, setSnapLineX]);

  return {
    isDraggingClip, setIsDraggingClip,
    isTrimmingClip, setIsTrimmingClip,
    isScrubbing, setIsScrubbing,
    isSelecting, setIsSelecting,
    selectionRect, setSelectionRect,
    dragInfo
  };
}
