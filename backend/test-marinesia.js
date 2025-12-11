/**
 * Test script for Marinesia API
 * Tests if we can get position data for the Gozo ferry (MMSI 248692000)
 */

const https = require('https');

const TEST_MMSI = '248692000'; // Gozo ferry MMSI
const API_URL = `https://api.marinesia.com/api/v1/vessel/${TEST_MMSI}/location/latest`;

console.log('🧪 Testing Marinesia API...');
console.log(`📋 Testing MMSI: ${TEST_MMSI}`);
console.log(`🔗 URL: ${API_URL}`);
console.log('');

https.get(API_URL, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.error === false && response.data) {
        const vessel = response.data;
        console.log('✅ SUCCESS! Position data received:');
        console.log(`   MMSI: ${vessel.mmsi}`);
        console.log(`   Location: ${vessel.lat}, ${vessel.lng}`);
        console.log(`   Course: ${vessel.cog}°`);
        console.log(`   Speed: ${vessel.sog} knots`);
        console.log(`   Heading: ${vessel.hdt}°`);
        console.log(`   Timestamp: ${vessel.ts}`);
        console.log('');
        console.log('🎉 Marinesia API is working and has data for the Gozo ferry!');
        console.log('');
        console.log('📋 To use Marinesia in your database:');
        console.log('   UPDATE places SET ais_provider = "Marinesia", ais_api_key = NULL WHERE id = <your_ferry_place_id>;');
      } else {
        console.log('❌ No data received');
        console.log('   Response:', JSON.stringify(response, null, 2));
        console.log('');
        console.log('⚠️ Marinesia may not have current data for this MMSI');
      }
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.error('   Raw response:', data.substring(0, 500));
    }
  });
}).on('error', (error) => {
  console.error('❌ Error making request:', error.message);
});


