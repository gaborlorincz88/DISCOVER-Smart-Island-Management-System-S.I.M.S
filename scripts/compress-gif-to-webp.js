import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for input file
const inputFile = path.join(__dirname, '..', 'public', 'logovideo.gif');
const outputFile = path.join(__dirname, '..', 'public', 'logovideo.webp');

console.log('🎬 Converting GIF to animated WebP (with transparency)...');
console.log(`Input: ${inputFile}`);
console.log(`Output: ${outputFile}`);

if (!fs.existsSync(inputFile)) {
  console.error('❌ Input file not found:', inputFile);
  console.error('💡 Make sure your GIF file is named "logovideo.gif" in the public folder');
  process.exit(1);
}

const originalSize = fs.statSync(inputFile).size;
console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

// FFmpeg command to convert GIF to WebP with transparency
// -lossless 0 = lossy compression (smaller file)
// -compression_level 6 = good balance (0-6, higher = better compression)
// -quality 80 = quality level (0-100, higher = better quality)
// -loop 0 = infinite loop
const ffmpegCommand = `ffmpeg -i "${inputFile}" -vcodec libwebp -lossless 0 -compression_level 6 -quality 80 -loop 0 -preset default -an -vsync 0 "${outputFile}"`;

console.log('\n⏳ Converting... This may take a minute...\n');

exec(ffmpegCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error converting:');
    console.error(error.message);
    console.error('\n💡 Alternative options:');
    console.error('1. Install FFmpeg: https://ffmpeg.org/download.html');
    console.error('2. Use online tool: https://cloudconvert.com/gif-to-webp');
    console.error('3. Use Squoosh: https://squoosh.app/ (drag and drop your GIF)');
    process.exit(1);
  }

  if (fs.existsSync(outputFile)) {
    const newSize = fs.statSync(outputFile).size;
    const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);
    
    console.log('✅ Conversion complete!');
    console.log(`Original (GIF): ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`New (WebP): ${(newSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Reduction: ${reduction}%`);
    console.log(`\n📁 WebP file saved as: ${outputFile}`);
    console.log('\n💡 Next steps:');
    console.log('1. The WebP file supports transparency and is much smaller');
    console.log('2. Update your code to use <img> tag with WebP (I can do this)');
    console.log('3. Add fallback to GIF for older browsers');
  } else {
    console.error('❌ Output file was not created');
  }
});


