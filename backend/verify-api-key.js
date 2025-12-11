/**
 * Simple script to verify if an AisStream.io API key is valid
 * This tries a minimal subscription to see if we get ANY response
 */

const WebSocket = require('ws');

const API_KEY = process.env.AISSTREAM_API_KEY || process.argv[2];

if (!API_KEY) {
  console.error('❌ No API key provided!');
  console.error('Usage: node verify-api-key.js <your_api_key>');
  console.error('   Or: $env:AISSTREAM_API_KEY="key" node verify-api-key.js');
  process.exit(1);
}

console.log('🔑 Testing API key:', API_KEY.substring(0, 10) + '...' + API_KEY.substring(API_KEY.length - 4));
console.log('🔗 Connecting to AisStream.io...');

const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

let gotResponse = false;
let connectionTime = Date.now();

ws.on('open', () => {
  console.log('✅ Connected!');
  connectionTime = Date.now();
  
  // Send minimal subscription - global bounding box, no filters
  const subscription = {
    APIKey: API_KEY,
    BoundingBoxes: [
      [[-90, -180], [90, 180]]  // Global coverage
    ]
  };
  
  console.log('📡 Sending minimal subscription (global coverage)...');
  console.log('   Subscription:', JSON.stringify(subscription));
  
  try {
    ws.send(JSON.stringify(subscription));
    console.log('✅ Subscription sent');
  } catch (error) {
    console.error('❌ Error sending:', error);
  }
});

ws.on('message', (data) => {
  gotResponse = true;
  const elapsed = Date.now() - connectionTime;
  console.log(`\n🎉 RESPONSE RECEIVED after ${elapsed}ms!`);
  console.log('📨 Raw message:', data.toString().substring(0, 500));
  
  try {
    const msg = JSON.parse(data.toString());
    console.log('📋 Parsed message:', JSON.stringify(msg, null, 2).substring(0, 1000));
    
    // Check for subscription confirmation
    if (msg.MessageType === 'SubscriptionResponse' || msg.messageType === 'SubscriptionResponse') {
      console.log('✅ Subscription confirmed by AisStream.io!');
      if (msg.Message && msg.Message.SubscriptionResponse) {
        const resp = msg.Message.SubscriptionResponse;
        if (resp.error) {
          console.error('❌ Subscription error:', resp.error);
        } else {
          console.log('✅ Subscription successful!');
        }
      }
    }
  } catch (e) {
    console.log('⚠️ Could not parse as JSON, but got response (this is good!)');
  }
  
  // Close after first message to verify it works
  setTimeout(() => {
    console.log('\n✅ API key appears to be VALID (received response)');
    ws.close();
  }, 1000);
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  const elapsed = Date.now() - connectionTime;
  console.log(`\n🔌 Connection closed after ${elapsed}ms`);
  console.log(`   Code: ${code}, Reason: ${reason || 'none'}`);
  
  if (!gotResponse) {
    console.log('\n❌ NO RESPONSE RECEIVED - API key may be INVALID or INACTIVE');
    console.log('   Possible issues:');
    console.log('   1. API key is incorrect');
    console.log('   2. API key is not activated');
    console.log('   3. API key has expired');
    console.log('   4. Account subscription has lapsed');
    console.log('\n   Check your AisStream.io dashboard to verify:');
    console.log('   https://aisstream.io/dashboard');
  } else {
    console.log('\n✅ API key appears to be working!');
  }
  
  process.exit(gotResponse ? 0 : 1);
});

// Timeout after 10 seconds
setTimeout(() => {
  if (!gotResponse) {
    console.log('\n⏱️ Timeout - no response received');
    ws.close();
  }
}, 10000);


