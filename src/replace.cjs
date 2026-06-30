const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/text-white\/(\d+)/g, 'text-foreground/$1');
code = code.replace(/text-white(?!\/|Space)/g, 'text-foreground');

code = code.replace(/bg-white\/(\d+)/g, 'bg-foreground/$1');
code = code.replace(/border-white\/(\d+)/g, 'border-foreground/$1');
code = code.replace(/bg-\[#050505\]/g, 'bg-background/50');
code = code.replace(/bg-black\/40/g, 'bg-foreground/5');

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated');
