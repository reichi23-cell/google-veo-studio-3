import { useState, useCallback, useEffect } from 'react';
import { Asset, HistoryItem, VideoClip } from '../types';

export function useEditorState() {
  const [projectName, setProjectName] = useState('Google Veo Project');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [duration, setDuration] = useState(60);
  
  const [historyStack, setHistoryStack] = useState<VideoClip[][]>([]);
  const [redoStack, setRedoStack] = useState<VideoClip[][]>([]);
  const [clipboard, setClipboard] = useState<VideoClip[]>([]);

  const [attributeClipboard, setAttributeClipboard] = useState<Partial<VideoClip> | null>(null);

  const pushToHistory = useCallback(() => {
    setHistoryStack(prev => [...prev, [...clips]]);
    setRedoStack([]);
  }, [clips]);

  const undo = useCallback(() => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setRedoStack(prevRedo => [...prevRedo, [...clips]]);
    setClips(prev);
    setHistoryStack(prevStack => prevStack.slice(0, -1));
  }, [historyStack, clips]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistoryStack(prevHistory => [...prevHistory, [...clips]]);
    setClips(next);
    setRedoStack(prevStack => prevStack.slice(0, -1));
  }, [redoStack, clips]);

  const deleteSelectedClips = useCallback(() => {
    if (selectedClipIds.length > 0) {
      pushToHistory();
      setClips(prev => prev.filter(c => !selectedClipIds.includes(c.id)));
      setSelectedClipIds([]);
    }
  }, [selectedClipIds, pushToHistory]);

  const rippleDelete = useCallback(() => {
    if (selectedClipIds.length === 0) return;
    pushToHistory();

    const clipsToDelete = clips.filter(c => selectedClipIds.includes(c.id));
    
    // Process each track independently for ripple
    const affectedTracks = Array.from(new Set(clipsToDelete.map(c => c.track)));
    
    let nextClips = [...clips].filter(c => !selectedClipIds.includes(c.id));

    affectedTracks.forEach(trackId => {
      const trackClipsToDelete = clipsToDelete.filter(c => c.track === trackId).sort((a, b) => a.startTime - b.startTime);
      
      // Calculate shifts for this track
      // We process from the earliest deletion to latest to handle multiple gaps
      trackClipsToDelete.reverse().forEach(deletedClip => {
        const deletedDuration = (deletedClip.trimEnd - deletedClip.trimStart) / deletedClip.speed;
        const deletedStartTime = deletedClip.startTime;

        nextClips = nextClips.map(c => {
          if (c.track === trackId && c.startTime > deletedStartTime) {
            return { ...c, startTime: Math.max(0, c.startTime - deletedDuration) };
          }
          return c;
        });
      });
    });

    setClips(nextClips);
    setSelectedClipIds([]);
  }, [clips, selectedClipIds, pushToHistory]);

  const removeKeyframe = useCallback((clipId: string, prop: string, time: number) => {
    pushToHistory();
    setClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      const kfs = (c.keyframes as any)?.[prop] || [];
      const newKfs = kfs.filter((k: any) => Math.abs(k.time - time) > 0.01);
      return { ...c, keyframes: { ...c.keyframes, [prop]: newKfs } };
    }));
  }, [pushToHistory]);

  const handleCopy = useCallback(() => {
    if (selectedClipIds.length === 0) return;
    setClipboard(clips.filter(c => selectedClipIds.includes(c.id)));
  }, [clips, selectedClipIds]);

  const handlePaste = useCallback((currentTime: number) => {
    if (clipboard.length === 0) return;
    pushToHistory();
    const minStart = Math.min(...clipboard.map(c => c.startTime));
    const newGid = clipboard.some(c => c.groupId) ? `group-${Math.random().toString(36).substr(2, 9)}` : undefined;
    const pasted = clipboard.map(c => ({
      ...c,
      id: `clip-${Math.random().toString(36).substr(2, 9)}`,
      startTime: currentTime + (c.startTime - minStart),
      groupId: c.groupId ? newGid : undefined
    }));
    setClips(prev => [...prev, ...pasted]);
    setSelectedClipIds(pasted.map(p => p.id));
  }, [clipboard, pushToHistory, setClips, setSelectedClipIds]);

  const handleCopyAttributes = useCallback(() => {
    const id = selectedClipIds[0];
    const clip = clips.find(c => c.id === id);
    if (!clip) return;
    
    const attrs: Partial<VideoClip> = {
      x: clip.x, y: clip.y, scale: clip.scale, rotation: clip.rotation, opacity: clip.opacity,
      brightness: clip.brightness, contrast: clip.contrast, saturation: clip.saturation,
      temperature: clip.temperature, tint: clip.tint,
      keyframes: JSON.parse(JSON.stringify(clip.keyframes || {}))
    };
    setAttributeClipboard(attrs);
  }, [selectedClipIds, clips]);

  const toggleGroup = useCallback(() => {
    if (selectedClipIds.length < 2) {
      // If only one clip is selected and it's in a group, we might want to ungroup just that one or the whole group.
      // Usually, 'G' on a single clip in a group ungroups the whole group.
      if (selectedClipIds.length === 1) {
        const clip = clips.find(c => c.id === selectedClipIds[0]);
        if (clip?.groupId) {
          pushToHistory();
          const gid = clip.groupId;
          setClips(prev => prev.map(c => c.groupId === gid ? { ...c, groupId: undefined } : c));
        }
      }
      return;
    }

    pushToHistory();
    const selectedClips = clips.filter(c => selectedClipIds.includes(c.id));
    const allSameGroup = selectedClips.every(c => c.groupId && c.groupId === selectedClips[0].groupId);

    if (allSameGroup) {
      // Ungroup
      setClips(prev => prev.map(c => selectedClipIds.includes(c.id) ? { ...c, groupId: undefined } : c));
    } else {
      // Group
      const newGroupId = `group-${Math.random().toString(36).substr(2, 9)}`;
      setClips(prev => prev.map(c => selectedClipIds.includes(c.id) ? { ...c, groupId: newGroupId } : c));
    }
  }, [clips, selectedClipIds, pushToHistory]);

  const handlePasteAttributes = useCallback(() => {
    if (!attributeClipboard || selectedClipIds.length === 0) return;
    pushToHistory();
    setClips(prev => prev.map(c => {
      if (selectedClipIds.includes(c.id)) {
        return {
          ...c,
          ...attributeClipboard,
          keyframes: JSON.parse(JSON.stringify(attributeClipboard.keyframes || {}))
        };
      }
      return c;
    }));
  }, [attributeClipboard, selectedClipIds, pushToHistory, setClips]);

  // Auto-calculate duration
  useEffect(() => {
    if (clips.length > 0) {
      const maxTime = Math.max(...clips.map(c => {
        const clipDur = ((c.trimEnd || 0) - (c.trimStart || 0)) / (c.speed || 1);
        return (c.startTime || 0) + clipDur;
      }));
      setDuration(Math.max(60, Math.ceil(maxTime / 10) * 10 + 20));
    }
  }, [clips]);

  return {
    projectName, setProjectName,
    aspectRatio, setAspectRatio,
    assets, setAssets,
    clips, setClips,
    history, setHistory,
    selectedClipIds, setSelectedClipIds,
    selectedAssetIds, setSelectedAssetIds,
    duration, setDuration,
    undo, redo, pushToHistory, deleteSelectedClips, toggleGroup, rippleDelete, removeKeyframe,
    handleCopy, handlePaste,
    handleCopyAttributes, handlePasteAttributes,
    canUndo: historyStack.length > 0,
    canRedo: redoStack.length > 0
  };
}
