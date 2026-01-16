#!/usr/bin/env node

/**
 * Image Optimization Script
 * Converts PNG images to WebP format for better performance
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

async function convertToWebP(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .webp({ quality: 90, effort: 6 })
      .toFile(outputPath);
    
    const inputStats = fs.statSync(inputPath);
    const outputStats = fs.statSync(outputPath);
    const savings = ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(2);
    
    console.log(`✅ Converted: ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
    console.log(`   Size: ${(inputStats.size / 1024).toFixed(2)}KB → ${(outputStats.size / 1024).toFixed(2)}KB (${savings}% smaller)`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to convert ${inputPath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🖼️  Starting image optimization...\n');
  
  // Convert apple-touch-icon.png to WebP
  const pngPath = path.join(publicDir, 'apple-touch-icon.png');
  const webpPath = path.join(publicDir, 'apple-touch-icon.webp');
  
  if (fs.existsSync(pngPath)) {
    await convertToWebP(pngPath, webpPath);
  } else {
    console.log('ℹ️  No PNG images found to convert');
  }
  
  console.log('\n✨ Image optimization complete!');
}

main().catch(console.error);
