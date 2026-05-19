/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Asset, VideoClip
} from './types';
import GlobalHeader from './components/Layout/GlobalHeader';
import SharedSidebar from './components/UI/SharedSidebar';
import { PreviewSection } from './components/Editor/PreviewSection';
import { PropertiesPanel } from './components/Editor/PropertiesPanel';
import { Timeline } from './components/Editor/Timeline/Timeline';

import { usePlayback } from './hooks/usePlayback';
import { useMediaManager } from './hooks/useMediaManager';
import { useEditorState } from './hooks/useEditorState';
import { renderTimeline } from './services/renderService';
import { getWaveformData, generateWaveformImage } from './utils/audioUtils';
import { applyFilmGrain, FilmGrainLevel } from './utils/filmGrain';

// --- Helper for Keyframes ---
function getInterpolatedValue(keyframes: any[] | undefined, defaultValue: number, time: number): number {
  if (!keyframes || keyframes.length === 0) return defaultValue;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const k1 = sorted[i]; const k2 = sorted[i + 1];
    if (time >= k1.time && time <= k2.time) {
      const t = (time - k1.time) / (k2.time - k1.time);
      return k1.value + t * (k2.value - k1.value);
    }
  }
  return defaultValue;
}

import { RULER_HEIGHT } from './constants/layout';
import { FrameExtractorModal } from './components/UI/FrameExtractorModal';

const RECENT_DOWNLOAD_DAYS = 5;
const MAX_AUTO_IMPORT_ASSETS = 120;
const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.mov', '.webm', '.m4v',
  '.png', '.jpg', '.jpeg', '.webp',
  '.mp3', '.wav', '.m4a', '.aac'
]);

function getMediaType(filePath: string): Asset['type'] | null {
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  if (['.mp4', '.mov', '.webm', '.m4v'].includes(ext)) return 'video';
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return 'image';
  if (['.mp3', '.wav', '.m4a', '.aac'].includes(ext)) return 'audio';
  return null;
}

function getFileUrl(filePath: string): string {
  if ((window as any).require) {
    return `media-file://local/${encodeURIComponent(filePath)}`;
  }
  return `file://${filePath}`;
}

function getRecentDownloadPaths(): string[] {
  const nodeRequire = (window as any).require;
  if (!nodeRequire) return [];

  const fs = nodeRequire('fs');
  const path = nodeRequire('path');
  const os = nodeRequire('os');
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const cutoff = Date.now() - RECENT_DOWNLOAD_DAYS * 24 * 60 * 60 * 1000;
  const results: Array<{ filePath: string; mtimeMs: number }> = [];

  const scan = (dir: string, depth: number) => {
    if (depth > 4 || results.length >= MAX_AUTO_IMPORT_ASSETS * 2) return;

    let entries: any[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      let stat: any;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (entry.isDirectory()) {
        if (depth === 0 || stat.mtimeMs >= cutoff || /\d{4}-\d{2}-\d{2}/.test(entry.name)) {
          scan(fullPath, depth + 1);
        }
        continue;
      }

      if (stat.mtimeMs < cutoff || !MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      results.push({ filePath: fullPath, mtimeMs: stat.mtimeMs });
    }
  };

  scan(downloadsDir, 0);

  return results
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MAX_AUTO_IMPORT_ASSETS)
    .map(item => item.filePath);
}

function probeMedia(url: string, type: Asset['type']): Promise<{ duration: number; width?: number; height?: number; aspectRatio?: number }> {
  return new Promise(resolve => {
    if (type === 'image') {
      const img = new Image();
      img.onload = () => resolve({
        duration: 5,
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : undefined
      });
      img.onerror = () => resolve({ duration: 5 });
      img.src = url;
      return;
    }

    const media = type === 'video' ? document.createElement('video') : new Audio();
    media.preload = 'metadata';
    media.onloadedmetadata = () => {
      const video = media as HTMLVideoElement;
      resolve({
        duration: Number.isFinite(media.duration) ? media.duration : 5,
        width: type === 'video' ? video.videoWidth : undefined,
        height: type === 'video' ? video.videoHeight : undefined,
        aspectRatio: type === 'video' && video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : undefined
      });
    };
    media.onerror = () => resolve({ duration: 5 });
    media.src = url;
  });
}

export default function App() {
  // --- 1. Central Editor State (with Undo/Redo) ---
  const {
    projectName, setProjectName,
    aspectRatio, setAspectRatio,
    assets, setAssets,
    clips, setClips,
    history, setHistory,
    selectedClipIds, setSelectedClipIds,
    selectedAssetIds, setSelectedAssetIds,
    duration, setDuration,
    undo, redo, pushToHistory, deleteSelectedClips, toggleGroup, rippleDelete,
    handleCopy, handlePaste,
    handleCopyAttributes, handlePasteAttributes,
    removeKeyframe,
    canUndo, canRedo
  } = useEditorState();

  const projectEnd = useMemo(() => {
    if (clips.length === 0) return 0;
    return Math.max(...clips.map(c => c.startTime + (c.trimEnd - c.trimStart) / c.speed));
  }, [clips]);

  // --- 2. Playback State ---
  const {
    currentTime, setCurrentTime, isPlaying, setIsPlaying,
    playbackRate, setPlaybackRate, masterVolume, setMasterVolume,
    togglePlayback, currentTimeRef
  } = usePlayback(duration, projectEnd);

  // --- 3. UI & Layout State ---
  const [isExporting, setIsExporting] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [lowQualityPreview, setLowQualityPreview] = useState(false);
  const [filmGrain, setFilmGrain] = useState<FilmGrainLevel>('off');
  const [activeTab, setActiveTab] = useState<'assets' | 'history'>('assets');
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [propertiesWidth, setPropertiesWidth] = useState(340);
  const [timelineHeight, setTimelineHeight] = useState(480);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingProperties, setIsResizingProperties] = useState(false);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);

  const [extractingMedia, setExtractingMedia] = useState<{ url: string, name: string, seekTime?: number } | null>(null);

  const [muteAudioTracks, setMuteAudioTracks] = useState<number[]>([]);
  const [soloTracks, setSoloTracks] = useState<number[]>([]);
  const [hiddenTracks, setHiddenTracks] = useState<number[]>([]);
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);
  const [isAutoXEnabled, setIsAutoXEnabled] = useState(true);
  const [isAutoFadeEnabled, setIsAutoFadeEnabled] = useState(false);
  const [isAutoFadeBgmEnabled, setIsAutoFadeBgmEnabled] = useState(false);
  const [autoFadeDuration, setAutoFadeDuration] = useState(0.5);
  const [bgmFadeOutDuration, setBgmFadeOutDuration] = useState(3.0);
  const [expandedClipIds, setExpandedClipIds] = useState<string[]>([]);
  const [snapLineX, setSnapLineX] = useState<number | null>(null);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [audioWaveforms, setAudioWaveforms] = useState<{ [id: string]: string }>({});
  const [zoom, setZoom] = useState(20);
  const [trackHeights, setTrackHeights] = useState([60, 60, 60, 60, 60, 60, 60]);

  // Derive trackTops from trackHeights and RULER_HEIGHT
  const trackTops = useMemo(() => {
    const tops = [RULER_HEIGHT];
    let current = RULER_HEIGHT;
    for (let i = 0; i < trackHeights.length - 1; i++) {
      current += trackHeights[i];
      tops.push(current);
    }
    return tops;
  }, [trackHeights]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const clipsRef = useRef(clips);
  const durationRef = useRef(duration);
  const isDraggingRef = useRef(false); // true while user drags a clip on the timeline
  const renderFrameRef = useRef<((t: number) => void) | null>(null); // stable ref to latest renderFrameAtTime

  useEffect(() => { clipsRef.current = clips; }, [clips]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // --- 4. Media & Audio Management ---
  const { videoRefs, audioRefs, imageRefs } = useMediaManager(
    clips, currentTime, isPlaying, muteAudioTracks, soloTracks,
    isAutoFadeEnabled, isAutoFadeBgmEnabled, masterVolume,
    autoFadeDuration, bgmFadeOutDuration, isDraggingRef
  );

  // Revoke object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Electron-only: mount recent generated media from Downloads on startup.
  useEffect(() => {
    if (!(window as any).require) return;

    let isCancelled = false;
    const loadRecentDownloads = async () => {
      const filePaths = getRecentDownloadPaths();
      if (filePaths.length === 0) return;

      const nextAssets = await Promise.all(filePaths.map(async (filePath): Promise<Asset | null> => {
        const type = getMediaType(filePath);
        if (!type) return null;

        const url = getFileUrl(filePath);
        const metadata = await probeMedia(url, type);
        const name = filePath.split(/[\\/]/).pop() || filePath;

        return {
          id: `download_${filePath}`,
          name,
          type,
          url,
          duration: metadata.duration,
          thumbnail: type === 'image' ? url : '',
          isLocal: true,
          width: metadata.width,
          height: metadata.height,
          aspectRatio: metadata.aspectRatio,
          path: filePath
        } satisfies Asset;
      }));

      if (isCancelled) return;
      const validAssets = nextAssets.filter((asset): asset is Asset => Boolean(asset));
      setAssets(prev => {
        const existingPaths = new Set(prev.map(asset => asset.path).filter(Boolean));
        const fresh = validAssets.filter(asset => !existingPaths.has(asset.path));
        return fresh.length > 0 ? [...fresh, ...prev] : prev;
      });
    };

    loadRecentDownloads();
    return () => { isCancelled = true; };
  }, [setAssets]);

  // Waveform Generation
  useEffect(() => {
    clips.forEach(async clip => {
      if ((clip.type === 'audio' || clip.type === 'video') && !audioWaveforms[clip.id]) {
        try {
          const data = await getWaveformData(clip.url, 100);
          const img = generateWaveformImage(data);
          setAudioWaveforms(prev => ({ ...prev, [clip.id]: img }));
        } catch (e) { /* silent */ }
      }
    });
  }, [clips]); // audioWaveforms は prev => パターンで安全に更新しているため省略可

  // --- 5. Resize Handlers ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) setSidebarWidth(Math.max(200, Math.min(600, e.clientX)));
      else if (isResizingProperties) setPropertiesWidth(Math.max(200, Math.min(600, window.innerWidth - e.clientX)));
      else if (isResizingTimeline) setTimelineHeight(Math.max(150, Math.min(window.innerHeight - 100, window.innerHeight - e.clientY)));
    };
    const handleMouseUp = () => { setIsResizingSidebar(false); setIsResizingProperties(false); setIsResizingTimeline(false); };
    if (isResizingSidebar || isResizingProperties || isResizingTimeline) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizingSidebar, isResizingProperties, isResizingTimeline]);

  // --- 6. Rendering Logic ---
  // clipsRef is already declared above - renderFrameAtTime uses it to avoid re-creation during drag

  const renderFrameAtTime = useCallback(async (time: number, targetCanvas?: HTMLCanvasElement | OffscreenCanvas) => {
    const clips = clipsRef.current; // Always use latest clips without recreating callback
    const canvas = targetCanvas || canvasRef.current; if (!canvas) return;
    // OffscreenCanvas uses '2d' context directly (no DPR scaling needed)
    const isOffscreen = !(canvas instanceof HTMLCanvasElement);

    // --- PRE-SEEK PASS (for export only) ---
    if (isOffscreen) {
      const seekPromises: Promise<void>[] = [];
      for (const clip of clips) {
        if (hiddenTracks.includes(clip.track || 0)) continue;
        const media = videoRefs.current[clip.id];
        if (media && media instanceof HTMLVideoElement) {
          const speed = clip.speed || 1;
          const tStart = clip.trimStart || 0;
          const tEnd = clip.trimEnd || 0;
          const sTime = clip.startTime || 0;
          const clipDuration = Math.max(0.01, (tEnd - tStart) / speed);

          if (time >= sTime && time <= sTime + clipDuration) {
            const it = (time - sTime) * speed + tStart;
            const safeIt = Math.max(clip.trimStart || 0, Math.min(it, (clip.trimEnd || media.duration || 0) - 0.02));
            if (isFinite(safeIt) && safeIt >= 0) {
              if (Math.abs(media.currentTime - safeIt) > 0.05) {
                seekPromises.push(new Promise<void>(resolve => {
                  let isResolved = false;
                  const handler = () => {
                    if (isResolved) return;
                    isResolved = true;
                    media.removeEventListener('seeked', handler);
                    resolve();
                  };
                  setTimeout(handler, 1000); // fallback timeout
                  media.addEventListener('seeked', handler);
                  media.currentTime = safeIt;
                }));
              }
            }
          }
        }
      }
      if (seekPromises.length > 0) {
        await Promise.all(seekPromises);
      }
    }
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return;

    const dpr = isOffscreen ? 1 : (window.devicePixelRatio || 1);
    const viewWidth = canvas.width / dpr;
    const viewHeight = canvas.height / dpr;

    // Clear background
    if (!isOffscreen) {
      (ctx as CanvasRenderingContext2D).setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    const sortedClips = [...clips].sort((a, b) => (a.track || 0) - (b.track || 0));
    for (const clip of sortedClips) {
      if (hiddenTracks.includes(clip.track || 0)) continue;

      const speed = clip.speed || 1;
      const tStart = clip.trimStart || 0;
      const tEnd = clip.trimEnd || 0;
      const sTime = clip.startTime || 0;

      const clipDuration = Math.max(0.01, (tEnd - tStart) / speed);

      if (time >= sTime && time <= sTime + clipDuration) {
        const it = (time - sTime) * speed + tStart;

        const curX = getInterpolatedValue(clip.keyframes?.x, clip.x ?? 0, it) || 0;
        const curY = getInterpolatedValue(clip.keyframes?.y, clip.y ?? 0, it) || 0;
        const curScale = getInterpolatedValue(clip.keyframes?.scale, clip.scale ?? 1, it) || 1;
        const curRotation = getInterpolatedValue(clip.keyframes?.rotation, clip.rotation ?? 0, it) || 0;
        const curOpacity = getInterpolatedValue(clip.keyframes?.opacity, clip.opacity ?? 1, it) ?? 1;

        // --- Auto X (Crossfade) Logic ---
        let autoXOpacity = 1;
        if (isAutoXEnabled && (clip.track || 0) <= 2) { // Only apply to Video/Text tracks
          const clipEnd = sTime + clipDuration;
          const overlappingAtStart = clips
            .filter(c => c.id !== clip.id && (c.track || 0) <= 2)
            .map(c => ({
              start: c.startTime || 0,
              end: (c.startTime || 0) + (Math.max(0, (c.trimEnd || 0) - (c.trimStart || 0)) / (c.speed || 1))
            }))
            .filter(c => c.start < sTime && c.end > sTime);

          if (overlappingAtStart.length > 0) {
            const latestPrevEnd = Math.max(...overlappingAtStart.map(c => c.end));
            const overlapDuration = latestPrevEnd - sTime;
            if (time < latestPrevEnd && overlapDuration > 0) {
              autoXOpacity *= Math.max(0, Math.min(1, (time - sTime) / overlapDuration));
            }
          }

          const overlappingAtEnd = clips
            .filter(c => c.id !== clip.id && (c.track || 0) <= 2)
            .map(c => ({
              start: c.startTime || 0,
              end: (c.startTime || 0) + (Math.max(0, (c.trimEnd || 0) - (c.trimStart || 0)) / (c.speed || 1))
            }))
            .filter(c => c.start < clipEnd && c.end > clipEnd);

          if (overlappingAtEnd.length > 0) {
            const earliestNextStart = Math.min(...overlappingAtEnd.map(c => c.start));
            const overlapDuration = clipEnd - earliestNextStart;
            if (time > earliestNextStart && overlapDuration > 0) {
              autoXOpacity *= Math.max(0, Math.min(1, (clipEnd - time) / overlapDuration));
            }
          }
        }

        ctx.save();
        const finalAlpha = (isNaN(curOpacity) ? 1 : curOpacity) * (isNaN(autoXOpacity) ? 1 : autoXOpacity);
        ctx.globalAlpha = Math.max(0, Math.min(1, finalAlpha));
        ctx.translate(viewWidth / 2 + curX, viewHeight / 2 + curY);
        ctx.rotate((curRotation * Math.PI) / 180);
        ctx.scale(curScale, curScale);

        if (clip.type === 'text') {
          ctx.font = `${clip.fontSize || 40}px 'Inter', sans-serif`;
          ctx.fillStyle = clip.color || '#ffffff';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(clip.text || 'Text', 0, 0);
        } else {
          const media = videoRefs.current[clip.id] || imageRefs.current[clip.id];
          if (media) {
            let mediaW = 0, mediaH = 0;
            if (media instanceof HTMLVideoElement) {
              mediaW = media.videoWidth; mediaH = media.videoHeight;
              // During preview, seek only when paused and not dragging.
              // During export (isOffscreen=true), the video was already seeked in the pre-pass.
              if (!isOffscreen && !isPlaying && !isDraggingRef.current) {
                const safeIt = Math.max(clip.trimStart || 0, Math.min(it, (clip.trimEnd || media.duration || 0) - 0.02));
                if (isFinite(safeIt) && safeIt >= 0) media.currentTime = safeIt;
              }
            } else if (media instanceof HTMLImageElement) {
              mediaW = media.width; mediaH = media.height;
            }
            if (mediaW > 0 && mediaH > 0) {
              const aspect = mediaW / mediaH;
              let targetW = viewWidth, targetH = viewWidth / aspect;
              if (targetH > viewHeight) { targetH = viewHeight; targetW = viewHeight * aspect; }

              // Apply Color filters
              const b = getInterpolatedValue(clip.keyframes?.brightness, clip.brightness ?? 1, it);
              const c = getInterpolatedValue(clip.keyframes?.contrast, clip.contrast ?? 1, it);
              const s = getInterpolatedValue(clip.keyframes?.saturation, clip.saturation ?? 1, it);
              ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;

              try {
                ctx.drawImage(media, -targetW / 2, -targetH / 2, targetW, targetH);

                // Temp/Tint Overlays
                const temp = getInterpolatedValue(clip.keyframes?.temperature, clip.temperature ?? 0, it);
                const tint = getInterpolatedValue(clip.keyframes?.tint, clip.tint ?? 0, it);
                if (temp !== 0 || tint !== 0) {
                  ctx.save();
                  ctx.globalCompositeOperation = 'overlay';
                  if (temp !== 0) {
                    ctx.fillStyle = temp > 0 ? `rgba(255, 120, 0, ${Math.abs(temp) / 200})` : `rgba(0, 100, 255, ${Math.abs(temp) / 200})`;
                    ctx.fillRect(-targetW / 2, -targetH / 2, targetW, targetH);
                  }
                  if (tint !== 0) {
                    ctx.fillStyle = tint > 0 ? `rgba(255, 0, 255, ${Math.abs(tint) / 300})` : `rgba(0, 255, 0, ${Math.abs(tint) / 300})`;
                    ctx.fillRect(-targetW / 2, -targetH / 2, targetW, targetH);
                  }
                  ctx.restore();
                }
              } catch (_) { }
              ctx.filter = 'none';
            }
          }
        }
        ctx.restore();
      }
    }

    // --- Film Grain (global, non-destructive overlay) ---
    if (filmGrain !== 'off') {
      applyFilmGrain(ctx as any, viewWidth, viewHeight, filmGrain);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRefs, imageRefs, hiddenTracks, isPlaying, filmGrain]); // clips intentionally excluded - use clipsRef instead

  // Keep renderFrameRef always pointing to the latest renderFrameAtTime
  // so the RAF loop never needs to restart when the callback changes.
  useEffect(() => { renderFrameRef.current = renderFrameAtTime; }, [renderFrameAtTime]);

  // RAF loop: only restarts when isPlaying changes (never on currentTime/clips).
  // When paused, a single one-shot render runs; further renders are triggered
  // by the currentTime watcher below.
  useEffect(() => {
    if (!isPlaying) {
      renderFrameRef.current?.(currentTimeRef.current);
      return;
    }
    let rafId: number;
    const loop = () => {
      renderFrameRef.current?.(currentTimeRef.current);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // While paused, re-render whenever currentTime changes (scrubbing / clip drag end).
  // This is intentionally separate so it never restarts the RAF loop above.
  useEffect(() => {
    if (!isPlaying) {
      renderFrameRef.current?.(currentTime);
    }
  }, [currentTime, isPlaying]);

  // --- 7. Timeline Feature Handlers ---
  const splitClipsAtPlayhead = useCallback(() => {
    pushToHistory();
    const newClips: VideoClip[] = [];
    clips.forEach(clip => {
      const isSelected = selectedClipIds.includes(clip.id);
      const splitPoint = currentTime - clip.startTime;
      const duration = (clip.trimEnd - clip.trimStart) / clip.speed;
      if ((isSelected || selectedClipIds.length === 0) && splitPoint > 0.1 && splitPoint < duration - 0.1) {
        const splitBufferTime = splitPoint * clip.speed + clip.trimStart;
        const clip1 = { ...clip, id: `${clip.id}_1`, trimEnd: splitBufferTime };
        const clip2 = { ...clip, id: `${clip.id}_2`, startTime: currentTime, trimStart: splitBufferTime };
        newClips.push(clip1, clip2);
      } else newClips.push(clip);
    });
    setClips(newClips);
  }, [clips, selectedClipIds, currentTime, pushToHistory, setClips]);

  const addTextToTimeline = useCallback(() => {
    pushToHistory();
    const newId = `text_${Date.now()}`;
    const newClip: VideoClip = {
      id: newId, assetId: 'text', name: 'Text Layer', type: 'text', startTime: currentTime,
      trimStart: 0, trimEnd: 5, track: 0, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1,
      speed: 1, volume: 0, keyframes: {}, text: 'DOUBLE CLICK TO EDIT', fontSize: 60, color: '#ffffff'
    };
    setClips(prev => [...prev, newClip]);
    setSelectedClipIds([newId]);
  }, [currentTime, pushToHistory, setClips, setSelectedClipIds]);

  const detachAudio = useCallback(() => {
    if (selectedClipIds.length === 0) return;
    pushToHistory();

    const newAudioClips: VideoClip[] = [];
    setClips(prev => {
      const updated = prev.map(clip => {
        if (!selectedClipIds.includes(clip.id) || clip.type !== 'video') return clip;

        const audioId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        // Mapping: V1(0)->A1(3), V2(1)->A2(4), V3(2)->A3(5). Others go to Track 6 (BGM)
        const targetTrack = clip.track <= 2 ? (clip.track + 3) : 6;

        newAudioClips.push({
          ...clip,
          id: audioId,
          type: 'audio',
          track: targetTrack,
          volume: 1,
          name: `${clip.name} (Audio)`,
          keyframes: {}
        });

        return { ...clip, volume: 0 };
      });
      return [...updated, ...newAudioClips];
    });
  }, [selectedClipIds, clips, pushToHistory, setClips]);

  const processFiles = useCallback((files: FileList | File[], options: { track?: number, time?: number, addToTimeline?: boolean } = {}) => {
    const { track: targetTrack, time: startTime, addToTimeline = false } = options;
    pushToHistory();
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      // メモリリーク防止のため object URL を記録する
      objectUrlsRef.current.push(url);

      const isVideo = file.type.startsWith('video'); const isAudio = file.type.startsWith('audio');
      const filePath = (file as any).path || '';
      const tempMedia = isVideo ? document.createElement('video') : isAudio ? new Audio() : new Image();
      tempMedia.src = url;
      const onLoad = () => {
        let dur = 5; if (tempMedia instanceof HTMLMediaElement) dur = tempMedia.duration;
        const assetId = `asset_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        setAssets(prev => [{ id: assetId, name: file.name, type: isVideo ? 'video' : isAudio ? 'audio' : 'image', url, duration: dur, thumbnail: isVideo || isAudio ? '' : url, path: filePath }, ...prev]);

        if (addToTimeline) {
          setClips(prev => [...prev, {
            id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            assetId, name: file.name, type: isVideo ? 'video' : isAudio ? 'audio' : 'image', url,
            startTime: startTime ?? currentTime, trimStart: 0, trimEnd: dur, track: targetTrack ?? (isVideo ? 0 : isAudio ? 3 : 0),
            x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, speed: 1, volume: 1, keyframes: {}, path: filePath
          }]);
        }
      };
      if (tempMedia instanceof HTMLMediaElement) tempMedia.onloadedmetadata = onLoad; else tempMedia.onload = onLoad;
    });
  }, [pushToHistory, currentTime, setAssets, setClips]);

  // --- 8. Export ---
  const handleExport = useCallback(async () => {
    if (clips.length === 0) { alert("タイムラインが空です"); return; }
    setIsExporting(true); setGenerationProgress(0);
    const controller = new AbortController(); abortControllerRef.current = controller;

    // Dummy canvas to carry the aspect-ratio info to renderTimeline.
    // The actual rendering goes to the OffscreenCanvas created inside renderTimeline.
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = aspectRatio === '9:16' ? 1080 : 1920;
    exportCanvas.height = aspectRatio === '9:16' ? 1920 : 1080;

    try {
      const blob = await renderTimeline(
        clips, exportCanvas,
        (p) => setGenerationProgress(p),
        (t, offscreen) => renderFrameAtTime(t, offscreen ?? exportCanvas),
        controller.signal
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName || 'project'}_export.mp4`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setHistory(prev => [{ id: `export_${Date.now()}`, name: `Export: ${projectName}`, timestamp: new Date().toISOString(), prompt: 'Export', resultUrl: url, duration, type: 'export', isGenerated: true }, ...prev]);
    } catch (err: any) {
      if (err.message !== "Export cancelled") alert("Export failed: " + err.message);
    } finally {
      setIsExporting(false); abortControllerRef.current = null;
    }
  }, [clips, projectName, duration, aspectRatio, renderFrameAtTime, setHistory]);

  const handleExportClip = useCallback(async (clipToExport: VideoClip) => {
    setIsExporting(true); setGenerationProgress(0);
    const controller = new AbortController(); abortControllerRef.current = controller;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = aspectRatio === '9:16' ? 1080 : 1920;
    exportCanvas.height = aspectRatio === '9:16' ? 1920 : 1080;

    // Normalize clip to start at 0
    const normalizedClip = { ...clipToExport, startTime: 0 };
    const tempClips = [normalizedClip];

    // Temporarily override the clip reference used by renderFrameAtTime
    const originalClips = clipsRef.current;
    clipsRef.current = tempClips;

    try {
      const blob = await renderTimeline(
        tempClips, exportCanvas,
        (p) => setGenerationProgress(p),
        (t, offscreen) => renderFrameAtTime(t, offscreen ?? exportCanvas),
        controller.signal
      );
      clipsRef.current = originalClips; // Restore

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = clipToExport.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${safeName}_edited.mp4`;
      link.click();

      // Add to assets so it can be reused immediately
      const assetDur = (clipToExport.trimEnd - clipToExport.trimStart) / clipToExport.speed;
      const newAssetId = `asset_${Date.now()}`;
      setAssets(prev => [{
        id: newAssetId,
        name: `${clipToExport.name} (Edited)`,
        type: 'video',
        url,
        duration: assetDur,
        thumbnail: '',
        isGenerated: false
      }, ...prev]);
    } catch (err: any) {
      clipsRef.current = originalClips; // Restore on error
      if (err.message !== "Export cancelled") alert("Clip Export failed: " + err.message);
    } finally {
      setIsExporting(false); abortControllerRef.current = null;
    }
  }, [aspectRatio, renderFrameAtTime, setAssets, clips]);

  // --- 9. Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const isMod = e.metaKey || e.ctrlKey;

      // Playback Control (Space / H)
      if (e.key === ' ') { e.preventDefault(); togglePlayback(); return; }
      if (!isMod && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); setCurrentTime(0); return; }

      // Copy / Paste (Cmd+C / Cmd+V)
      if (isMod && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); handleCopy(); return; }
      if (isMod && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); handlePaste(currentTimeRef.current); return; }

      // Undo / Redo (Cmd+Z / Cmd+Shift+Z)
      if (isMod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }

      // Export (Cmd+O)
      if (isMod && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); handleExport(); return; }

      // Split at playhead (S or C key, no modifier)
      if (!isMod && (e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C')) { splitClipsAtPlayhead(); return; }

      // Switch to select tool (V key)
      if (!isMod && (e.key === 'v' || e.key === 'V')) { setIsSplitMode(false); return; }

      // Delete selected clips
      if (e.key === 'Backspace' || e.key === 'Delete') { deleteSelectedClips(); return; }

      // Frame-by-frame / 1s scrub
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        setCurrentTime(prev => Math.max(0, Math.min(durationRef.current, prev + (e.key === 'ArrowRight' ? (e.shiftKey ? 1 : 1 / 30) : (e.shiftKey ? -1 : -1 / 30)))));
      }

      // Zoom (W/E keys)
      if (!isMod && (e.key === 'w' || e.key === 'W')) { setZoom(prev => Math.max(10, prev - 10)); return; }
      if (!isMod && (e.key === 'e' || e.key === 'E')) { setZoom(prev => Math.min(500, prev + 10)); return; }

      // Copy/Paste Attributes: 1 / 2 (User preference to avoid confusion with C/V)
      if (!isMod && e.key === '1') { e.preventDefault(); handleCopyAttributes(); return; }
      if (!isMod && e.key === '2') { e.preventDefault(); handlePasteAttributes(); return; }

      // Toggle Group: G
      if (!isMod && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); toggleGroup(); return; }

      // Jump to Edit Points (Up/Down keys)
      const getEditPoints = () => {
        const pts = new Set<number>([0, durationRef.current]);
        clipsRef.current.forEach(c => {
          pts.add(c.startTime);
          pts.add(c.startTime + (c.trimEnd - c.trimStart) / c.speed);
        });
        return Array.from(pts).sort((a, b) => a - b);
      };


      if (!isMod && (e.key === 'r' || e.key === 'R' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const pts = getEditPoints();
        const prev = [...pts].reverse().find(p => p < currentTimeRef.current - 0.1);
        if (prev !== undefined) setCurrentTime(prev);
        return;
      }
      if (!isMod && (e.key === 't' || e.key === 'T' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const pts = getEditPoints();
        const next = pts.find(p => p > currentTimeRef.current + 0.1);
        if (next !== undefined) setCurrentTime(next);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, splitClipsAtPlayhead, deleteSelectedClips, handleExport, handleCopy, handlePaste, handleCopyAttributes, handlePasteAttributes, setZoom, setTrackHeights, togglePlayback]);

  // --- 10. Selected clip (null-safe) ---
  const selectedClip = clips.find(c => c.id === selectedClipIds[0]) ?? null;

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-zinc-300 font-sans overflow-hidden">
      <GlobalHeader
        projectName={projectName} setProjectName={setProjectName} onExport={handleExport}
        onSaveProject={() => { }} onLoadProject={() => { }} isExporting={isExporting} exportProgress={generationProgress}
        onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
        filmGrain={filmGrain} setFilmGrain={setFilmGrain}
      />
      <div className="flex-1 flex min-h-0 relative">
        <SharedSidebar
          assets={assets} selectedAssetIds={selectedAssetIds} setSelectedAssetIds={setSelectedAssetIds} history={history}
          handleFileUpload={(e: React.ChangeEvent<HTMLInputElement>) => processFiles(e.target.files || [], { addToTimeline: false })}
          processFiles={(files: File[]) => processFiles(files, { addToTimeline: false })}
          addTextToTimeline={addTextToTimeline} width={sidebarWidth}
          onDeleteAsset={(id) => setAssets(prev => prev.filter(a => a.id !== id))}
          onExtractFrame={(asset) => setExtractingMedia({ url: asset.url, name: asset.name })}
          onDeleteHistory={(id) => setHistory(prev => prev.filter(h => h.id !== id))} sidebarTab={activeTab} onSidebarTabChange={setActiveTab}
        />
        <div className="w-1 hover:w-1.5 bg-white/5 hover:bg-blue-500/50 cursor-col-resize z-50 transition-all" onMouseDown={() => setIsResizingSidebar(true)} />
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          <div className="flex-1 flex overflow-hidden relative">
            <PreviewSection
              canvasRef={canvasRef} aspectRatio={aspectRatio} currentTime={currentTime} isPlaying={isPlaying}
              playbackRate={playbackRate} masterVolume={masterVolume} duration={duration} setIsPlaying={setIsPlaying}
              togglePlayback={togglePlayback}
              setCurrentTime={setCurrentTime} setPlaybackRate={setPlaybackRate} clips={clips}
              selectedClipIds={selectedClipIds}
              lowQualityPreview={lowQualityPreview} setLowQualityPreview={setLowQualityPreview}
              updateClipProp={(id, p, v) => {
                setClips(prev => prev.map(c => {
                  if (c.id !== id) return c;
                  const internalTime = (currentTime - c.startTime) * c.speed + c.trimStart;
                  const kfs = (c.keyframes as any)?.[p] || [];
                  if (kfs.length > 0) {
                    const newKfs = [...kfs];
                    const idx = newKfs.findIndex(k => Math.abs(k.time - internalTime) < 0.01);
                    if (idx >= 0) newKfs[idx] = { ...newKfs[idx], value: v };
                    else newKfs.push({ time: internalTime, value: v });
                    return { ...c, keyframes: { ...c.keyframes, [p]: newKfs.sort((a, b) => a.time - b.time) } };
                  }
                  return { ...c, [p]: v };
                }));
              }}
            />
            <div className="w-1 hover:w-1.5 bg-white/5 hover:bg-blue-500/50 cursor-col-resize z-50 transition-all" onMouseDown={() => setIsResizingProperties(true)} />
            <div style={{ width: propertiesWidth }} className="border-l border-white/5 bg-[#0f0f0f] overflow-y-auto">
              {/* Fix: null-safe check instead of non-null assertion */}
              {selectedClipIds.length === 1 && selectedClip ? (
                <div className="p-6">
                  <PropertiesPanel
                    clip={selectedClip}
                    updateClipProp={(p, v) => {
                      setClips(prev => prev.map(c => {
                        if (c.id !== selectedClipIds[0]) return c;
                        // If keyframes exist for this property, update/add keyframe at current time
                        const internalTime = (currentTime - c.startTime) * c.speed + c.trimStart;
                        const kfs = (c.keyframes as any)?.[p] || [];
                        if (kfs.length > 0) {
                          const newKfs = [...kfs];
                          const idx = newKfs.findIndex(k => Math.abs(k.time - internalTime) < 0.01);
                          if (idx >= 0) newKfs[idx] = { ...newKfs[idx], value: v };
                          else newKfs.push({ time: internalTime, value: v });
                          return { ...c, keyframes: { ...c.keyframes, [p]: newKfs.sort((a, b) => a.time - b.time) } };
                        }
                        return { ...c, [p]: v };
                      }));
                    }}
                    togglePropKeyframes={(p) => {
                      pushToHistory();
                      setClips(prev => prev.map(c => {
                        if (c.id !== selectedClipIds[0]) return c;
                        const currentKfs = (c.keyframes as any)?.[p] || [];
                        if (currentKfs.length > 0) {
                          // Disable: remove keyframes for this property
                          const { [p]: _, ...rest } = c.keyframes as any;
                          return { ...c, keyframes: rest };
                        } else {
                          // Enable: add current value as first keyframe
                          const internalTime = (currentTime - c.startTime) * c.speed + c.trimStart;
                          const val = (c as any)[p] ?? (p === 'scale' || p === 'opacity' || p === 'brightness' || p === 'contrast' || p === 'saturation' ? 1 : 0);
                          return { ...c, keyframes: { ...c.keyframes, [p]: [{ time: internalTime, value: val }] } };
                        }
                      }));
                    }}
                    resetClipProps={(props) => {
                      pushToHistory();
                      setClips(prev => prev.map(c => {
                        if (c.id !== selectedClipIds[0]) return c;
                        const newProps: any = {};
                        props.forEach(p => {
                          newProps[p] = (p === 'scale' || p === 'opacity' || p === 'brightness' || p === 'contrast' || p === 'saturation') ? 1 : 0;
                        });
                        return { ...c, ...newProps };
                      }));
                    }}
                    currentTime={currentTime}
                    setCurrentTime={setCurrentTime}
                    removeKeyframe={removeKeyframe}
                  />
                </div>
              ) : (
                <div className="h-full min-h-[320px] flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
                    <span className="text-zinc-500 text-lg font-black">I</span>
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Inspector</h2>
                  <p className="mt-3 max-w-[220px] text-[11px] leading-relaxed text-zinc-600">
                    Select one clip to adjust transform, timing, color, audio, and keyframes.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="h-1 hover:h-1.5 bg-white/5 hover:bg-blue-500/50 cursor-row-resize z-50 transition-all" onMouseDown={() => setIsResizingTimeline(true)} />
          <Timeline
            clips={clips} assets={assets} history={history} setClips={setClips} currentTime={currentTime} setCurrentTime={setCurrentTime}
            updateClipProp={(id, p, v) => setClips(prev => prev.map(c => c.id === id ? { ...c, [p]: v } : c))}
            zoom={zoom} setZoom={setZoom} duration={duration} trackHeights={trackHeights} trackTops={trackTops}
            isSnapEnabled={isSnapEnabled} setIsSnapEnabled={setIsSnapEnabled} snapLineX={snapLineX} setSnapLineX={setSnapLineX}
            selectedClipIds={selectedClipIds} setSelectedClipIds={setSelectedClipIds} isPlaying={isPlaying} setIsPlaying={setIsPlaying}
            playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} isSplitMode={isSplitMode}
            setIsSplitMode={setIsSplitMode} isAutoXEnabled={isAutoXEnabled} setIsAutoXEnabled={setIsAutoXEnabled} isAutoFadeEnabled={isAutoFadeEnabled}
            setIsAutoFadeEnabled={setIsAutoFadeEnabled} isAutoFadeBgmEnabled={isAutoFadeBgmEnabled} setIsAutoFadeBgmEnabled={setIsAutoFadeBgmEnabled}
            deleteSelectedClips={deleteSelectedClips} rippleDelete={rippleDelete} splitClipsAtPlayhead={splitClipsAtPlayhead} detachAudio={detachAudio} timelineHeight={timelineHeight}
            audioWaveforms={audioWaveforms} expandedClipIds={expandedClipIds} setExpandedClipIds={setExpandedClipIds}
            hiddenTracks={hiddenTracks} setHiddenTracks={setHiddenTracks} soloTracks={soloTracks} setSoloTracks={setSoloTracks}
            muteAudioTracks={muteAudioTracks} setMuteAudioTracks={setMuteAudioTracks}
            processFiles={(files, track, time, add) => processFiles(files, { track, time, addToTimeline: add })}
            onExtractFrame={(clip) => setExtractingMedia({ url: clip.url, name: clip.name, seekTime: clip.trimEnd })}
            onExportClip={handleExportClip}
            onDragStart={() => { isDraggingRef.current = true; }}
            onDragEnd={() => { isDraggingRef.current = false; }}
            autoFadeDuration={autoFadeDuration} setAutoFadeDuration={setAutoFadeDuration} bgmFadeOutDuration={bgmFadeOutDuration} setBgmFadeOutDuration={setBgmFadeOutDuration}
          />
        </div>
      </div>
      {isExporting && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-8 p-12 bg-[#111] border border-white/10 rounded-[40px] shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="96" cy="96" r="88" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
                <circle cx="96" cy="96" r="88" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray={552} strokeDashoffset={552 - (552 * generationProgress) / 100} strokeLinecap="round"
                  className="text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                />
              </svg>
              <span className="absolute text-5xl font-black text-white">{Math.round(generationProgress)}%</span>
            </div>
            <h2 className="text-xl font-black uppercase tracking-[0.4em] text-blue-400">Rendering Video...</h2>
            <button onClick={() => abortControllerRef.current?.abort()} className="px-10 py-4 bg-zinc-900 hover:bg-red-600 text-zinc-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all">Cancel Export</button>
          </div>
        </div>
      )}
      {extractingMedia && (
        <FrameExtractorModal
          videoUrl={extractingMedia.url}
          videoName={extractingMedia.name}
          initialSeekTime={extractingMedia.seekTime}
          onClose={() => setExtractingMedia(null)}
        />
      )}
    </div>
  );
}
