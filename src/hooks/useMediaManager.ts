import { useRef, useEffect } from 'react';
import { VideoClip } from '../types';

export function useMediaManager(
  clips: VideoClip[], 
  currentTime: number, 
  isPlaying: boolean, 
  muteAudioTracks: number[], 
  soloTracks: number[],
  isAutoFadeEnabled: boolean,
  isAutoFadeBgmEnabled: boolean,
  masterVolume: number,
  autoFadeDuration: number = 0.5,
  bgmFadeOutDuration: number = 3.0,
  isDraggingRef?: React.MutableRefObject<boolean>
) {
  const videoRefs = useRef<{ [id: string]: HTMLVideoElement }>({});
  const audioRefs = useRef<{ [id: string]: HTMLAudioElement }>({});
  const imageRefs = useRef<{ [id: string]: HTMLImageElement }>({});

  // Sync media elements
  useEffect(() => {
    clips.forEach(clip => {
      if (clip.type === 'video' && clip.url) {
        if (!videoRefs.current[clip.id]) {
          const v = document.createElement('video');
          v.src = clip.url;
          v.preload = 'auto';
          v.playsInline = true;
          // Blob URLにcrossOriginを設定するとCORSエラーで音声が読めない
          if (!clip.url.startsWith('blob:')) {
            v.crossOrigin = 'anonymous';
          }
          v.muted = false;
          videoRefs.current[clip.id] = v;
        } else if (videoRefs.current[clip.id].src !== clip.url) {
          videoRefs.current[clip.id].src = clip.url;
        }
      }
      if (clip.type === 'audio' && clip.url) {
        if (!audioRefs.current[clip.id]) {
          const a = new Audio(clip.url);
          a.preload = 'auto';
          // Blob URLにcrossOriginを設定するとCORSエラーで音声が読めない
          if (!clip.url.startsWith('blob:')) {
            a.crossOrigin = 'anonymous';
          }
          a.muted = false;
          audioRefs.current[clip.id] = a;
        } else if (audioRefs.current[clip.id].src !== clip.url) {
          audioRefs.current[clip.id].src = clip.url;
        }
      }
      if (clip.type === 'image' && clip.url) {
        if (!imageRefs.current[clip.id]) {
          const img = new Image();
          img.src = clip.url;
          img.crossOrigin = 'anonymous';
          imageRefs.current[clip.id] = img;
        } else if (imageRefs.current[clip.id].src !== clip.url) {
          imageRefs.current[clip.id].src = clip.url;
        }
      }
    });

    const currentIds = new Set(clips.map(c => c.id));
    [videoRefs, audioRefs].forEach(refSet => {
      Object.keys(refSet.current).forEach(id => {
        if (!currentIds.has(id)) {
          refSet.current[id].pause();
          refSet.current[id].src = "";
          refSet.current[id].load();
          delete refSet.current[id];
        }
      });
    });
  }, [clips]);

  // Handle Playback & Volume
  useEffect(() => {
    const isAnySolo = soloTracks.length > 0;
    const timelineEnd = clips.length > 0 ? Math.max(...clips.map(c => c.startTime + (c.trimEnd - c.trimStart) / c.speed)) : 0;

    clips.forEach(clip => {
      const v = videoRefs.current[clip.id];
      const a = audioRefs.current[clip.id];
      const el = v || a;
      if (!el) return;

      const duration = (clip.trimEnd - clip.trimStart) / clip.speed;
      const it = (currentTime - clip.startTime) * clip.speed + clip.trimStart;
      const isActive = currentTime >= clip.startTime && currentTime <= (clip.startTime + duration);

      // Volume calculation
      let finalVolume = clip.volume ?? 1;

      if (isActive) {
        // Auto Fade
        if (isAutoFadeEnabled) {
          const relativePos = currentTime - clip.startTime;
          if (relativePos < autoFadeDuration) {
            finalVolume *= (relativePos / autoFadeDuration);
          } else if (relativePos > duration - autoFadeDuration) {
            finalVolume *= ((duration - relativePos) / autoFadeDuration);
          }
        }

        // Auto Fade BGM (Ducking)
        if (isAutoFadeBgmEnabled && clip.track === 6) {
          const otherAudioPlaying = clips.some(other => 
            other.track < 6 && 
            currentTime >= other.startTime && 
            currentTime <= other.startTime + (other.trimEnd - other.trimStart) / other.speed
          );
          if (otherAudioPlaying) finalVolume *= 0.2;

          // Fade out at end of timeline
          if (currentTime > timelineEnd - bgmFadeOutDuration) {
            finalVolume *= Math.max(0, (timelineEnd - currentTime) / bgmFadeOutDuration);
          }
        }
      }

      const isMuted = muteAudioTracks.includes(clip.track);
      const isSoloed = soloTracks.includes(clip.track);
      el.volume = (isActive && !isMuted && (!isAnySolo || isSoloed)) ? Math.max(0, Math.min(1, finalVolume * masterVolume)) : 0;

      // Sync time & playback
      if (isActive) {
        if (v) {
          // While playing, let the video play naturally and only sync if drift is HUGE (> 1s)
          // Frequent seeking while playing causes audio to be muted by the browser.
          const driftLimit = isPlaying ? 1.5 : 0.05; 
          if (Math.abs(v.currentTime - it) > driftLimit && !isDraggingRef?.current) {
            v.currentTime = it;
          }
          
          if (isPlaying) {
            if (v.paused) {
              v.play().catch(e => console.error("Video play failed:", e));
            }
          } else {
            if (!v.paused) v.pause();
          }
        }
        if (a) {
          // Same for audio elements
          const driftLimit = isPlaying ? 1.0 : 0.05;
          if (Math.abs(a.currentTime - it) > driftLimit && !isDraggingRef?.current) {
            a.currentTime = it;
          }

          if (isPlaying) {
            if (a.paused) {
              a.play().catch(e => console.error("Audio play failed:", e));
            }
          } else {
            if (!a.paused) a.pause();
          }
        }
      } else {
        if (v && !v.paused) v.pause();
        if (a && !a.paused) a.pause();
      }
    });
  }, [currentTime, isPlaying, clips, muteAudioTracks, soloTracks, isAutoFadeEnabled, isAutoFadeBgmEnabled, masterVolume, autoFadeDuration, bgmFadeOutDuration]);

  return { videoRefs, audioRefs, imageRefs };
}
