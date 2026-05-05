import fs from 'fs';

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// Use regex to be resilient to whitespace/line endings
content = content.replace(
    /const track = Math\.max\(0, Math\.min\(6, Math\.floor\(\(e\.clientY - rect\.top - 54\) \/ 64\)\)\);/,
    'const track = getTrackFromY(e.clientY - rect.top);'
);

content = content.replace(
    /top: \(clip\.track \|\| 0\) \* 64 \+ 54 \+ 4,/,
     'top: trackTops[clip.track] + 4,'
);

content = content.replace(
    /backgroundSize: `\${zoom}px 64px`/,
    'backgroundSize: `${zoom}px 100%`'
);

// Add viewport ID
if (!content.includes('id="timeline-viewport"')) {
    content = content.replace(
        /className="flex-1 overflow-auto relative select-none custom-scrollbar"/,
        'id="timeline-viewport" className="flex-1 overflow-auto relative select-none custom-scrollbar"'
    );
}

const newGrid = `                       <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
                           {[0, 1, 2, 3, 4, 5, 6].map(t => (
                              <div 
                                key={t}
                                className="absolute inset-x-0 border-b border-white/5"
                                style={{ 
                                   top: trackTops[t],
                                   height: trackHeights[t],
                                   backgroundImage: \\\`linear-gradient(to right, #333 1px, transparent 1px)\\\`,
                                   backgroundSize: \\\`\${zoom}px 100%\\\`
                                }}
                              />
                           ))}
                       </div>`;

content = content.replace(/\{(\/\* Track Grid Visualizer \*\/)\}[\s\S]+?className="absolute inset-x-0 bottom-0 opacity-10 pointer-events-none"[\s\S]+?\/>/, (match, p1) => {
    return '{' + p1 + '}\n' + newGrid;
});

// Fix Clip Height and Double Click
content = content.replace(
    /style=\{\{\s+left: \(clip\.startTime \|\| 0\) \* zoom,\s+width: Math\.max\(2, \(\(clip\.trimEnd \|\| 0\) - \(clip\.trimStart \|\| 0\)\) \/ \(clip\.speed \|\| 1\) \* zoom\),\s+top: trackTops\[clip\.track\] \+ 4,\s+overflow: 'hidden',/,
    (match) => {
        return `onDoubleClick={(e) => {
                                if (clip.type === 'audio') {
                                  e.stopPropagation();
                                  setExpandedClipIds(prev => prev.includes(clip.id) ? prev.filter(id => id !== clip.id) : [...prev, clip.id]);
                                }
                              }}\n` + match + `\nheight: expandedClipIds.includes(clip.id) ? 120 : 56,`;
    }
);

// Add isExpanded check inside map
content = content.replace(
    /\{clips\.filter\(c => !hiddenTracks\.includes\(c\.track\)\)\.map\(clip => \(/,
    "{clips.filter(c => !hiddenTracks.includes(c.track)).map(clip => { const isExpanded = expandedClipIds.includes(clip.id); return ("
);

// Fix the closing bracket of map
content = content.replace(
    /\)\)\}/,
    ")})}"
);

// Add SVG Keyframes
content = content.replace(
    /\{\/\* Audio Waveform Background \*\/\}\s+\{clip\.type === 'audio' && \([\s\S]+?\}\s+\)\}/,
    (match) => {
        return match + `
                             {isExpanded && clip.type === 'audio' && (
                               <div className="absolute inset-0 z-20">
                                  <svg 
                                    className="w-full h-full cursor-crosshair overflow-visible"
                                    onClick={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const clickX = e.clientX - rect.left;
                                      const clickY = e.clientY - rect.top;
                                      setClips(prev => prev.map(c => {
                                        if (c.id === clip.id) {
                                          const ks = { ...(c.keyframes || {}) };
                                          const volKs = [...(ks.volume || [{ time: 0, value: c.volume ?? 1 }])];
                                          const relativeTime = (clickX / zoom) - clip.startTime;
                                          volKs.push({ time: relativeTime, value: Math.max(0, Math.min(2, 2 - (clickY/120)*2)) });
                                          volKs.sort((a,b) => a.time - b.time);
                                          return { ...c, keyframes: { ...ks, volume: volKs } };
                                        }
                                        return c;
                                      }));
                                    }}
                                  >
                                     <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={(clip.keyframes?.volume || [{ time: 0, value: clip.volume ?? 1 }]).map(k => {
                                         const x = (k.time + clip.startTime) * zoom;
                                         const y = (1 - k.value / 2) * 120;
                                         return \`\${x},\${y}\`;
                                       }).join(' ')} />
                                     {(clip.keyframes?.volume || []).map((k, idx) => (
                                        <circle key={idx} cx={(k.time + clip.startTime) * zoom} cy={(1 - k.value / 2) * 120} r="4" fill="#fff" stroke="#3b82f6" strokeWidth="2" className="cursor-pointer hover:fill-blue-400"
                                          onMouseDown={(e) => {
                                            e.stopPropagation();
                                            setIsDraggingVolume({ clipId: clip.id, keyframeIdx: idx });
                                            dragInfo.current = { clipId: clip.id, startX: e.clientX, startY: e.clientY, originalStates: { [clip.id]: { volume: k.value } } };
                                          }}
                                          onContextMenu={(e) => {
                                            e.preventDefault(); e.stopPropagation();
                                            setClips(prev => prev.map(c => {
                                              if (c.id === clip.id) {
                                                const ks = { ...(c.keyframes || {}) };
                                                const volKs = (ks.volume || []).filter((_, i) => i !== idx);
                                                return { ...c, keyframes: { ...ks, volume: volKs } };
                                              }
                                              return c;
                                            }));
                                          }}
                                        />
                                     ))}
                                  </svg>
                               </div>
                             )}`;
    }
);

fs.writeFileSync(path, content);
console.log('App.tsx patched successfully');
