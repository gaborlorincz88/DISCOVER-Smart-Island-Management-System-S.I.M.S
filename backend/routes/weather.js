const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { requireAdminAuth, logAdminActivity } = require('../middleware/admin-auth');

// Weather data storage
const WEATHER_DATA_FILE = path.join(__dirname, '../data/weather.json');
const COASTLINE_DATA_FILE = path.join(__dirname, '../data/coastlines.json');
const ALARM_DATA_FILE = path.join(__dirname, '../data/condition-alarms.json');

// Weather data cache
let weatherCache = {
    data: null,
    lastUpdated: null,
    nextUpdate: null
};

// Cache duration: 10 minutes for more frequent updates
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// Ensure data directory exists
const ensureDataDir = async () => {
    const dataDir = path.dirname(WEATHER_DATA_FILE);
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }
};

// Weather data fetching and caching functions
const fetchWeatherFromAPI = async (apiKey) => {
    try {
        // Fetch current weather - using more precise Gozo coordinates
        const currentResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=36.0444&lon=14.2397&appid=${apiKey}&units=metric`);
        
        if (!currentResponse.ok) {
            throw new Error(`OpenWeatherMap API error: ${currentResponse.status}`);
        }
        
        const currentData = await currentResponse.json();
        
        // Fetch 7-day forecast - using more precise Gozo coordinates
        const forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=36.0444&lon=14.2397&appid=${apiKey}&units=metric`);
        
        if (!forecastResponse.ok) {
            throw new Error(`OpenWeatherMap Forecast API error: ${forecastResponse.status}`);
        }
        
        const forecastData = await forecastResponse.json();
        
        // Extract current weather data
        const weatherData = {
            temperature: currentData.main.temp,
            humidity: currentData.main.humidity,
            pressure: currentData.main.pressure,
            visibility: currentData.visibility,
            windSpeed: currentData.wind?.speed ? Math.round(currentData.wind.speed * 3.6) : null, // Convert m/s to km/h, rounded
            windDirection: currentData.wind?.deg || 0, // Default to 0 if no wind direction
            rainChance: currentData.rain ? (currentData.rain['1h'] || 0) * 100 : 0,
            // Estimated marine data
            waterTemperature: Math.max(currentData.main.temp - 3, 15), // Mediterranean climate
            waveHeight: estimateWaveHeight(currentData.wind?.speed || 0),
            waveDirection: currentData.wind?.deg,
            wavePeriod: estimateWavePeriod(currentData.wind?.speed || 0),
            lastUpdated: new Date().toISOString()
        };

        // Process 7-day forecast data
        const processForecast = (forecastList) => {
            const dailyForecasts = {};
            // Use Malta/Gozo timezone (Europe/Malta) consistently
            const timeZone = 'Europe/Malta';
            
            forecastList.forEach(item => {
                const date = new Date(item.dt * 1000);
                // Get date in Malta timezone to match local day
                const dateStr = date.toLocaleDateString('en-CA', { timeZone: timeZone }); // 'en-CA' gives YYYY-MM-DD format
                const dateKey = dateStr; // YYYY-MM-DD format in Malta timezone
                
                // Get day name using the same timezone to ensure consistency
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: timeZone });
                
                if (!dailyForecasts[dateKey]) {
                    dailyForecasts[dateKey] = {
                        date: dateKey,
                        dayName: dayName,
                        temperatures: [],
                        humidity: [],
                        windSpeed: [],
                        windDirection: [],
                        rainChance: [],
                        weather: [],
                        waterTemperature: [],
                        waveHeight: [],
                        waveDirection: []
                    };
                }
                
                const forecast = dailyForecasts[dateKey];
                forecast.temperatures.push(item.main.temp);
                forecast.humidity.push(item.main.humidity);
                forecast.windSpeed.push(item.wind?.speed ? (item.wind.speed * 3.6) : 0);
                forecast.windDirection.push(item.wind?.deg || 0);
                forecast.rainChance.push(item.pop ? item.pop * 100 : 0);
                forecast.weather.push(item.weather[0]);
                forecast.waterTemperature.push(Math.max(item.main.temp - 3, 15));
                forecast.waveHeight.push(estimateWaveHeight(item.wind?.speed || 0));
                forecast.waveDirection.push(item.wind?.deg || 0);
            });
            
            // Calculate daily averages and get min/max temps
            return Object.values(dailyForecasts).map(day => ({
                date: day.date,
                dayName: day.dayName,
                temperature: {
                    min: Math.min(...day.temperatures),
                    max: Math.max(...day.temperatures),
                    avg: day.temperatures.reduce((a, b) => a + b, 0) / day.temperatures.length
                },
                humidity: day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length,
                windSpeed: day.windSpeed.reduce((a, b) => a + b, 0) / day.windSpeed.length,
                windDirection: day.windDirection.reduce((a, b) => a + b, 0) / day.windDirection.length,
                rainChance: Math.max(...day.rainChance),
                weather: day.weather[Math.floor(day.weather.length / 2)], // Middle of day weather
                waterTemperature: day.waterTemperature.reduce((a, b) => a + b, 0) / day.waterTemperature.length,
                waveHeight: day.waveHeight.reduce((a, b) => a + b, 0) / day.waveHeight.length,
                waveDirection: day.waveDirection.reduce((a, b) => a + b, 0) / day.waveDirection.length
            })).slice(0, 7); // Limit to 7 days
        };

        const forecast = processForecast(forecastData.list);
        
        return { ...weatherData, forecast };
    } catch (error) {
        console.error('Error fetching weather from API:', error);
        throw error;
    }
};

// Marine data estimation functions - improved for Mediterranean conditions
const estimateWaveHeight = (windSpeed) => {
    // More accurate wave height estimation for Mediterranean Sea
    if (windSpeed < 1) return 0.1;
    if (windSpeed < 3) return 0.3;
    if (windSpeed < 6) return 0.6;
    if (windSpeed < 10) return 1.0;
    if (windSpeed < 15) return 1.5;
    if (windSpeed < 20) return 2.0;
    if (windSpeed < 25) return 2.5;
    return Math.min(windSpeed * 0.12, 3.5); // More conservative for Mediterranean
};

const estimateWavePeriod = (windSpeed) => {
    if (windSpeed < 2) return 3;
    if (windSpeed < 5) return 4;
    if (windSpeed < 10) return 5;
    if (windSpeed < 15) return 6;
    if (windSpeed < 20) return 7;
    return Math.min(windSpeed * 0.4, 10);
};

// Check if cache needs update
const isCacheExpired = () => {
    if (!weatherCache.lastUpdated) return true;
    return Date.now() - weatherCache.lastUpdated > CACHE_DURATION;
};

// Update weather cache
const updateWeatherCache = async () => {
    try {
        // Load API key from stored data
        const storedData = await fs.readFile(WEATHER_DATA_FILE, 'utf8');
        const weatherData = JSON.parse(storedData);
        
        if (!weatherData.apis?.openweathermap) {
            console.log('No OpenWeatherMap API key found, using cached data');
            console.log('Current weather data structure:', {
                hasApis: !!weatherData.apis,
                openweathermap: weatherData.apis?.openweathermap,
                hasData: !!weatherData.data
            });
            return;
        }
        
        console.log('Fetching fresh weather data from API...');
        const freshData = await fetchWeatherFromAPI(weatherData.apis.openweathermap);
        
        console.log('Fresh weather data received:', {
            temperature: freshData.temperature,
            windSpeed: freshData.windSpeed,
            windDirection: freshData.windDirection,
            waveHeight: freshData.waveHeight,
            hasData: !!freshData,
            timestamp: new Date().toISOString()
        });
        
        // Update cache
        weatherCache.data = freshData;
        weatherCache.lastUpdated = Date.now();
        weatherCache.nextUpdate = new Date(Date.now() + CACHE_DURATION);
        
        // Save to file
        await fs.writeFile(WEATHER_DATA_FILE, JSON.stringify({
            lastUpdated: freshData.lastUpdated,
            data: freshData,
            apis: weatherData.apis
        }, null, 2));
        
        console.log(`Weather data updated. Next update: ${weatherCache.nextUpdate.toLocaleTimeString()}`);
    } catch (error) {
        console.error('Error updating weather cache:', error);
    }
};

// Initialize default data files
const initializeDataFiles = async () => {
    await ensureDataDir();
    
    // Initialize weather data file
    try {
        await fs.access(WEATHER_DATA_FILE);
    } catch {
        await fs.writeFile(WEATHER_DATA_FILE, JSON.stringify({
            lastUpdated: null,
            data: null,
            apis: {
                openweathermap: null,
                stormglass: null
            }
        }, null, 2));
    }
    
    // Initialize coastline data file
    try {
        await fs.access(COASTLINE_DATA_FILE);
    } catch {
        await fs.writeFile(COASTLINE_DATA_FILE, JSON.stringify({
            coastlines: [],
            activeCoastline: null
        }, null, 2));
    }
};

// Initialize on startup
initializeDataFiles();

// Start scheduled weather updates (every 15 minutes)
setInterval(async () => {
    console.log('Scheduled weather update check...');
    if (isCacheExpired()) {
        await updateWeatherCache();
    }
}, CACHE_DURATION);

// Check API key status
router.get('/api-status', async (req, res) => {
    try {
        const data = await fs.readFile(WEATHER_DATA_FILE, 'utf8');
        const weatherData = JSON.parse(data);
        
        console.log('API Status Check - Full weather data:', JSON.stringify(weatherData, null, 2));
        
        res.json({
            success: true,
            hasApiKey: !!weatherData.apis?.openweathermap,
            apiKeyPreview: weatherData.apis?.openweathermap ? `${weatherData.apis.openweathermap.substring(0, 8)}...` : null,
            hasData: !!weatherData.data,
            lastUpdated: weatherData.lastUpdated,
            fullData: weatherData // Include full data for debugging
        });
    } catch (error) {
        console.error('Error checking API status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check API status'
        });
    }
});

// Save API key
router.post('/save-api-key', requireAdminAuth, async (req, res) => {
    try {
        const { apiKey } = req.body;
        
        // Load existing data
        let weatherData;
        try {
            const data = await fs.readFile(WEATHER_DATA_FILE, 'utf8');
            weatherData = JSON.parse(data);
        } catch {
            weatherData = {
                lastUpdated: null,
                data: null,
                apis: { openweathermap: null, stormglass: null }
            };
        }
        
        // Update API key
        weatherData.apis.openweathermap = apiKey;
        
        console.log('Saving API key:', {
            apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : 'null',
            hasApis: !!weatherData.apis,
            openweathermap: weatherData.apis.openweathermap ? `${weatherData.apis.openweathermap.substring(0, 8)}...` : 'null'
        });
        
        // Save back to file
        await fs.writeFile(WEATHER_DATA_FILE, JSON.stringify(weatherData, null, 2));
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'WEATHER_API_KEY_UPDATE',
            'Updated weather API key',
            req.ip
        );
        
        console.log('API key saved successfully to file');
        
        res.json({
            success: true,
            message: 'API key saved successfully'
        });
    } catch (error) {
        console.error('Error saving API key:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save API key'
        });
    }
});

// Test weather fetch with hardcoded API key (for debugging)
router.post('/test-weather-fetch', requireAdminAuth, async (req, res) => {
    try {
        const { apiKey } = req.body;
        
        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API key required for test'
            });
        }
        
        console.log('Testing weather fetch with API key:', apiKey.substring(0, 8) + '...');
        
        const testData = await fetchWeatherFromAPI(apiKey);
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'WEATHER_TEST_FETCH',
            'Tested weather API fetch',
            'weather',
            null,
            { apiKeyPreview: apiKey.substring(0, 8) + '...' },
            req
        );
        
        res.json({
            success: true,
            message: 'Weather fetch test successful',
            data: testData
        });
    } catch (error) {
        console.error('Error testing weather fetch:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test weather fetch: ' + error.message
        });
    }
});

// Manual weather update endpoint
router.post('/update-now', requireAdminAuth, async (req, res) => {
    try {
        console.log('Manual weather update requested...');
        await updateWeatherCache();
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'WEATHER_UPDATE_MANUAL',
            'Manually triggered weather data update',
            'weather',
            null,
            { nextUpdate: weatherCache.nextUpdate?.toISOString() },
            req
        );
        
        res.json({
            success: true,
            message: 'Weather data updated successfully',
            nextUpdate: weatherCache.nextUpdate?.toISOString()
        });
    } catch (error) {
        console.error('Error updating weather data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update weather data'
        });
    }
});

// Get current weather data (with caching)
router.get('/current', async (req, res) => {
    try {
        // Check if cache needs update
        if (isCacheExpired()) {
            console.log('Cache expired, updating weather data...');
            await updateWeatherCache();
        }
        
        // Try to load data from file
        let weatherData;
        try {
            const data = await fs.readFile(WEATHER_DATA_FILE, 'utf8');
            weatherData = JSON.parse(data);
        } catch (fileError) {
            console.log('Weather data file not found, creating default data...');
            // Create default weather data if file doesn't exist
            weatherData = {
                data: {
                    temperature: 24,
                    humidity: 60,
                    pressure: 1013,
                    visibility: 10,
                    rainChance: 20,
                    waterTemperature: 22,
                    windSpeed: 5,
                    windDirection: 180,
                    waveHeight: 0.5,
                    wavePeriod: 4,
                    waveDirection: 180,
                    lastUpdated: new Date().toISOString(),
                    isDefaultData: true
                },
                lastUpdated: new Date().toISOString(),
                nextUpdate: new Date(Date.now() + CACHE_DURATION).toISOString(),
                apis: {
                    openweathermap: null
                }
            };
            
            // Save default data to file
            await ensureDataDir();
            await fs.writeFile(WEATHER_DATA_FILE, JSON.stringify(weatherData, null, 2));
        }
        
        console.log('Weather data from file:', {
            hasData: !!weatherData.data,
            lastUpdated: weatherData.lastUpdated,
            dataKeys: weatherData.data ? Object.keys(weatherData.data) : 'no data'
        });
        
        res.json({
            success: true,
            data: weatherData.data,
            lastUpdated: weatherData.lastUpdated,
            nextUpdate: weatherCache.nextUpdate?.toISOString(),
            cacheStatus: {
                isCached: !isCacheExpired(),
                lastUpdated: weatherCache.lastUpdated ? new Date(weatherCache.lastUpdated).toISOString() : null,
                nextUpdate: weatherCache.nextUpdate?.toISOString()
            }
        });
    } catch (error) {
        console.error('Error reading weather data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to read weather data'
        });
    }
});

// Update weather data
router.post('/update', async (req, res) => {
    try {
        const { weatherData, apiKeys } = req.body;
        
        const data = {
            lastUpdated: new Date().toISOString(),
            data: weatherData,
            apis: apiKeys || {}
        };
        
        await fs.writeFile(WEATHER_DATA_FILE, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: 'Weather data updated successfully',
            lastUpdated: data.lastUpdated
        });
    } catch (error) {
        console.error('Error updating weather data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update weather data'
        });
    }
});

// Get coastline data
router.get('/coastlines', async (req, res) => {
    try {
        const data = await fs.readFile(COASTLINE_DATA_FILE, 'utf8');
        const coastlineData = JSON.parse(data);
        
        res.json({
            success: true,
            coastlines: coastlineData.coastlines,
            activeCoastline: coastlineData.activeCoastline
        });
    } catch (error) {
        console.error('Error reading coastline data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to read coastline data'
        });
    }
});

// Save coastline data
router.post('/coastlines', requireAdminAuth, async (req, res) => {
    try {
        const { coastlines, activeCoastline } = req.body;
        
        const data = {
            coastlines: coastlines || [],
            activeCoastline: activeCoastline || null,
            lastUpdated: new Date().toISOString()
        };
        
        await fs.writeFile(COASTLINE_DATA_FILE, JSON.stringify(data, null, 2));
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'COASTLINES_UPDATE',
            `Updated coastline data (${data.coastlines.length} coastlines)`,
            'weather',
            null,
            { coastlinesCount: data.coastlines.length },
            req
        );
        
        res.json({
            success: true,
            message: 'Coastline data saved successfully',
            coastlines: data.coastlines.length
        });
    } catch (error) {
        console.error('Error saving coastline data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save coastline data'
        });
    }
});

// Get wave data for specific location
router.get('/waves/:lat/:lng', async (req, res) => {
    try {
        const { lat, lng } = req.params;
        
        // For now, return mock data
        // In production, this would fetch from weather APIs
        const mockWaveData = {
            height: 1.2 + Math.random() * 0.8, // 1.2-2.0m
            direction: 180 + (Math.random() - 0.5) * 60, // 150-210 degrees
            period: 6 + Math.random() * 4, // 6-10 seconds
            speed: 2.0 + Math.random() * 1.0, // 2.0-3.0 m/s
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: mockWaveData,
            location: { lat: parseFloat(lat), lng: parseFloat(lng) }
        });
    } catch (error) {
        console.error('Error fetching wave data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch wave data'
        });
    }
});

// Get weather forecast
router.get('/forecast', async (req, res) => {
    try {
        // Mock forecast data
        const forecast = [];
        for (let i = 0; i < 5; i++) {
            const date = new Date();
            date.setHours(date.getHours() + (i + 1) * 6);
            
            forecast.push({
                datetime: date.toISOString(),
                temperature: 20 + Math.random() * 10,
                humidity: 60 + Math.random() * 30,
                rainChance: Math.random() * 100,
                waveHeight: 0.5 + Math.random() * 2.0,
                waveDirection: 180 + (Math.random() - 0.5) * 60,
                windSpeed: 5 + Math.random() * 15,
                windDirection: Math.random() * 360
            });
        }
        
        res.json({
            success: true,
            forecast: forecast
        });
    } catch (error) {
        console.error('Error fetching forecast:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch forecast'
        });
    }
});

// Test weather APIs
router.post('/test-apis', requireAdminAuth, async (req, res) => {
    try {
        const { openweathermap } = req.body;
        const results = {
            openweathermap: { connected: false, error: null }
        };
        
        // Test OpenWeatherMap (Free)
        if (openweathermap) {
            try {
                const owmResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=36.046&lon=14.26&appid=${openweathermap}&units=metric`);
                if (owmResponse.ok) {
                    results.openweathermap.connected = true;
                } else {
                    results.openweathermap.error = `HTTP ${owmResponse.status}`;
                }
            } catch (error) {
                results.openweathermap.error = error.message;
            }
        }
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'WEATHER_TEST_APIS',
            'Tested weather API connections',
            'weather',
            null,
            results,
            req
        );
        
        res.json({
            success: true,
            results: results
        });
    } catch (error) {
        console.error('Error testing APIs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test APIs'
        });
    }
});

// Test weather data endpoint for wave testing
router.post('/test-weather', requireAdminAuth, async (req, res) => {
    try {
        const testData = req.body;
        
        // Validate required fields
        if (!testData.windSpeed || !testData.windDirection || !testData.waveHeight) {
            return res.status(400).json({
                success: false,
                error: 'Missing required test data fields'
            });
        }
        
        // Update weather cache with test data
        weatherCache = {
            data: testData,
            lastUpdated: new Date().toISOString(),
            nextUpdate: new Date(Date.now() + CACHE_DURATION).toISOString()
        };
        
        // Save test data to file
        await ensureDataDir();
        await fs.writeFile(WEATHER_DATA_FILE, JSON.stringify({
            data: testData,
            lastUpdated: weatherCache.lastUpdated,
            nextUpdate: weatherCache.nextUpdate,
            apis: {
                openweathermap: weatherCache.data?.apis?.openweathermap || null
            }
        }, null, 2));
        
        console.log('Test weather data applied:', {
            windSpeed: testData.windSpeed,
            windDirection: testData.windDirection,
            waveHeight: testData.waveHeight,
            isTestData: testData.isTestData
        });
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'WEATHER_TEST_DATA',
            'Applied test weather data for wave testing',
            'weather',
            null,
            testData,
            req
        );
        
        res.json({
            success: true,
            message: 'Test weather data applied successfully',
            data: testData
        });
        
    } catch (error) {
        console.error('Error applying test weather data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to apply test weather data'
        });
    }
});

// Wave settings endpoint
router.post('/wave-settings', requireAdminAuth, async (req, res) => {
    try {
        const waveSettings = req.body;
        
        // Validate required fields
        if (!waveSettings.speed || !waveSettings.distance || !waveSettings.amplitude) {
            return res.status(400).json({
                success: false,
                error: 'Missing required wave settings fields'
            });
        }
        
        // Save wave settings to file
        await ensureDataDir();
        const waveSettingsFile = path.join(__dirname, '../data/wave-settings.json');
        await fs.writeFile(waveSettingsFile, JSON.stringify({
            ...waveSettings,
            lastUpdated: new Date().toISOString()
        }, null, 2));
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'WAVE_SETTINGS_UPDATE',
            'Updated wave animation settings',
            'weather',
            null,
            waveSettings,
            req
        );
        
        console.log('Wave settings saved:', waveSettings);
        
        res.json({
            success: true,
            message: 'Wave settings saved successfully',
            settings: waveSettings
        });
        
    } catch (error) {
        console.error('Error saving wave settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save wave settings'
        });
    }
});

// Get wave settings endpoint
router.get('/wave-settings', async (req, res) => {
    try {
        const waveSettingsFile = path.join(__dirname, '../data/wave-settings.json');
        
        try {
            const settingsData = await fs.readFile(waveSettingsFile, 'utf8');
            const settings = JSON.parse(settingsData);
            res.json({
                success: true,
                settings: settings
            });
        } catch (fileError) {
            // Return default settings if file doesn't exist
            const defaultSettings = {
                speed: 1.0,
                distance: 100,
                amplitude: 1.0,
                frequency: 2,
                layers: 3,
                opacity: 70,
                lastUpdated: new Date().toISOString()
            };
            res.json({
                success: true,
                settings: defaultSettings
            });
        }
        
    } catch (error) {
        console.error('Error getting wave settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get wave settings'
        });
    }
});

// Clear test weather data endpoint
router.post('/clear-test-weather', requireAdminAuth, async (req, res) => {
    try {
        // Clear the weather cache to force a fresh fetch
        weatherCache = {
            data: null,
            lastUpdated: null,
            nextUpdate: null
        };
        
        // Delete the weather data file to force fresh data
        try {
            await fs.unlink(WEATHER_DATA_FILE);
            console.log('Weather data file deleted, will fetch fresh data on next request');
        } catch (fileError) {
            console.log('Weather data file not found, will fetch fresh data on next request');
        }
        
        console.log('Test weather data cleared, will fetch real weather data on next request');
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'WEATHER_CLEAR_TEST',
            'Cleared test weather data',
            'weather',
            null,
            null,
            req
        );
        
        res.json({
            success: true,
            message: 'Test weather data cleared successfully'
        });
        
    } catch (error) {
        console.error('Error clearing test weather data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear test weather data'
        });
    }
});

// ===== CONDITION ALARM ENDPOINTS =====

// Get all condition alarms
router.get('/condition-alarms', async (req, res) => {
    try {
        await ensureDataDir();
        
        try {
            const alarmData = await fs.readFile(ALARM_DATA_FILE, 'utf8');
            const alarms = JSON.parse(alarmData);
            res.json({
                success: true,
                alarms: alarms
            });
        } catch (fileError) {
            // Return empty alarms if file doesn't exist
            res.json({
                success: true,
                alarms: []
            });
        }
        
    } catch (error) {
        console.error('Error getting condition alarms:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get condition alarms'
        });
    }
});

// Create or update a condition alarm
router.post('/condition-alarms', requireAdminAuth, async (req, res) => {
    try {
        const { id, type, title, description, coordinates, severity, isActive, icon, color, iconSize } = req.body;
        
        // Validate required fields
        if (!type || !title || !coordinates) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, title, coordinates'
            });
        }
        
        await ensureDataDir();
        
        // Load existing alarms
        let alarms = [];
        try {
            const alarmData = await fs.readFile(ALARM_DATA_FILE, 'utf8');
            alarms = JSON.parse(alarmData);
        } catch (fileError) {
            // File doesn't exist, start with empty array
        }
        
        // Create alarm object
        const alarm = {
            id: id || `alarm_${Date.now()}`,
            type, // 'jellyfish', 'tsunami', 'shark', etc.
            title,
            description: description || '',
            coordinates: {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            },
            severity: severity || 'medium', // 'low', 'medium', 'high', 'critical'
            isActive: isActive !== undefined ? isActive : true,
            icon: icon || getDefaultIcon(type),
            color: color || getDefaultColor(severity || 'medium'),
            iconSize: iconSize || 50, // Default icon size in pixels
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Update existing alarm or add new one
        const existingIndex = alarms.findIndex(a => a.id === alarm.id);
        if (existingIndex >= 0) {
            alarms[existingIndex] = { ...alarms[existingIndex], ...alarm, createdAt: alarms[existingIndex].createdAt };
        } else {
            alarms.push(alarm);
        }
        
        // Save alarms
        await fs.writeFile(ALARM_DATA_FILE, JSON.stringify(alarms, null, 2));
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            existingIndex >= 0 ? 'CONDITION_ALARM_UPDATE' : 'CONDITION_ALARM_CREATE',
            `${existingIndex >= 0 ? 'Updated' : 'Created'} condition alarm: ${title}`,
            req.ip
        );
        
        res.json({
            success: true,
            alarm: alarm,
            message: existingIndex >= 0 ? 'Alarm updated successfully' : 'Alarm created successfully'
        });
        
    } catch (error) {
        console.error('Error saving condition alarm:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save condition alarm'
        });
    }
});

// Delete a condition alarm
router.delete('/condition-alarms/:id', requireAdminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        await ensureDataDir();
        
        // Load existing alarms
        let alarms = [];
        try {
            const alarmData = await fs.readFile(ALARM_DATA_FILE, 'utf8');
            alarms = JSON.parse(alarmData);
        } catch (fileError) {
            return res.status(404).json({
                success: false,
                error: 'No alarms found'
            });
        }
        
        // Find alarm before deleting for logging
        const alarmToDelete = alarms.find(a => a.id === id);
        
        // Remove alarm
        const initialLength = alarms.length;
        alarms = alarms.filter(a => a.id !== id);
        
        if (alarms.length === initialLength) {
            return res.status(404).json({
                success: false,
                error: 'Alarm not found'
            });
        }
        
        // Save updated alarms
        await fs.writeFile(ALARM_DATA_FILE, JSON.stringify(alarms, null, 2));
        
        // Log admin activity
        logAdminActivity(
            req.admin.id,
            req.admin.email,
            'CONDITION_ALARM_DELETE',
            `Deleted condition alarm: ${alarmToDelete ? alarmToDelete.title : id}`,
            req.ip
        );
        
        res.json({
            success: true,
            message: 'Alarm deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting condition alarm:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete condition alarm'
        });
    }
});

// Helper functions for default values
const getDefaultIcon = (type) => {
    const icons = {
        'jellyfish': '🪼',
        'tsunami': '🌊',
        'shark': '🦈',
        'storm': '⛈️',
        'wind': '💨',
        'current': '🌊',
        'pollution': '☠️',
        'other': '⚠️'
    };
    return icons[type] || icons['other'];
};

const getDefaultColor = (severity) => {
    const colors = {
        'low': '#10B981', // green
        'medium': '#F59E0B', // yellow
        'high': '#EF4444', // red
        'critical': '#DC2626' // dark red
    };
    return colors[severity] || colors['medium'];
};

module.exports = router;
