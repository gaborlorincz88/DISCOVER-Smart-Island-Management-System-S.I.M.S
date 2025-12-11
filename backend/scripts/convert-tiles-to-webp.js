#!/usr/bin/env node

/**
 * Convert PNG map tiles to WebP format for better compression
 * This script converts tiles while maintaining visual quality
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // High-performance image processing library

const TILES_DIR = path.join(__dirname, '../tiles/gozo');
const CONVERTED_DIR = path.join(__dirname, '../tiles/gozo-webp');

// Configuration
const QUALITY = 80; // WebP quality (0-100, 80 is good for small tiles)
const LOSS_LESS = false; // Set to true for lossless compression (larger files)

console.log('🔄 Starting tile conversion to WebP...');
console.log(`📁 Source directory: ${TILES_DIR}`);
console.log(`📁 Output directory: ${CONVERTED_DIR}`);
console.log(`⚙️  Quality: ${QUALITY} (lossless: ${LOSS_LESS})`);

// Ensure output directory exists
if (!fs.existsSync(CONVERTED_DIR)) {
  fs.mkdirSync(CONVERTED_DIR, { recursive: true });
}

let convertedCount = 0;
let skippedCount = 0;
let errorCount = 0;
let totalOriginalSize = 0;
let totalCompressedSize = 0;

// Function to convert a single PNG file to WebP
async function convertTile(inputPath, outputPath) {
  try {
    const stats = fs.statSync(inputPath);
    totalOriginalSize += stats.size;

    // Read the PNG file
    const buffer = fs.readFileSync(inputPath);

    // Convert to WebP
    const webpBuffer = await sharp(buffer)
      .webp({ 
        quality: QUALITY,
        lossless: LOSS_LESS,
        effort: 6 // Compression effort (0-6, higher = better compression but slower)
      })
      .toBuffer();

    // Write the WebP file
    fs.writeFileSync(outputPath, webpBuffer);
    
    totalCompressedSize += webpBuffer.length;
    convertedCount++;

    // Log progress every 100 files
    if (convertedCount % 100 === 0) {
      const compressionRatio = ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1);
      console.log(`✅ Converted ${convertedCount} tiles... (${compressionRatio}% compression)`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error converting ${inputPath}:`, error.message);
    errorCount++;
    return false;
  }
}

// Function to recursively process directories
async function processDirectory(dirPath, relativePath = '') {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativeFullPath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      // Create corresponding directory in output
      const outputDir = path.join(CONVERTED_DIR, relativeFullPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Recursively process subdirectory
      await processDirectory(fullPath, relativeFullPath);
    } else if (entry.isFile() && entry.name.endsWith('.png')) {
      // Convert PNG file to WebP
      const outputPath = path.join(CONVERTED_DIR, relativeFullPath.replace('.png', '.webp'));
      
      // Skip if already converted
      if (fs.existsSync(outputPath)) {
        skippedCount++;
        continue;
      }

      await convertTile(fullPath, outputPath);
    }
  }
}

// Main execution
async function main() {
  const startTime = Date.now();

  if (!fs.existsSync(TILES_DIR)) {
    console.error(`❌ Source directory not found: ${TILES_DIR}`);
    process.exit(1);
  }

  console.log('🚀 Starting conversion process...\n');

  await processDirectory(TILES_DIR);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Calculate final statistics
  const compressionRatio = ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1);
  const totalSavings = ((totalOriginalSize - totalCompressedSize) / 1024 / 1024).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Conversion Complete!');
  console.log('='.repeat(60));
  console.log(`📊 Statistics:`);
  console.log(`   Converted: ${convertedCount} tiles`);
  console.log(`   Skipped: ${skippedCount} tiles`);
  console.log(`   Errors: ${errorCount} tiles`);
  console.log(`   Original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Compressed size: ${(totalCompressedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Space saved: ${totalSavings} MB`);
  console.log(`   Compression ratio: ${compressionRatio}%`);
  console.log(`   Time taken: ${duration} seconds`);
  console.log('='.repeat(60));
  
  console.log('\n💡 Next steps:');
  console.log('   1. Backend is already configured to serve WebP');
  console.log('   2. Test the converted tiles in your app');
  console.log('   3. Keep original PNG files as backup');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});