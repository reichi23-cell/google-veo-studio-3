import fs from 'fs';

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Search for the line that looks like }))} and replace it
for (let i = 1930; i < 1960; i++) {
    if (lines[i] && lines[i].includes('}))}')) {
        console.log(`Found broken line at ${i + 1}: ${lines[i]}`);
        lines[i] = lines[i].replace('}))}', ')})}');
    }
}

content = lines.join('\n');
fs.writeFileSync(path, content);
console.log('App.tsx syntactically fixed v4');
