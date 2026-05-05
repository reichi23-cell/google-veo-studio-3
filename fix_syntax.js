import fs from 'fs';

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// The most robust way to fix the syntax error is to look for the pattern before Bridge Detection
const pattern = /<\/div>\s+\)\)\)\}\s+\{\/\* Bridge Detection UI \*\//;
if (pattern.test(content)) {
    content = content.replace(pattern, "</div>\n                       )})} \n                      {/* Bridge Detection UI */}");
} else {
    // Try another pattern if the first one fails
    content = content.replace(/<\/div>\s+\}\)\)\)\}/, "</div>\n                       )})}");
    content = content.replace(/<\/div>\s+\)\)\)\}/, "</div>\n                       )})}");
}

fs.writeFileSync(path, content);
console.log('App.tsx syntactically fixed');
