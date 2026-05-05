import fs from 'fs';
const path = 'src/App.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');
// Line 1943 is at index 1942
console.log('Original line 1943:', JSON.stringify(lines[1942]));
lines[1942] = '                       )})}';
fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed line 1943');
