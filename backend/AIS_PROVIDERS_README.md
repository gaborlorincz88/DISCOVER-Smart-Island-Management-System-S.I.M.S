# AIS Provider Options for Gozo Ferry Tracking

## Current Situation

The Gozo ferry (MMSI: 248692000, "TA' PINU") is **not available** in most free AIS data sources:
- ❌ **AisStream.io** - No data (connection works, but vessel not broadcasting)
- ❌ **Marinesia** - No data in last 5 days
- ⚠️ **MyShipTracking** - Free trial available (10 days, 2,000 credits) - **Worth trying**

## Available Providers

### 1. Marinesia (FREE, No API Key Required)
- **Status**: ✅ Implemented
- **Coverage**: Limited (no data for Gozo ferry)
- **Setup**: Just set `ais_provider = 'Marinesia'` in database
- **Best for**: Other vessels that are actively broadcasting

### 2. MyShipTracking (FREE TRIAL)
- **Status**: ✅ Implemented
- **Coverage**: Terrestrial AIS (depends on local antennas)
- **Setup**: 
  1. Register at https://api.myshiptracking.com/
  2. Get API Key and Secret
  3. Store as: `ais_api_key = 'API_KEY,SECRET'` (comma-separated)
  4. Set `ais_provider = 'MyShipTracking'`
- **Best for**: Testing if they have Gozo ferry data

### 3. AisStream.io (PAID)
- **Status**: ✅ Implemented
- **Coverage**: Global, but Gozo ferry not currently broadcasting
- **Setup**: Requires valid API key
- **Best for**: Other vessels that ARE broadcasting

## Recommended Solution: Multi-Provider Fallback

Since no single free provider has the Gozo ferry data, here are your options:

### Option 1: Try MyShipTracking Free Trial
1. Register at https://api.myshiptracking.com/
2. Get your API key and secret
3. Update database:
   ```sql
   UPDATE places 
   SET ais_provider = 'MyShipTracking',
       ais_api_key = 'YOUR_API_KEY,YOUR_SECRET'
   WHERE id = <ferry_place_id>;
   ```
4. Test for 10 days to see if they have data

### Option 2: Use Paid Services
- **VesselFinder**: €330 for 10,000 credits (1 credit per position query)
- **MarineTraffic**: Contact for pricing
- These are more expensive but likely have better coverage

### Option 3: Hybrid Approach (Recommended)
Since the ferry operates on a fixed route, you could:
1. **Use AIS when available** (for real-time tracking)
2. **Fallback to schedule-based estimation** when AIS data is unavailable
3. **Show "Last known position"** or "Estimated position based on schedule"

This would require:
- Ferry schedule data (departure times)
- Route waypoints
- Speed estimation based on schedule

### Option 4: Check Gozo Channel Company Directly
The Gozo Channel Company might have:
- Their own tracking API
- Real-time position data on their website
- Partnership opportunities for data access

Contact: https://www.gozochannel.com/

## Testing Providers

### Test Marinesia:
```bash
node backend/test-marinesia.js
```

### Test MyShipTracking:
1. Get API key from https://api.myshiptracking.com/
2. Create test script similar to `test-marinesia.js`

## Database Configuration

For each place/event with dynamic location:

```sql
-- Marinesia (no API key needed)
UPDATE places 
SET ais_provider = 'Marinesia',
    ais_api_key = NULL
WHERE id = <place_id>;

-- MyShipTracking (API key and secret, comma-separated)
UPDATE places 
SET ais_provider = 'MyShipTracking',
    ais_api_key = 'API_KEY,SECRET'
WHERE id = <place_id>;

-- AisStream (your existing setup)
UPDATE places 
SET ais_provider = 'AisStream',
    ais_api_key = 'your_aisstream_api_key'
WHERE id = <place_id>;
```

## Next Steps

1. **Try MyShipTracking free trial** - Register and test if they have Gozo ferry data
2. **Contact Gozo Channel Company** - Ask if they provide real-time position data
3. **Implement schedule-based fallback** - If AIS data is unavailable, estimate position from schedule
4. **Consider paid services** - If real-time tracking is critical, VesselFinder or MarineTraffic may be worth it

## Implementation Status

✅ Marinesia provider - Implemented and working
✅ MyShipTracking provider - Implemented and ready
✅ AisStream provider - Already working
✅ Multi-provider support - System can use different providers for different vessels

The system is ready to use any provider that has data for your vessels!


