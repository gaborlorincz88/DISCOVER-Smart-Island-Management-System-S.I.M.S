/**
 * Test script to verify AisStream.io connection WITHOUT MMSI filter
 * This will show ALL vessels in the bounding box to verify AisStream.io is working
 * 
 * Usage:
 *   On Windows PowerShell:
 *     cd backend
 *     node test-ais-connection-broad.js
 */

const WebSocket = require('ws');
const db = require('./database');

// Get API key from environment or database
let API_KEY = process.env.AISSTREAM_API_KEY;

if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
  try {
    const place = db.prepare(`
      SELECT ais_api_key
      FROM places 
      WHERE is_dynamic_location = 1 
        AND ais_provider IS NOT NULL 
        AND ais_api_key IS NOT NULL 
        AND ais_mmsi IS NOT NULL
      LIMIT 1
    `).get();
    
    if (place && place.ais_api_key) {
      API_KEY = place.ais_api_key;
      console.log(`📋 Found API key from database`);
    }
  } catch (error) {
    console.warn('⚠️ Could not read from database:', error.message);
  }
}

if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
  console.error('❌ No API key found!');
  process.exit(1);
}

console.log('🧪 Testing AisStream.io connection (BROADCAST MODE - all vessels)...');
console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);
console.log('📋 This will show ALL vessels in the Malta-Gozo area (no MMSI filter)');

const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

let subscriptionSent = false;
let messagesReceived = 0;
let positionCount = 0;
const seenMMSIs = new Set();

ws.on('open', () => {
  console.log('✅ WebSocket connected to AisStream.io');
  
  setTimeout(() => {
    // Subscribe WITHOUT MMSI filter to see all vessels
    const subscriptionMessage = {
      Apikey: API_KEY,  // Using "Apikey" format (capital A, lowercase rest)
      BoundingBoxes: [
        [
          [35.80, 14.15], // Southwest corner (Malta-Gozo channel)
          [36.10, 14.45]  // Northeast corner
        ]
      ],
      // NO FiltersShipMMSI - get all vessels
      FilterMessageTypes: ['PositionReport']
    };
    
    console.log('📡 Sending subscription (no MMSI filter)...');
    ws.send(JSON.stringify(subscriptionMessage));
    subscriptionSent = true;
    console.log('✅ Subscription sent - waiting for ANY vessel data...');
  }, 1000);
});

ws.on('message', (data) => {
  messagesReceived++;
  const rawData = data.toString();
  
  // Log first few messages in detail
  if (messagesReceived <= 3) {
    console.log(`\n📨 Raw message #${messagesReceived} (${rawData.length} bytes):`);
    console.log(rawData.substring(0, 500));
  }
  
  try {
    const message = JSON.parse(rawData);
    const msgType = message.MessageType || message.messageType || message.type || 'unknown';
    
    // Check for errors
    if (message.error || message.Error || message.message) {
      const errorMsg = message.error || message.Error || message.message;
      console.error('❌ Error:', errorMsg);
      if (errorMsg.includes('Too Many Subscription Requests')) {
        console.error('⚠️ Rate limiting detected!');
      }
      return;
    }
    
    // Check for subscription response
    if (msgType === 'SubscriptionResponse' || msgType === 'subscription_response') {
      console.log('✅ Subscription confirmed');
      if (messagesReceived <= 3) {
        console.log('📋 Full response:', JSON.stringify(message, null, 2));
      }
      return;
    }
    
    // Check for position reports
    if (msgType === 'PositionReport') {
      let positionData = null;
      
      if (message.Message && message.Message.PositionReport) {
        positionData = message.Message.PositionReport;
      } else if (message.PositionReport) {
        positionData = message.PositionReport;
      } else {
        positionData = message;
      }
      
      if (positionData) {
        const mmsi = positionData.UserID || positionData.MMSI || positionData.mmsi;
        const lat = positionData.Latitude || positionData.latitude;
        const lng = positionData.Longitude || positionData.longitude;
        
        if (mmsi) {
          positionCount++;
          if (!seenMMSIs.has(String(mmsi))) {
            seenMMSIs.add(String(mmsi));
            console.log(`\n🚢 Vessel #${seenMMSIs.size} - MMSI: ${mmsi}, Location: ${lat}, ${lng}`);
            if (String(mmsi) === '248692000') {
              console.log(`   ⭐ THIS IS THE GOZO FERRY!`);
            }
          } else if (positionCount % 10 === 0) {
            // Show progress every 10 positions
            console.log(`📊 Received ${positionCount} positions from ${seenMMSIs.size} unique vessels...`);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error.message);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`\n❌ WebSocket closed - Code: ${code}, Reason: ${reason || 'none'}`);
  console.log(`📊 Summary:`);
  console.log(`   - Total messages received: ${messagesReceived}`);
  console.log(`   - Position reports received: ${positionCount}`);
  console.log(`   - Unique vessels seen: ${seenMMSIs.size}`);
  
  if (seenMMSIs.has('248692000')) {
    console.log(`\n✅ GOZO FERRY (MMSI 248692000) WAS DETECTED!`);
  } else {
    console.log(`\n❌ Gozo ferry (MMSI 248692000) was NOT detected`);
    console.log(`   Vessels seen: ${Array.from(seenMMSIs).join(', ')}`);
  }
  
  if (messagesReceived === 0) {
    console.log('\n⚠️ No messages received from AisStream.io. Possible issues:');
    console.log('   1. API key is invalid or expired');
    console.log('   2. No vessels currently in the bounding box');
    console.log('   3. AisStream.io service issue');
  }
  
  process.exit(0);
});

// Timeout after 60 seconds
setTimeout(() => {
  console.log('\n⏱️ Test timeout (60 seconds)');
  console.log(`📊 Final stats: ${positionCount} positions from ${seenMMSIs.size} unique vessels`);
  if (seenMMSIs.has('248692000')) {
    console.log('✅ Gozo ferry was detected!');
  } else {
    console.log('❌ Gozo ferry was NOT detected');
    console.log(`   Vessels in area: ${Array.from(seenMMSIs).join(', ') || 'none'}`);
  }
  ws.close();
}, 60000);


