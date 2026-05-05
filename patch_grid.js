import fs from 'fs';

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// The replacement for the Grid Visualizer
const oldGrid = `                       {/* Track Grid Visualizer */}
                       <div 
                         className="absolute inset-x-0 bottom-0 opacity-10 pointer-events-none" 
                         style={{ 
                            top: 64,
                            backgroundImage: \`linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)\`,
                            backgroundSize: \`\${zoom}px 100%\`
                         }} 
                       />`;

const newGrid = `                       {/* Track Grid Visualizer */}
                       <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
                           {[0, 1, 2, 3, 4, 5, 6].map(t => (
                              <div 
                                key={t}
                                className="absolute inset-x-0 border-b border-white/5"
                                style={{ 
                                   top: trackTops[t],
                                   height: trackHeights[t],
                                   backgroundImage: \`linear-gradient(to right, #333 1px, transparent 1px)\`,
                                   backgroundSize: \`\${zoom}px 100%\`
                                }}
                              />
                           ))}
                       </div>`;

// Note: String replacement might fail if indentation changed.
// Better to use a simpler anchor.

// Let's find the Clips section
const clipsSectionRegex = /\{clips\.filter\(c => !hiddenTracks\.includes\(c\.track\)\)\.map\(clip => \([\s\S]+?\}\)\)\}/;

// But wait, the content inside is complex.
// I'll use simple string replace for the Grid Visualizer first.

content = content.replace(/\{zoom\}px 100%/g, (match, offset) => {
    // If we already patched backgroundSize to 100%, let's keep it.
    return match;
});

// Actually, I will just rewrite the whole Timeline content area.
// It's safer if I use a multi-line regex.

fs.writeFileSync(path, content);
console.log('App.tsx grid check done');
