const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TILE_CACHE_DIR = path.resolve(__dirname, '../tiles');
const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// Ensure the base cache directory exists
if (!fs.existsSync(TILE_CACHE_DIR)) {
  fs.mkdirSync(TILE_CACHE_DIR, { recursive: true });
}

router.get('/:region/:z/:x/:y.png', async (req, res) => {
  const { region, z, x, y } = req.params;
  
  // Remove any query parameters from the filename (like ?v=1234567890)
  const cleanY = y.split('?')[0];
  
  console.log(`[TILES] Request: ${region}/${z}/${x}/${y} -> cleaned to: ${cleanY}`);
  
  if (region !== 'gozo' && region !== 'comino') {
    return res.status(400).send('Invalid region specified.');
  }

  const tileFile = path.join(TILE_CACHE_DIR, region, z, x, `${cleanY}.png`);

  // Set proper headers for all responses
  res.setHeader('Content-Type', 'image/png');
  
  // 1. Check if tile exists in our pre-downloaded cache
  if (fs.existsSync(tileFile)) {
    // Check if file is not corrupted (has reasonable size)
    const stats = fs.statSync(tileFile);
    if (stats.size > 0) {
      console.log(`[TILES] Serving cached tile: ${tileFile} (${stats.size} bytes)`);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(tileFile);
    } else {
      // Remove corrupted file
      console.log(`[TILES] Removing corrupted tile: ${tileFile} (${stats.size} bytes)`);
      fs.unlinkSync(tileFile);
    }
  } else {
    console.log(`[TILES] Tile not found in cache: ${tileFile}`);
  }

  // 2. If not, fetch from the online satellite server as a fallback
  try {
    const tileUrl = SATELLITE_TILE_URL.replace('{z}', z).replace('{y}', cleanY).replace('{x}', x);
    const response = await axios({
      method: 'GET',
      url: tileUrl,
      responseType: 'stream',
      headers: { 'User-Agent': 'DiscoverGozoApp/1.0 (Node.js Backend)' },
      timeout: 10000 // 10 second timeout
    });
    
    // Ensure the directory for the new tile exists
    const dir = path.dirname(tileFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Cache the downloaded tile and then serve it
    const writer = fs.createWriteStream(tileFile);
    
    // Set cache headers for successful responses
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    
    // Pipe response to both file and client
    response.data.pipe(writer);
    response.data.pipe(res);

    writer.on('finish', () => {
      console.log(`Tile cached: ${region}/${z}/${x}/${cleanY}.png`);
    });
    writer.on('error', (err) => {
      console.error('Error writing tile to cache:', err);
      // If there's an error writing, we don't want to leave a partial file
      fs.unlink(tileFile, () => {}); 
    });

  } catch (error) {
    console.error(`Error fetching satellite tile ${z}/${x}/${cleanY}.png:`, error.message);
    
    // Set no-cache headers for failed requests to prevent browser caching of 404s
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.status(404).send('Tile not found');
  }
});

// Route to clear tile cache (for debugging/admin purposes)
router.delete('/cache/:region?', (req, res) => {
  const { region } = req.params;
  
  try {
    if (region) {
      // Clear specific region cache
      const regionDir = path.join(TILE_CACHE_DIR, region);
      if (fs.existsSync(regionDir)) {
        fs.rmSync(regionDir, { recursive: true, force: true });
        console.log(`Cleared tile cache for region: ${region}`);
        res.json({ message: `Cleared tile cache for region: ${region}` });
      } else {
        res.status(404).json({ error: `Region cache not found: ${region}` });
      }
    } else {
      // Clear all tile cache
      if (fs.existsSync(TILE_CACHE_DIR)) {
        fs.rmSync(TILE_CACHE_DIR, { recursive: true, force: true });
        fs.mkdirSync(TILE_CACHE_DIR, { recursive: true });
        console.log('Cleared all tile cache');
        res.json({ message: 'Cleared all tile cache' });
      } else {
        res.json({ message: 'No tile cache to clear' });
      }
    }
  } catch (error) {
    console.error('Error clearing tile cache:', error);
    res.status(500).json({ error: 'Failed to clear tile cache' });
  }
});

// Route to get tile cache status
router.get('/cache/status', (req, res) => {
  try {
    const getDirSize = (dirPath) => {
      let totalSize = 0;
      let fileCount = 0;
      
      if (fs.existsSync(dirPath)) {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            const subResult = getDirSize(itemPath);
            totalSize += subResult.size;
            fileCount += subResult.count;
          } else {
            totalSize += stats.size;
            fileCount++;
          }
        }
      }
      
      return { size: totalSize, count: fileCount };
    };
    
    const gozoCache = getDirSize(path.join(TILE_CACHE_DIR, 'gozo'));
    const cominoCache = getDirSize(path.join(TILE_CACHE_DIR, 'comino'));
    
    res.json({
      gozo: {
        size: gozoCache.size,
        count: gozoCache.count,
        sizeFormatted: `${(gozoCache.size / 1024 / 1024).toFixed(2)} MB`
      },
      comino: {
        size: cominoCache.size,
        count: cominoCache.count,
        sizeFormatted: `${(cominoCache.size / 1024 / 1024).toFixed(2)} MB`
      },
      total: {
        size: gozoCache.size + cominoCache.size,
        count: gozoCache.count + cominoCache.count,
        sizeFormatted: `${((gozoCache.size + cominoCache.size) / 1024 / 1024).toFixed(2)} MB`
      }
    });
  } catch (error) {
    console.error('Error getting tile cache status:', error);
    res.status(500).json({ error: 'Failed to get tile cache status' });
  }
});

module.exports = router;
