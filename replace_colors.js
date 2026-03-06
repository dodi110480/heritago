const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

async function getFiles(dir) {
    const subdirs = await readdir(dir);
    const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = path.resolve(dir, subdir);
        return (await stat(res)).isDirectory() ? getFiles(res) : res;
    }));
    return files.reduce((a, f) => a.concat(f), []);
}

const replacements = [
    // Use regex with negative lookahead/lookbehind to avoid matching surfaceLightest
    { regex: /ui-surfaceLighter\b/g, replacement: 'ui-card' },
    { regex: /ui-surfaceLight(?!(er|est))\b/g, replacement: 'ui-panel' },
    { regex: /ui-input\b/g, replacement: 'neutral-100' },
    { regex: /ui-textMuted\b/g, replacement: 'neutral-500' },
    { regex: /ui-text(?!(Muted|Soft))\b/g, replacement: 'neutral-900' }
];

async function run() {
    const srcDir = path.join(__dirname, 'src');
    const files = await getFiles(srcDir);
    const targetFiles = files.filter(f => f.endsWith('.html') || f.endsWith('.ts') || f.endsWith('.css'));

    let updatedFiles = 0;

    for (const file of targetFiles) {
        let content = fs.readFileSync(file, 'utf8');
        let newContent = content;

        for (const { regex, replacement } of replacements) {
            newContent = newContent.replace(regex, replacement);
        }

        if (content !== newContent) {
            fs.writeFileSync(file, newContent, 'utf8');
            updatedFiles++;
        }
    }

    console.log(`Updated ${updatedFiles} files.`);
}

run().catch(console.error);
