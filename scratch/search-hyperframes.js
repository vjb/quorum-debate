const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.js')) {
            const content = fs.readFileSync(file, 'utf8');
            if (content.toLowerCase().includes('ffmpeg')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('node_modules/hyperframes');
files.forEach(f => {
    console.log('File:', f);
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.toLowerCase().includes('ffmpeg')) {
            console.log(`  ${i+1}: ${line.trim()}`);
        }
    });
});
