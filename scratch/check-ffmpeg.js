const ffmpeg = require('ffmpeg-static');
const fs = require('fs');
console.log('FFMPEG Path:', ffmpeg);
console.log('Exists:', fs.existsSync(ffmpeg));
