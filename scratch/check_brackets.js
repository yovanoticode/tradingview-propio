const fs = require('fs');
const code = fs.readFileSync('src/components/chart/PriceChart.tsx', 'utf8');

const stack = [];
for (let i = 0; i < code.length; i++) {
  const char = code[i];
  if (char === '(' || char === '{' || char === '[') {
    const line = code.substring(0, i).split('\n').length;
    stack.push({ char, line, i });
  } else if (char === ')' || char === '}' || char === ']') {
    const last = stack[stack.length - 1];
    if (last) {
      if ((char === ')' && last.char === '(') ||
          (char === '}' && last.char === '{') ||
          (char === ']' && last.char === '[')) {
        stack.pop();
      } else {
        // Mismatch
      }
    }
  }
}

console.log("Unclosed:", stack.map(x => `${x.char} at line ${x.line}`));
