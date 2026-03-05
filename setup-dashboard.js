const fs = require('fs');

const mdText = fs.readFileSync('src/app/ui/RANDOM_DASHBOARD-TEXTS.MD', 'utf-8');
const textArray = mdText.split('\\n')
  .map(l => l.trim().replace(/^["„“']|["„“']$/g, '').replace(/"/g, '\\\\\"'))
  .filter(l => l.length > 5);

const codeStr = \`// Random Fun Statement
                        const randomTexts = [
                            "\${textArray.join('",\\n                            "')}"
                        ];
                        const activeFunStat = randomTexts[Math.floor(Math.random() * randomTexts.length)];
                        this.funStat.set(activeFunStat);\`;

let tsStr = fs.readFileSync('src/app/dashboard.ts', 'utf-8');
tsStr = tsStr.replace(/(\/\/\s*Random Dashboard Texts Integration.*?this\.funStat\.set\(activeFunStat\);|\/\/\s*Fetch Random Fun Statement.*?this\.funStat\.set\(activeFunStat\);\}[\s\S]*?\}|\/\/\s*Simple Fun Stat.*?Ist dein\(e\) älteste\(r\) Ahn\(in\).*?\}$)/ims, codeStr);

// To ensure it applies, fallback simple replace explicitly targeting known simple strings:
if(!tsStr.includes('const activeFunStat = randomTexts')) {
  tsStr = tsStr.replace(/const oldest = \[\.\.\.people\][\s\S]*?Ist dein.*?\}/m, codeStr);
}

fs.writeFileSync('src/app/dashboard.ts', tsStr);
