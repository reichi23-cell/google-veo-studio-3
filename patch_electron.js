const fs = require('fs');
let code = fs.readFileSync('electron-main.cjs', 'utf-8');
code = code.replace("if (isDev) {", "if (true) {");
fs.writeFileSync('electron-main.cjs', code);
