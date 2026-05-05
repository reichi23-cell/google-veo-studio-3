import fs from 'fs';

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// The most common break point
content = content.replace(/<\/div>\s+\)\)\)\}/, "</div>\n                       )})}");
content = content.replace(/<\/div>\s+\)\)\)\}/, "</div>\n                       )})}");

fs.writeFileSync(path, content);
console.log('App.tsx syntactically fixed');
