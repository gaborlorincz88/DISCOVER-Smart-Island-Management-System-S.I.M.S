import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, '..', 'public', '1118.mp4');
const outputFile = path.join(__dirname, '..', 'public', '1118-compressed.mp4');

console.log('🎬 Compressing video file...');
console.log(`Input: ${inputFile}`);
console.log(`Output: ${outputFile}`);

// Check if input file exists
if (!fs.existsSync(inputFile)) {
  console.error('❌ Input file not found:', inputFile);
  process.exit(1);
}

// Get original file size
const originalSize = fs.statSync(inputFile).size;
console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

// FFmpeg command for aggressive compression optimized for web
// -crf 32 = higher compression (lower quality, smaller file)
// -preset slow = better compression
// -vf scale = limit resolution if needed
// -movflags +faststart = web optimization
// -an = remove audio (if not needed for loading animation)
const ffmpegCommand = `ffmpeg -i "${inputFile}" -vcodec h264 -crf 32 -preset slow -vf "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease" -movflags +faststart -an -y "${outputFile}"`;

console.log('\n⏳ Compressing... This may take a minute...\n');

exec(ffmpegCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error compressing video:');
    console.error(error.message);
    console.error('\n💡 Alternative options:');
    console.error('1. Install FFmpeg manually: https://ffmpeg.org/download.html');
    console.error('2. Use an online tool like: https://www.freeconvert.com/video-compressor');
    console.error('3. Use HandBrake: https://handbrake.fr/');
    process.exit(1);
  }

  if (fs.existsSync(outputFile)) {
    const newSize = fs.statSync(outputFile).size;
    const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);
    
    console.log('✅ Compression complete!');
    console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`New size: ${(newSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Reduction: ${reduction}%`);
    console.log(`\n📁 Compressed file saved as: ${outputFile}`);
    console.log('\n💡 Next steps:');
    console.log('1. Review the compressed video quality');
    console.log('2. If satisfied, replace the original: mv public/1118-compressed.mp4 public/1118.mp4');
    console.log('3. Or rename it to a better name like: loading-animation.mp4');
  } else {
    console.error('❌ Output file was not created');
  }
});

