import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');
let parens = 0;
let braces = 0;
let brackets = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '(') parens++;
    else if (char === ')') parens--;
    else if (char === '{') braces++;
    else if (char === '}') braces--;
    else if (char === '[') brackets++;
    else if (char === ']') brackets--;
    
    if (parens < 0 || braces < 0 || brackets < 0) {
        console.log(`Unbalanced at index ${i}: char=${char}, p=${parens}, b=${braces}, br=${brackets}`);
        // break;
    }
}

console.log(`Final: p=${parens}, b=${braces}, br=${brackets}`);
