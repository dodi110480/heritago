const fs = require('fs');

const contents = `
                        fetch('app/ui/RANDOM_DASHBOARD-TEXTS.MD')
                            .then(res => res.text())
                            .then(text => {
                                const lines = text.split('\\n')
                                    .map(line => line.trim())
                                    .filter(line => line && !line.startsWith('//') && line.length > 5);
                                    
                                if (lines.length > 0) {
                                    const cleanedLines = lines.map(l => l.replace(/^["„“']|["„“']$/g, ''));
                                    const activeFunStat = cleanedLines[Math.floor(Math.random() * cleanedLines.length)];
                                    this.funStat.set(activeFunStat);
                                }
                            })
                            .catch(err => {
                                this.funStat.set('Entdecke deine Familiengeschichte.');
                            });`;

const rawMD = fs.readFileSync('src/app/ui/RANDOM_DASHBOARD-TEXTS.MD', 'utf-8');
const compiledArrayEntries = rawMD.split('\\n')
    .map(l => l.trim().replace(/^["„“']|["„“']$/g, '').replace(/"/g, '\\"'))
    .filter(l => l.length > 5);

const arrayCode = \`
                        const randomTexts = [
                            "\${compiledArrayEntries.join('",\\n                            "')}"
                        ];
                        const activeFunStat = randomTexts[Math.floor(Math.random() * randomTexts.length)];
                        this.funStat.set(activeFunStat);
\`;

let dashCode = fs.readFileSync('src/app/dashboard.ts', 'utf-8');

// The replacement was:
if (dashCode.includes(contents.trim())) {
  dashCode = dashCode.replace(contents.trim(), arrayCode.trim());
  fs.writeFileSync('src/app/dashboard.ts', dashCode);
  console.log("Replaced with safe static Array");
} else {
  // Let's replace the whole function block if the specific string matching failed:
  let parts = dashCode.split('// Fetch Random Fun Statement');
  if(parts.length > 1){
     let before = parts[0];
     let after = parts[1].substring(parts[1].indexOf('}'));
     dashCode = before + '// Fetch Random Fun Statement\\n' + arrayCode + '\\n                    ' + after;
     fs.writeFileSync('src/app/dashboard.ts', dashCode);
     console.log("Used fallback replace method");
  } else {
     console.log("Nothing modified, target block not found.");
  }
}
