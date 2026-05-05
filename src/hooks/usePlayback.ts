import { useState, useRef, useEffect, useCallback } from 'react';

export function usePlayback(duration: number, stopAt?: number) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1); // 1 for forward, -1 for reverse
  const [isMuted, setIsMuted] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1);
  
  const currentTimeRef = useRef(currentTime);
  const isPlayingRef = useRef(isPlaying);
  const playbackRateRef = useRef(playbackRate);
  const lastTimeRef = useRef(0);
  const requestRef = useRef<number | null>(null);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);

  const togglePlayback = useCallback(() => {
    const nextPlaying = !isPlayingRef.current;
    
    // Autoplay policy
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }

    // If starting playback and we're already past stopAt, reset to 0
    if (nextPlaying && stopAt && currentTimeRef.current >= stopAt - 0.05) {
      setCurrentTime(0);
      currentTimeRef.current = 0;
    }
    
    isPlayingRef.current = nextPlaying;
    setIsPlaying(nextPlaying);
  }, [stopAt]);

  const seekTo = useCallback((time: number) => setCurrentTime(Math.max(0, Math.min(duration, time))), [duration]);

  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = 0;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    const loop = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = ((now - lastTimeRef.current) / 1000) * playbackRateRef.current;
      lastTimeRef.current = now;

      let next = currentTimeRef.current + dt;
      
      const limit = stopAt || duration;
      if (next >= limit) {
        next = limit;
        isPlayingRef.current = false;
        setIsPlaying(false);
      } else if (next <= 0) {
        next = 0;
        isPlayingRef.current = false;
        setIsPlaying(false);
      }

      currentTimeRef.current = next;
      setCurrentTime(next);

      if (isPlayingRef.current) {
        requestRef.current = requestAnimationFrame(loop);
      }
    };

    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(loop);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, duration, stopAt]);

  return {
    currentTime, setCurrentTime,
    isPlaying, setIsPlaying,
    playbackRate, setPlaybackRate,
    isMuted, setIsMuted,
    masterVolume, setMasterVolume,
    togglePlayback, seekTo,
    isPlayingRef, currentTimeRef
  };
}
