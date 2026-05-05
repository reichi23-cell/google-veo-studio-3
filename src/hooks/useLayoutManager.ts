import { useState, useMemo, useEffect } from 'react';
import { VideoClip } from '../types';
import { RULER_HEIGHT, TRACK_HEIGHT_BASE, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, MIN_PROPERTIES_WIDTH, MAX_PROPERTIES_WIDTH, MIN_TIMELINE_HEIGHT } from '../constants/layout';

export function useLayoutManager(clips: VideoClip[], expandedClipIds: string[]) {
  const [timelineHeight, setTimelineHeight] = useState(384);
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [propertiesWidth, setPropertiesWidth] = useState(320);
  const [zoom, setZoom] = useState(50);

  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingProperties, setIsResizingProperties] = useState(false);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);

  const trackHeights = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map(t => {
      const isExpanded = expandedClipIds.some(id => clips.find(c => c.id === id)?.track === t);
      return isExpanded ? 128 : TRACK_HEIGHT_BASE;
    });
  }, [expandedClipIds, clips]);

  const trackTops = useMemo(() => {
    let currentTop = RULER_HEIGHT;
    return [0, 1, 2, 3, 4, 5, 6, 7].map((t, i) => {
      const top = currentTop;
      if (i < 7) currentTop += trackHeights[i];
      return top;
    });
  }, [trackHeights]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingTimeline) {
        const delta = window.innerHeight - e.clientY;
        setTimelineHeight(Math.max(MIN_TIMELINE_HEIGHT, Math.min(window.innerHeight - 200, delta)));
      } else if (isResizingSidebar) {
        setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, e.clientX)));
      } else if (isResizingProperties) {
        setPropertiesWidth(Math.max(MIN_PROPERTIES_WIDTH, Math.min(MAX_PROPERTIES_WIDTH, window.innerWidth - e.clientX)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingProperties(false);
      setIsResizingTimeline(false);
    };

    if (isResizingSidebar || isResizingProperties || isResizingTimeline) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingProperties, isResizingTimeline]);

  return {
    timelineHeight, sidebarWidth, propertiesWidth, zoom, setZoom,
    trackHeights, trackTops,
    isResizingSidebar, setIsResizingSidebar,
    isResizingProperties, setIsResizingProperties,
    isResizingTimeline, setIsResizingTimeline
  };
}
