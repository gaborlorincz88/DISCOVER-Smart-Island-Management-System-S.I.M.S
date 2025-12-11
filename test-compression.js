#!/usr/bin/env node

// Test script to check gzip compression
const https = require('https');
const http = require('http');

const testUrl = process.argv[2] || 'https://localhost:3002';

console.log('🧪 Testing gzip compression...');
console.log(`📡 Testing: ${testUrl}`);

function testCompression(url) {
  const protocol = url.startsWith('https') ? https : http;
  
  const options = {
    headers: {
      'Accept-Encoding': 'gzip, deflate, br'
    }
  };

  protocol.get(url, options, (res) => {
    console.log(`\n📊 Response Headers:`);
    console.log(`   Status: ${res.statusCode}`);
    console.log(`   Content-Encoding: ${res.headers['content-encoding'] || 'none'}`);
    console.log(`   Content-Length: ${res.headers['content-length'] || 'unknown'}`);
    console.log(`   Content-Type: ${res.headers['content-type'] || 'unknown'}`);
    console.log(`   Cache-Control: ${res.headers['cache-control'] || 'none'}`);
    
    if (res.headers['content-encoding']) {
      console.log(`✅ Compression is working! (${res.headers['content-encoding']})`);
    } else {
      console.log(`❌ No compression detected`);
    }
    
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`📏 Response size: ${data.length} bytes`);
      if (res.headers['content-encoding']) {
        console.log(`🎯 Compression ratio: ${((1 - data.length / parseInt(res.headers['content-length'] || '0')) * 100).toFixed(1)}%`);
      }
    });
  }).on('error', (err) => {
    console.error(`❌ Error: ${err.message}`);
  });
}

// Test different endpoints
const endpoints = [
  '/',
  '/api/places',
  '/tiles/gozo/12/2206/1606.png',
  '/uploads/optimized/icon-1755629717779-964265234-optimized.webp'
];

endpoints.forEach(endpoint => {
  console.log(`\n🔍 Testing: ${endpoint}`);
  testCompression(testUrl + endpoint);
  
  // Wait a bit between requests
  setTimeout(() => {}, 1000);
});

