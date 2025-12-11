/**
 * Test script to verify AisStream.io connection and check if MMSI is active
 * 
 * Usage:
 *   On Windows PowerShell:
 *     cd backend
 *     node test-ais-connection.js
 *   
 *   Or set environment variable:
 *     $env:AISSTREAM_API_KEY="your_key_here"
 *     node backend/test-ais-connection.js
 * 
 *   On Linux/Mac:
 *     export AISSTREAM_API_KEY="your_key_here"
 *     node backend/test-ais-connection.js
 */

const WebSocket = require('ws');
const db = require('./database');

// Get API key from environment, database, or use placeholder
let API_KEY = process.env.AISSTREAM_API_KEY;
let TEST_MMSI = '248692000'; // Default Gozo ferry MMSI

// If not in environment, try to get from database
if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
  try {
    const place = db.prepare(`
      SELECT ais_api_key, ais_mmsi, name
      FROM places 
      WHERE is_dynamic_location = 1 
        AND ais_provider IS NOT NULL 
        AND ais_api_key IS NOT NULL 
        AND ais_mmsi IS NOT NULL
      LIMIT 1
    `).get();
    
    if (place && place.ais_api_key) {
      API_KEY = place.ais_api_key;
      if (place.ais_mmsi) {
        // Use first MMSI if multiple
        TEST_MMSI = place.ais_mmsi.split(',')[0].trim();
      }
      console.log(`📋 Found API key from database (place: ${place.name}, MMSI: ${TEST_MMSI})`);
    }
  } catch (error) {
    console.warn('⚠️ Could not read from database:', error.message);
  }
}

// Fallback
if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
  console.error('❌ No API key found!');
  console.error('   Set environment variable:');
  console.error('     PowerShell: $env:AISSTREAM_API_KEY="your_key"');
  console.error('     Linux/Mac: export AISSTREAM_API_KEY="your_key"');
  console.error('   Or ensure database has a place with ais_api_key configured');
  process.exit(1);
}

console.log('🧪 Testing AisStream.io connection...');
console.log(`📋 Testing MMSI: ${TEST_MMSI}`);
console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);

const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

let subscriptionSent = false;
let messagesReceived = 0;
let positionReceived = false;

ws.on('open', () => {
  console.log('✅ WebSocket connected to AisStream.io');
  
  // AisStream.io requires subscription within 3 seconds - send immediately
  // Using "APIKey" format as per official documentation
  const subscriptionMessage = {
    APIKey: API_KEY,  // Official format per documentation
    BoundingBoxes: [
      [
        [35.80, 14.15], // Southwest corner (Malta-Gozo channel)
        [36.10, 14.45]  // Northeast corner
      ]
    ],
    FiltersShipMMSI: [TEST_MMSI],
    FilterMessageTypes: ['PositionReport']
  };
  
  const messageStr = JSON.stringify(subscriptionMessage);
  console.log('📡 Sending subscription:', messageStr);
  console.log('📏 Message length:', messageStr.length, 'bytes');
  
  try {
    ws.send(messageStr);
    subscriptionSent = true;
    console.log('✅ Subscription sent successfully');
    console.log('⏳ Waiting for response from AisStream.io...');
  } catch (error) {
    console.error('❌ Error sending subscription:', error);
  }
});

ws.on('message', (data) => {
  messagesReceived++;
  const rawData = data.toString();
  console.log(`\n📨 Raw message #${messagesReceived} received (${rawData.length} bytes):`);
  console.log(rawData.substring(0, 500)); // Show first 500 chars
  
  try {
    const message = JSON.parse(rawData);
    const msgType = message.MessageType || message.messageType || message.type || 'unknown';
    
    console.log(`   Parsed type: ${msgType}`);
    console.log(`   Full message structure:`, JSON.stringify(message, null, 2).substring(0, 1000));
    
    // Check for errors (including rate limiting)
    if (message.error || message.Error || message.message) {
      const errorMsg = message.error || message.Error || message.message;
      console.error('❌ Error:', errorMsg);
      if (errorMsg.includes('Too Many Subscription Requests') || errorMsg.includes('rate limit')) {
        console.error('⚠️ Rate limiting detected! Wait a few minutes before trying again.');
      }
      return;
    }
    
    // Check for error messages in the message structure
    if (message.Message && typeof message.Message === 'string' && message.Message.includes('error')) {
      console.error('❌ Error message:', message.Message);
      return;
    }
    
    // Check for subscription response
    if (msgType === 'SubscriptionResponse' || msgType === 'subscription_response') {
      console.log('✅ Subscription confirmed');
      if (message.Message && message.Message.SubscriptionResponse) {
        const response = message.Message.SubscriptionResponse;
        if (response.error) {
          console.error('❌ Subscription error:', response.error);
        } else {
          console.log('📋 Subscription response:', JSON.stringify(response, null, 2));
        }
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
        
        if (mmsi === TEST_MMSI || String(mmsi) === String(TEST_MMSI)) {
          positionReceived = true;
          console.log(`\n🎉 POSITION RECEIVED FOR MMSI ${TEST_MMSI}!`);
          console.log(`📍 Location: ${lat}, ${lng}`);
          console.log(`📊 Full position data:`, JSON.stringify(positionData, null, 2));
        } else {
          console.log(`ℹ️ Position received for different MMSI: ${mmsi} (expected ${TEST_MMSI})`);
        }
      }
    } else {
      // Log other message types
      console.log(`📋 Message structure:`, JSON.stringify(message, null, 2).substring(0, 500));
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error);
    console.error('Raw data:', data.toString().substring(0, 200));
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  console.error('   Error details:', error.message, error.code);
});

ws.on('close', (code, reason) => {
  console.log(`\n❌ WebSocket closed - Code: ${code}, Reason: ${reason || 'none'}`);
  console.log(`📊 Summary:`);
  console.log(`   - Messages received: ${messagesReceived}`);
  console.log(`   - Position received for MMSI ${TEST_MMSI}: ${positionReceived ? 'YES ✅' : 'NO ❌'}`);
  
  if (!positionReceived && messagesReceived === 0) {
    console.log('\n⚠️ No messages received from AisStream.io. Possible issues:');
    console.log('   1. MMSI ' + TEST_MMSI + ' is not currently broadcasting');
    console.log('   2. Vessel is outside the bounding box');
    console.log('   3. API key is invalid or expired');
    console.log('   4. AisStream.io does not have data for this MMSI');
  }
  
  process.exit(0);
});

// Timeout after 60 seconds (give more time for data)
setTimeout(() => {
  console.log('\n⏱️ Test timeout (60 seconds)');
  if (!positionReceived) {
    console.log('\n⚠️ No position data received during test period.');
    console.log('   This could mean:');
    console.log('   1. MMSI ' + TEST_MMSI + ' is not currently broadcasting AIS data');
    console.log('   2. The vessel is outside the specified bounding box');
    console.log('   3. AisStream.io does not have real-time data for this MMSI');
    console.log('   4. The vessel may be docked or not transmitting');
  }
  ws.close();
}, 60000);


