// Weather Admin JavaScript
class WeatherAdmin {
    constructor() {
        this.map = null;
        this.coastlineLayer = null;
        this.coastlineMarkers = [];
        this.coastlinePolygon = null;
        this.isDrawing = false;
        this.currentCoastline = [];
        this.coastlines = [];
        this.weatherData = {
            temperature: null,
            humidity: null,
            rainChance: null,
            waterTemperature: null,
            waveHeight: null,
            waveDirection: null,
            wavePeriod: null
        };
        this.apiKeys = {
            openweathermap: '',
            stormglass: ''
        };
        this.updateInterval = 10; // minutes
        
        this.init();
    }

    init() {
        this.initMap();
        this.loadCoastlines();
        this.loadApiKeys();
        this.bindEvents();
        this.startWeatherUpdates();
        this.initWaveTesting();
        this.initAlarmManagement();
    }

    initMap() {
        // Initialize map centered on Gozo
        this.map = L.map('map').setView([36.046, 14.26], 12);
        
        // Add tile layer
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
        }).addTo(this.map);

        // Initialize coastline layer
        this.coastlineLayer = L.layerGroup().addTo(this.map);
        
        // Add map click event for drawing
        this.map.on('click', (e) => {
            if (this.isDrawing) {
                this.addCoastlinePoint(e.latlng);
            }
        });
    }

    bindEvents() {
        // Drawing controls
        document.getElementById('start-drawing-btn').addEventListener('click', () => this.startDrawing());
        document.getElementById('finish-drawing-btn').addEventListener('click', () => this.finishDrawing());
        document.getElementById('clear-coastline-btn').addEventListener('click', () => this.clearCoastline());
        document.getElementById('save-coastline-btn').addEventListener('click', () => this.saveCoastline());

        // API controls
        document.getElementById('test-apis-btn').addEventListener('click', () => this.testApis());
        document.getElementById('save-api-keys-btn').addEventListener('click', () => this.saveApiKeys());
        document.getElementById('update-weather-btn').addEventListener('click', () => this.updateWeatherNow());
        document.getElementById('test-weather-btn').addEventListener('click', () => this.testWeatherFetch());

        // Load API keys into form
        document.getElementById('openweathermap-api-key').addEventListener('input', (e) => {
            this.apiKeys.openweathermap = e.target.value;
        });
    }

    startDrawing() {
        this.isDrawing = true;
        this.currentCoastline = [];
        this.updateDrawingStatus('Drawing mode active - click on map to add points', true);
        
        document.getElementById('start-drawing-btn').disabled = true;
        document.getElementById('finish-drawing-btn').disabled = false;
    }

    finishDrawing() {
        this.isDrawing = false;
        this.updateDrawingStatus('Click to start drawing coastline', false);
        
        if (this.currentCoastline.length > 2) {
            this.createCoastlinePolygon();
        }
        
        document.getElementById('start-drawing-btn').disabled = false;
        document.getElementById('finish-drawing-btn').disabled = true;
    }

    addCoastlinePoint(latlng) {
        if (!this.isDrawing) return;

        this.currentCoastline.push([latlng.lat, latlng.lng]);
        
        // Add marker
        const marker = L.circleMarker(latlng, {
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.8,
            radius: 6
        }).addTo(this.coastlineLayer);
        
        this.coastlineMarkers.push(marker);
        
        // Update drawing status
        this.updateDrawingStatus(`Drawing mode - ${this.currentCoastline.length} points added`, true);
    }

    createCoastlinePolygon() {
        if (this.currentCoastline.length < 3) return;

        // Close the polygon
        const closedCoastline = [...this.currentCoastline, this.currentCoastline[0]];
        
        // Create polygon
        this.coastlinePolygon = L.polygon(closedCoastline, {
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            fillColor: '#10b981',
            fillOpacity: 0.2
        }).addTo(this.coastlineLayer);

        // Add dashed line for coastline
        const coastlineLine = L.polyline(closedCoastline, {
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 5'
        }).addTo(this.coastlineLayer);
    }

    clearCoastline() {
        this.coastlineLayer.clearLayers();
        this.coastlineMarkers = [];
        this.currentCoastline = [];
        this.coastlinePolygon = null;
        this.updateDrawingStatus('Click to start drawing coastline', false);
    }

    async saveCoastline() {
        if (this.currentCoastline.length < 3) {
            alert('Please draw at least 3 points to create a coastline');
            return;
        }

        const name = document.getElementById('coastline-name').value || 'Unnamed Coastline';
        const coastline = {
            id: Date.now().toString(),
            name: name,
            points: this.currentCoastline,
            created: new Date().toISOString()
        };

        this.coastlines.push(coastline);
        
        // Save to localStorage
        this.saveCoastlinesToStorage();
        
        // Save to server
        try {
            const response = await fetch('/api/weather/coastlines', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Send cookies for authentication
                body: JSON.stringify({
                    coastlines: this.coastlines,
                    activeCoastline: this.coastlines[this.coastlines.length - 1] // Set the new one as active
                })
            });
            
            if (response.ok) {
                console.log('Coastline saved to server successfully');
            } else {
                console.error('Failed to save coastline to server');
            }
        } catch (error) {
            console.error('Error saving coastline to server:', error);
        }
        
        this.updateCoastlineList();
        
        // Clear current drawing
        this.clearCoastline();
        document.getElementById('coastline-name').value = '';
        
        alert('Coastline saved successfully!');
    }

    updateCoastlineList() {
        const list = document.getElementById('coastline-list');
        list.innerHTML = '';

        this.coastlines.forEach(coastline => {
            const item = document.createElement('div');
            item.className = 'coastline-item';
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${coastline.name}</strong>
                        <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">
                            ${coastline.points.length} points • ${new Date(coastline.created).toLocaleDateString()}
                        </div>
                    </div>
                    <div>
                        <button onclick="weatherAdmin.loadCoastline('${coastline.id}')" class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="weatherAdmin.deleteCoastline('${coastline.id}')" class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });
    }

    loadCoastline(id) {
        const coastline = this.coastlines.find(c => c.id === id);
        if (!coastline) return;

        this.clearCoastline();
        
        // Load coastline points
        coastline.points.forEach(point => {
            const marker = L.circleMarker([point[0], point[1]], {
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.8,
                radius: 6
            }).addTo(this.coastlineLayer);
            this.coastlineMarkers.push(marker);
        });

        // Create polygon
        const closedCoastline = [...coastline.points, coastline.points[0]];
        this.coastlinePolygon = L.polygon(closedCoastline, {
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            fillColor: '#10b981',
            fillOpacity: 0.2
        }).addTo(this.coastlineLayer);

        // Add dashed line
        L.polyline(closedCoastline, {
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 5'
        }).addTo(this.coastlineLayer);

        // Fit map to coastline
        this.map.fitBounds(this.coastlinePolygon.getBounds());
    }

    deleteCoastline(id) {
        if (confirm('Are you sure you want to delete this coastline?')) {
            this.coastlines = this.coastlines.filter(c => c.id !== id);
            this.saveCoastlinesToStorage();
            this.updateCoastlineList();
        }
    }

    updateDrawingStatus(message, isActive) {
        const status = document.getElementById('drawing-status');
        status.innerHTML = `<i class="fas fa-mouse-pointer"></i><span>${message}</span>`;
        status.className = `drawing-mode ${isActive ? 'active' : ''}`;
    }

    // Weather API Methods
    async testApis() {
        this.updateApiStatus('openweathermap', 'loading');

        try {
            // Test OpenWeatherMap API (Free)
            if (this.apiKeys.openweathermap) {
                const owmResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=36.046&lon=14.26&appid=${this.apiKeys.openweathermap}&units=metric`);
                if (owmResponse.ok) {
                    this.updateApiStatus('openweathermap', 'connected');
                } else {
                    this.updateApiStatus('openweathermap', 'disconnected');
                }
            } else {
                this.updateApiStatus('openweathermap', 'disconnected');
            }
        } catch (error) {
            console.error('API test error:', error);
            this.updateApiStatus('openweathermap', 'disconnected');
        }
    }

    updateApiStatus(api, status) {
        const statusElement = document.getElementById(`${api}-status`);
        if (statusElement) {
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusElement.className = `api-status ${status}`;
        }
    }

    async fetchWeatherData() {
        try {
            // Fetch cached weather data from server
            const response = await fetch('/api/weather/current', {
                credentials: 'include' // Send cookies for authentication
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Weather API response:', result);
                
                if (result.success && result.data) {
                    this.weatherData = result.data;
                    this.cacheStatus = result.cacheStatus;
                    console.log('Weather data loaded successfully:', {
                        temperature: result.data.temperature,
                        windSpeed: result.data.windSpeed,
                        hasData: !!result.data
                    });
                } else {
                    console.error('No weather data in response:', result);
                    throw new Error('No weather data available');
                }
            } else {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }

            this.updateWeatherDisplay();
        } catch (error) {
            console.error('Weather fetch error:', error);
            // Set default values on error
            this.weatherData = {
                temperature: null,
                humidity: null,
                rainChance: null,
                waterTemperature: null,
                waveHeight: null,
                waveDirection: null,
                wavePeriod: null,
                windSpeed: null,
                windDirection: null,
                pressure: null,
                visibility: null
            };
            this.updateWeatherDisplay();
        }
    }

    updateWeatherDisplay() {
        if (!this.weatherData) return;

        // Update temperature
        if (this.weatherData.temperature !== null && this.weatherData.temperature !== undefined) {
            document.getElementById('current-temp').textContent = `${Math.round(this.weatherData.temperature)}°C`;
            document.getElementById('temp-description').textContent = this.getTemperatureDescription(this.weatherData.temperature);
        } else {
            document.getElementById('current-temp').textContent = '--°C';
            document.getElementById('temp-description').textContent = 'No data available';
        }

        // Update humidity
        if (this.weatherData.humidity !== null && this.weatherData.humidity !== undefined) {
            document.getElementById('current-humidity').textContent = `${Math.round(this.weatherData.humidity)}%`;
            document.getElementById('humidity-description').textContent = this.getHumidityDescription(this.weatherData.humidity);
        } else {
            document.getElementById('current-humidity').textContent = '--%';
            document.getElementById('humidity-description').textContent = 'No data available';
        }

        // Update rain chance
        if (this.weatherData.rainChance !== null && this.weatherData.rainChance !== undefined) {
            document.getElementById('rain-chance').textContent = `${Math.round(this.weatherData.rainChance)}%`;
            document.getElementById('rain-description').textContent = this.getRainDescription(this.weatherData.rainChance);
        } else {
            document.getElementById('rain-chance').textContent = '--%';
            document.getElementById('rain-description').textContent = 'No data available';
        }

        // Update water temperature
        if (this.weatherData.waterTemperature !== null && this.weatherData.waterTemperature !== undefined) {
            document.getElementById('water-temp').textContent = `${Math.round(this.weatherData.waterTemperature)}°C`;
            document.getElementById('water-description').textContent = this.getWaterTempDescription(this.weatherData.waterTemperature);
        } else {
            document.getElementById('water-temp').textContent = '--°C';
            document.getElementById('water-description').textContent = 'No data available';
        }

        // Update wave height
        if (this.weatherData.waveHeight !== null && this.weatherData.waveHeight !== undefined) {
            document.getElementById('wave-height').textContent = `${this.weatherData.waveHeight.toFixed(1)}m`;
            document.getElementById('wave-description').textContent = this.getWaveDescription(this.weatherData.waveHeight);
        } else {
            document.getElementById('wave-height').textContent = '--m';
            document.getElementById('wave-description').textContent = 'No data available';
        }

        // Update wind speed
        if (this.weatherData.windSpeed !== null && this.weatherData.windSpeed !== undefined) {
            document.getElementById('wind-speed').textContent = `${this.weatherData.windSpeed}km/h`;
            document.getElementById('wind-description').textContent = this.getWindDescription(parseFloat(this.weatherData.windSpeed));
        } else {
            document.getElementById('wind-speed').textContent = '--km/h';
            document.getElementById('wind-description').textContent = 'No data available';
        }

        // Update wind direction
        if (this.weatherData.windDirection !== null && this.weatherData.windDirection !== undefined) {
            document.getElementById('wind-direction').textContent = `${Math.round(this.weatherData.windDirection)}°`;
            document.getElementById('wind-direction-text').textContent = this.getWindDirectionText(this.weatherData.windDirection);
        } else {
            document.getElementById('wind-direction').textContent = '--°';
            document.getElementById('wind-direction-text').textContent = 'No data available';
        }

        // Update visibility
        if (this.weatherData.visibility !== null && this.weatherData.visibility !== undefined) {
            document.getElementById('visibility').textContent = `${(this.weatherData.visibility / 1000).toFixed(1)}km`;
            document.getElementById('visibility-description').textContent = this.getVisibilityDescription(this.weatherData.visibility);
        } else {
            document.getElementById('visibility').textContent = '--km';
            document.getElementById('visibility-description').textContent = 'No data available';
        }

        // Update pressure
        if (this.weatherData.pressure !== null && this.weatherData.pressure !== undefined) {
            document.getElementById('pressure').textContent = `${Math.round(this.weatherData.pressure)}hPa`;
            document.getElementById('pressure-description').textContent = this.getPressureDescription(this.weatherData.pressure);
        } else {
            document.getElementById('pressure').textContent = '--hPa';
            document.getElementById('pressure-description').textContent = 'No data available';
        }

        // Update cache status
        this.updateCacheStatus();
    }

    getTemperatureDescription(temp) {
        if (temp < 10) return 'Very cold';
        if (temp < 20) return 'Cool';
        if (temp < 25) return 'Mild';
        if (temp < 30) return 'Warm';
        return 'Hot';
    }

    getHumidityDescription(humidity) {
        if (humidity < 30) return 'Very dry';
        if (humidity < 50) return 'Dry';
        if (humidity < 70) return 'Comfortable';
        if (humidity < 90) return 'Humid';
        return 'Very humid';
    }

    getRainDescription(rainChance) {
        if (rainChance < 20) return 'Clear skies';
        if (rainChance < 40) return 'Light rain possible';
        if (rainChance < 60) return 'Moderate rain likely';
        if (rainChance < 80) return 'Heavy rain expected';
        return 'Very heavy rain';
    }

    getWaterTempDescription(temp) {
        if (temp < 15) return 'Very cold water';
        if (temp < 20) return 'Cold water';
        if (temp < 25) return 'Cool water';
        if (temp < 28) return 'Warm water';
        return 'Very warm water';
    }

    getWaveDescription(height) {
        if (height < 0.5) return 'Calm seas';
        if (height < 1.0) return 'Light waves';
        if (height < 2.0) return 'Moderate waves';
        if (height < 3.0) return 'Rough seas';
        return 'Very rough seas';
    }

    getWindDescription(speed) {
        // Speed is now in km/h, so adjust thresholds accordingly
        if (speed < 7.2) return 'Calm'; // < 2 m/s
        if (speed < 21.6) return 'Light breeze'; // 2-6 m/s
        if (speed < 43.2) return 'Gentle breeze'; // 6-12 m/s
        if (speed < 72) return 'Moderate breeze'; // 12-20 m/s
        if (speed < 108) return 'Fresh breeze'; // 20-30 m/s
        if (speed < 144) return 'Strong breeze'; // 30-40 m/s
        return 'Very strong wind'; // > 40 m/s
    }

    getWindDirectionText(degrees) {
        if (degrees === null || degrees === undefined) return 'No data';
        
        const directions = [
            'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
            'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
        ];
        
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    }

    getVisibilityDescription(visibility) {
        if (visibility < 1000) return 'Very poor visibility';
        if (visibility < 2000) return 'Poor visibility';
        if (visibility < 5000) return 'Moderate visibility';
        if (visibility < 10000) return 'Good visibility';
        return 'Excellent visibility';
    }

    getPressureDescription(pressure) {
        if (pressure < 1000) return 'Low pressure';
        if (pressure < 1013) return 'Below average';
        if (pressure < 1020) return 'Normal pressure';
        if (pressure < 1030) return 'Above average';
        return 'High pressure';
    }

    // Estimation functions for marine data (since OpenWeatherMap free tier doesn't include marine data)
    estimateWaterTemperature(airTemp) {
        if (!airTemp) return null;
        // Water temperature is typically 2-4°C cooler than air temperature in Mediterranean
        return Math.max(airTemp - 3, 15); // Minimum 15°C for Mediterranean
    }

    estimateWaveHeight(windSpeed) {
        if (!windSpeed) return null;
        // Simplified wave height estimation based on wind speed
        if (windSpeed < 2) return 0.2;
        if (windSpeed < 5) return 0.5;
        if (windSpeed < 10) return 1.0;
        if (windSpeed < 15) return 1.5;
        if (windSpeed < 20) return 2.0;
        return Math.min(windSpeed * 0.15, 4.0); // Cap at 4m
    }

    estimateWavePeriod(windSpeed) {
        if (!windSpeed) return null;
        // Wave period estimation (seconds)
        if (windSpeed < 2) return 3;
        if (windSpeed < 5) return 4;
        if (windSpeed < 10) return 5;
        if (windSpeed < 15) return 6;
        if (windSpeed < 20) return 7;
        return Math.min(windSpeed * 0.4, 10); // Cap at 10 seconds
    }

    async updateWeatherNow() {
        try {
            const updateBtn = document.getElementById('update-weather-btn');
            updateBtn.disabled = true;
            updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            
            const response = await fetch('/api/weather/update-now', { 
                method: 'POST',
                credentials: 'include' // Send cookies for authentication
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Weather updated:', result);
                
                // Refresh weather data
                await this.fetchWeatherData();
                
                alert('Weather data updated successfully!');
            } else {
                throw new Error(`Update failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Error updating weather:', error);
            alert('Failed to update weather data: ' + error.message);
        } finally {
            const updateBtn = document.getElementById('update-weather-btn');
            updateBtn.disabled = false;
            updateBtn.innerHTML = '<i class="fas fa-sync"></i> Update Now';
        }
    }

    async testWeatherFetch() {
        try {
            const apiKey = document.getElementById('openweathermap-api-key').value;
            
            if (!apiKey) {
                alert('Please enter an API key first!');
                return;
            }
            
            const testBtn = document.getElementById('test-weather-btn');
            testBtn.disabled = true;
            testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
            
            console.log('Testing weather fetch with API key:', apiKey.substring(0, 8) + '...');
            
            const response = await fetch('/api/weather/test-weather-fetch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Send cookies for authentication
                body: JSON.stringify({ apiKey })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Weather fetch test result:', result);
                
                if (result.success && result.data) {
                    alert(`Weather fetch test successful!\nTemperature: ${result.data.temperature}°C\nWind Speed: ${result.data.windSpeed}km/h`);
                } else {
                    alert('Weather fetch test failed: ' + (result.error || 'Unknown error'));
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || `Test failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Error testing weather fetch:', error);
            alert('Weather fetch test failed: ' + error.message);
        } finally {
            const testBtn = document.getElementById('test-weather-btn');
            testBtn.disabled = false;
            testBtn.innerHTML = '<i class="fas fa-bug"></i> Test Fetch';
        }
    }

    updateCacheStatus() {
        const cacheStatusCard = document.getElementById('cache-status-card');
        const cacheStatus = document.getElementById('cache-status');
        const nextUpdate = document.getElementById('next-update');
        
        if (this.cacheStatus) {
            cacheStatusCard.style.display = 'block';
            
            if (this.cacheStatus.isCached) {
                cacheStatus.textContent = '✓ Data is cached (serving from cache)';
                cacheStatus.style.color = '#10b981';
            } else {
                cacheStatus.textContent = '⚠ Data is fresh (just fetched from API)';
                cacheStatus.style.color = '#f59e0b';
            }
            
            if (this.cacheStatus.nextUpdate) {
                const nextUpdateTime = new Date(this.cacheStatus.nextUpdate);
                nextUpdate.textContent = `Next update: ${nextUpdateTime.toLocaleTimeString()}`;
            } else {
                nextUpdate.textContent = 'Next update: --';
            }
        } else {
            cacheStatusCard.style.display = 'none';
        }
    }

    startWeatherUpdates() {
        // Check API status first
        this.checkApiStatus();
        
        // Initial fetch
        this.fetchWeatherData();
        
        // Set up interval
        setInterval(() => {
            this.fetchWeatherData();
        }, this.updateInterval * 60 * 1000);
    }

    // Storage methods
    saveCoastlinesToStorage() {
        localStorage.setItem('weather-coastlines', JSON.stringify(this.coastlines));
    }

    async loadCoastlines() {
        // First try to load from server
        try {
            const response = await fetch('/api/weather/coastlines', {
                credentials: 'include' // Send cookies for authentication
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.coastlines) {
                    this.coastlines = data.coastlines;
                    this.updateCoastlineList();
                    console.log('Loaded coastlines from server:', this.coastlines.length);
                    return;
                }
            }
        } catch (error) {
            console.error('Error loading coastlines from server:', error);
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('weather-coastlines');
        if (stored) {
            this.coastlines = JSON.parse(stored);
            this.updateCoastlineList();
            console.log('Loaded coastlines from localStorage:', this.coastlines.length);
        }
    }

    async saveApiKeys() {
        try {
            // Save OpenWeatherMap API key (free)
            this.apiKeys.openweathermap = document.getElementById('openweathermap-api-key').value;
            
            console.log('Attempting to save API key:', this.apiKeys.openweathermap ? this.apiKeys.openweathermap.substring(0, 8) + '...' : 'null');
            
            if (!this.apiKeys.openweathermap) {
                alert('Please enter an API key first!');
                return;
            }
            
            console.log('Sending API key to server...');
            
            // Save to server
            const response = await fetch('/api/weather/save-api-key', {
                method: 'POST',
                credentials: 'include', // Send cookies for authentication
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apiKey: this.apiKeys.openweathermap
                })
            });
            
            console.log('Server response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Server response:', result);
                
                // Also save to localStorage for UI persistence
                localStorage.setItem('weather-api-keys', JSON.stringify(this.apiKeys));
                alert('API key saved successfully!');
                
                // Check API status
                await this.checkApiStatus();
            } else {
                const errorData = await response.json();
                console.error('Server error response:', errorData);
                throw new Error(errorData.error || 'Failed to save API key to server');
            }
        } catch (error) {
            console.error('Error saving API key:', error);
            alert('Failed to save API key: ' + error.message);
        }
    }

    async checkApiStatus() {
        try {
            const response = await fetch('/api/weather/api-status', {
                credentials: 'include' // Send cookies for authentication
            });
            if (response.ok) {
                const status = await response.json();
                console.log('API Status:', status);
                
                // Update API status display
                const statusElement = document.getElementById('openweathermap-status');
                if (status.hasApiKey) {
                    statusElement.textContent = 'Connected';
                    statusElement.className = 'api-status connected';
                } else {
                    statusElement.textContent = 'Disconnected';
                    statusElement.className = 'api-status disconnected';
                }
            }
        } catch (error) {
            console.error('Error checking API status:', error);
        }
    }

    loadApiKeys() {
        const stored = localStorage.getItem('weather-api-keys');
        if (stored) {
            this.apiKeys = JSON.parse(stored);
            // Load OpenWeatherMap API key
            const owmInput = document.getElementById('openweathermap-api-key');
            if (owmInput) {
                owmInput.value = this.apiKeys.openweathermap || '';
            }
        }
    }

    // Export coastline data for use in main app
    exportCoastlineData() {
        return {
            coastlines: this.coastlines,
            activeCoastline: this.coastlines.find(c => c.active) || this.coastlines[0]
        };
    }

    // Wave Testing Methods
    initWaveTesting() {
        // Bind slider events
        const windSpeedSlider = document.getElementById('test-wind-speed');
        const windDirectionSlider = document.getElementById('test-wind-direction');
        const waveHeightSlider = document.getElementById('test-wave-height');
        
        if (windSpeedSlider) {
            windSpeedSlider.addEventListener('input', (e) => {
                document.getElementById('wind-speed-value').textContent = e.target.value;
            });
        }
        
        if (windDirectionSlider) {
            windDirectionSlider.addEventListener('input', (e) => {
                document.getElementById('wind-direction-value').textContent = e.target.value + '°';
            });
        }
        
        if (waveHeightSlider) {
            waveHeightSlider.addEventListener('input', (e) => {
                document.getElementById('wave-height-value').textContent = e.target.value;
            });
        }
        
        // Bind wave control sliders
        this.bindWaveControlSliders();
        
        // Bind button events
        const applyButton = document.getElementById('apply-test-weather');
        const refreshButton = document.getElementById('refresh-waves');
        const testButton = document.getElementById('test-localstorage');
        const resetButton = document.getElementById('reset-test-weather');
        const applyWaveButton = document.getElementById('apply-wave-settings');
        const resetWaveButton = document.getElementById('reset-wave-settings');
        
        if (applyButton) {
            applyButton.addEventListener('click', () => this.applyTestWeather());
        }
        
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.refreshMainAppWaveData());
        }
        
        if (testButton) {
            testButton.addEventListener('click', () => this.testLocalStorage());
        }
        
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetTestWeather());
        }
        
        if (applyWaveButton) {
            applyWaveButton.addEventListener('click', () => this.applyWaveSettings());
        }
        
        if (resetWaveButton) {
            resetWaveButton.addEventListener('click', () => this.resetWaveSettings());
        }
    }

    applyTestWeather() {
        const windSpeed = parseFloat(document.getElementById('test-wind-speed').value);
        const windDirection = parseFloat(document.getElementById('test-wind-direction').value);
        const waveHeight = parseFloat(document.getElementById('test-wave-height').value);
        
        // Create test weather data
        const testWeatherData = {
            temperature: 24,
            humidity: 60,
            pressure: 1013,
            visibility: 10,
            rainChance: 20,
            waterTemperature: 22,
            windSpeed: windSpeed,
            windDirection: windDirection,
            waveHeight: waveHeight,
            wavePeriod: Math.max(3, windSpeed / 10),
            waveDirection: windDirection,
            lastUpdated: new Date().toISOString(),
            isTestData: true
        };
        
        // Update the weather data
        this.weatherData = testWeatherData;
        
        // Update the display
        this.updateWeatherDisplay();
        
        // Send test data to backend
        this.sendTestWeatherToBackend(testWeatherData);
        
        // Signal main app to refresh wave data
        this.signalMainAppRefresh();
        
        console.log('Applied test weather:', testWeatherData);
    }

    async resetTestWeather() {
        // Reset sliders to default values
        document.getElementById('test-wind-speed').value = 0;
        document.getElementById('test-wind-direction').value = 0;
        document.getElementById('test-wave-height').value = 0.5;
        
        // Update display values
        document.getElementById('wind-speed-value').textContent = '0';
        document.getElementById('wind-direction-value').textContent = '0°';
        document.getElementById('wave-height-value').textContent = '0.5';
        
        // Clear test weather data from backend
        try {
            const response = await fetch('/api/weather/clear-test-weather', {
                method: 'POST',
                credentials: 'include', // Send cookies for authentication
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log('Test weather data cleared from backend');
            } else {
                console.error('Failed to clear test weather data from backend');
            }
        } catch (error) {
            console.error('Error clearing test weather data:', error);
        }
        
        // Fetch real weather data
        this.fetchWeatherData();
        
        // Signal main app to refresh
        this.signalMainAppRefresh();
        
        console.log('Reset to real weather data');
    }

    async sendTestWeatherToBackend(testData) {
        try {
            const response = await fetch('/api/weather/test-weather', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testData)
            });
            
            if (response.ok) {
                console.log('Test weather data sent to backend successfully');
            } else {
                console.error('Failed to send test weather data to backend');
            }
        } catch (error) {
            console.error('Error sending test weather data:', error);
        }
    }

    signalMainAppRefresh() {
        // Use localStorage to signal the main app to refresh
        try {
            localStorage.setItem('weatherTestRefresh', Date.now().toString());
            console.log('Signaled main app to refresh wave data via localStorage');
            
            // Also try direct window communication
            this.refreshMainAppWaveData();
            
        } catch (error) {
            console.log('Could not signal main app refresh:', error);
            alert('Test weather applied! Please refresh the main app page to see the changes.');
        }
    }

    testLocalStorage() {
        console.log('Testing localStorage communication...');
        localStorage.setItem('weatherTestRefresh', Date.now().toString());
        console.log('localStorage signal set:', localStorage.getItem('weatherTestRefresh'));
        
        // Also try direct function call
        try {
            if (window.parent && window.parent.forceRefreshWaves) {
                window.parent.forceRefreshWaves();
                console.log('Called forceRefreshWaves on parent window');
            } else if (window.opener && window.opener.forceRefreshWaves) {
                window.opener.forceRefreshWaves();
                console.log('Called forceRefreshWaves on opener window');
            } else {
                console.log('Could not find forceRefreshWaves function');
            }
        } catch (error) {
            console.log('Error calling forceRefreshWaves:', error);
        }
        
        alert('Test signals sent! Check main app console for detection.');
    }

    bindWaveControlSliders() {
        // Animation Speed
        const waveSpeedSlider = document.getElementById('wave-speed');
        if (waveSpeedSlider) {
            waveSpeedSlider.addEventListener('input', (e) => {
                document.getElementById('wave-speed-value').textContent = e.target.value + 'x';
            });
        }
        
        // Travel Distance
        const waveDistanceSlider = document.getElementById('wave-distance');
        if (waveDistanceSlider) {
            waveDistanceSlider.addEventListener('input', (e) => {
                document.getElementById('wave-distance-value').textContent = e.target.value + '%';
            });
        }
        
        // Wave Amplitude
        const waveAmplitudeSlider = document.getElementById('wave-amplitude');
        if (waveAmplitudeSlider) {
            waveAmplitudeSlider.addEventListener('input', (e) => {
                document.getElementById('wave-amplitude-value').textContent = e.target.value + 'x';
            });
        }
        
        // Animation Frequency
        const waveFrequencySlider = document.getElementById('wave-frequency');
        if (waveFrequencySlider) {
            waveFrequencySlider.addEventListener('input', (e) => {
                document.getElementById('wave-frequency-value').textContent = e.target.value + ' min';
            });
        }
        
        // Wave Layers
        const waveLayersSlider = document.getElementById('wave-layers');
        if (waveLayersSlider) {
            waveLayersSlider.addEventListener('input', (e) => {
                document.getElementById('wave-layers-value').textContent = e.target.value;
            });
        }
        
        // Wave Opacity
        const waveOpacitySlider = document.getElementById('wave-opacity');
        if (waveOpacitySlider) {
            waveOpacitySlider.addEventListener('input', (e) => {
                document.getElementById('wave-opacity-value').textContent = e.target.value + '%';
            });
        }
    }

    applyWaveSettings() {
        const waveSettings = {
            speed: parseFloat(document.getElementById('wave-speed').value),
            distance: parseFloat(document.getElementById('wave-distance').value),
            amplitude: parseFloat(document.getElementById('wave-amplitude').value),
            frequency: parseFloat(document.getElementById('wave-frequency').value),
            layers: parseInt(document.getElementById('wave-layers').value),
            opacity: parseFloat(document.getElementById('wave-opacity').value)
        };
        
        console.log('Applying wave settings:', waveSettings);
        
        // Send wave settings to backend
        this.sendWaveSettingsToBackend(waveSettings);
        
        // Signal main app to refresh
        this.signalMainAppRefresh();
        
        alert('Wave settings applied! The main app will update with new wave parameters.');
    }

    resetWaveSettings() {
        // Reset all sliders to default values
        document.getElementById('wave-speed').value = 1.0;
        document.getElementById('wave-distance').value = 100;
        document.getElementById('wave-amplitude').value = 1.0;
        document.getElementById('wave-frequency').value = 2;
        document.getElementById('wave-layers').value = 3;
        document.getElementById('wave-opacity').value = 70;
        
        // Update display values
        document.getElementById('wave-speed-value').textContent = '1.0x';
        document.getElementById('wave-distance-value').textContent = '100%';
        document.getElementById('wave-amplitude-value').textContent = '1.0x';
        document.getElementById('wave-frequency-value').textContent = '2 min';
        document.getElementById('wave-layers-value').textContent = '3';
        document.getElementById('wave-opacity-value').textContent = '70%';
        
        // Apply default settings
        this.applyWaveSettings();
        
        console.log('Wave settings reset to defaults');
    }

    async sendWaveSettingsToBackend(settings) {
        try {
            const response = await fetch('/api/weather/wave-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            
            if (response.ok) {
                console.log('Wave settings sent to backend successfully');
            } else {
                console.error('Failed to send wave settings to backend');
            }
        } catch (error) {
            console.error('Error sending wave settings:', error);
        }
    }

    refreshMainAppWaveData() {
        // Try to refresh wave data in the main app if it's open
        try {
            // First try parent window (if admin is in iframe)
            if (window.parent && window.parent !== window && window.parent.refreshWaveData) {
                window.parent.refreshWaveData();
                console.log('Refreshed wave data in parent window');
                return;
            }
            
            // Try opener window (if admin was opened from main app)
            if (window.opener && window.opener.refreshWaveData) {
                window.opener.refreshWaveData();
                console.log('Refreshed wave data in opener window');
                return;
            }
            
            // If we can't find the main app, show instructions
            console.log('Could not find main app window to refresh');
            console.log('Main app will check localStorage for refresh signal');
            
        } catch (error) {
            console.log('Could not refresh main app wave data:', error);
            console.log('Main app will check localStorage for refresh signal');
        }
    }

    // ===== CONDITION ALARM MANAGEMENT =====
    
    initAlarmManagement() {
        this.alarms = [];
        this.alarmMarkers = [];
        this.mapClickMode = false;
        
        this.loadAlarms();
        this.bindAlarmEvents();
    }
    
    bindAlarmEvents() {
        // Add alarm button
        document.getElementById('add-alarm-btn').addEventListener('click', () => {
            this.addAlarm();
        });
        
        // Clear form button
        document.getElementById('clear-alarm-form').addEventListener('click', () => {
            this.clearAlarmForm();
        });
        
        // Use map coordinates button
        document.getElementById('use-map-coords').addEventListener('click', () => {
            this.toggleMapClickMode();
        });
        
        // Icon size slider
        document.getElementById('alarm-icon-size').addEventListener('input', (e) => {
            document.getElementById('icon-size-value').textContent = e.target.value + 'px';
        });
        
        // Map click event for setting coordinates
        this.map.on('click', (e) => {
            if (this.mapClickMode) {
                this.setAlarmCoordinates(e.latlng.lat, e.latlng.lng);
                this.mapClickMode = false;
                document.getElementById('use-map-coords').textContent = 'Use Map Click';
                document.getElementById('use-map-coords').classList.remove('btn-danger');
                document.getElementById('use-map-coords').classList.add('btn-info');
            }
        });
        
        // Right-click context menu for quick alarm creation
        this.map.on('contextmenu', (e) => {
            e.originalEvent.preventDefault();
            this.showAlarmContextMenu(e.latlng.lat, e.latlng.lng, e.containerPoint);
        });
    }
    
    async loadAlarms() {
        try {
            const response = await fetch('/api/weather/condition-alarms');
            const data = await response.json();
            
            if (data.success) {
                this.alarms = data.alarms;
                this.updateAlarmsList();
                this.updateAlarmMarkers();
            }
        } catch (error) {
            console.error('Error loading alarms:', error);
        }
    }
    
    async addAlarm() {
        const type = document.getElementById('alarm-type').value;
        const title = document.getElementById('alarm-title').value;
        const description = document.getElementById('alarm-description').value;
        const severity = document.getElementById('alarm-severity').value;
        const lat = parseFloat(document.getElementById('alarm-lat').value);
        const lng = parseFloat(document.getElementById('alarm-lng').value);
        const isActive = document.getElementById('alarm-active').checked;
        const icon = document.getElementById('alarm-icon').value;
        const iconSize = parseInt(document.getElementById('alarm-icon-size').value);
        
        if (!title || isNaN(lat) || isNaN(lng)) {
            alert('Please fill in all required fields (title, latitude, longitude)');
            return;
        }
        
        const alarmData = {
            type,
            title,
            description,
            severity,
            coordinates: { lat, lng },
            isActive,
            icon,
            iconSize
        };
        
        try {
            const response = await fetch('/api/weather/condition-alarms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(alarmData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.alarms.push(result.alarm);
                this.updateAlarmsList();
                this.updateAlarmMarkers();
                this.clearAlarmForm();
                console.log('Alarm added successfully');
            } else {
                alert('Error adding alarm: ' + result.error);
            }
        } catch (error) {
            console.error('Error adding alarm:', error);
            alert('Error adding alarm');
        }
    }
    
    async deleteAlarm(alarmId) {
        if (!confirm('Are you sure you want to delete this alarm?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/weather/condition-alarms/${alarmId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.alarms = this.alarms.filter(a => a.id !== alarmId);
                this.updateAlarmsList();
                this.updateAlarmMarkers();
                console.log('Alarm deleted successfully');
            } else {
                alert('Error deleting alarm: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting alarm:', error);
            alert('Error deleting alarm');
        }
    }
    
    async toggleAlarmStatus(alarmId) {
        const alarm = this.alarms.find(a => a.id === alarmId);
        if (!alarm) return;
        
        alarm.isActive = !alarm.isActive;
        
        try {
            const response = await fetch('/api/weather/condition-alarms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(alarm)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.updateAlarmsList();
                this.updateAlarmMarkers();
                console.log('Alarm status updated');
            } else {
                alert('Error updating alarm: ' + result.error);
            }
        } catch (error) {
            console.error('Error updating alarm:', error);
            alert('Error updating alarm');
        }
    }
    
    updateAlarmsList() {
        const alarmsList = document.getElementById('alarms-list');
        alarmsList.innerHTML = '';
        
        if (this.alarms.length === 0) {
            alarmsList.innerHTML = '<div class="weather-description">No alarms configured</div>';
            return;
        }
        
        this.alarms.forEach(alarm => {
            const alarmItem = document.createElement('div');
            alarmItem.className = 'alarm-item';
            alarmItem.innerHTML = `
                <div class="alarm-header">
                    <div style="display: flex; align-items: center;">
                        <span class="alarm-type">${alarm.icon}</span>
                        <span class="alarm-title">${alarm.title}</span>
                    </div>
                    <span class="alarm-severity severity-${alarm.severity}">${alarm.severity}</span>
                </div>
                <div class="alarm-description">${alarm.description || 'No description'}</div>
                <div class="alarm-coords">${alarm.coordinates.lat.toFixed(6)}, ${alarm.coordinates.lng.toFixed(6)}</div>
                <div class="alarm-status">
                    <span class="status-indicator ${alarm.isActive ? '' : 'inactive'}"></span>
                    <span>${alarm.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="alarm-actions">
                    <button class="btn btn-warning" onclick="weatherAdmin.toggleAlarmStatus('${alarm.id}')">
                        <i class="fas fa-${alarm.isActive ? 'pause' : 'play'}"></i>
                        ${alarm.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="btn btn-danger" onclick="weatherAdmin.deleteAlarm('${alarm.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            alarmsList.appendChild(alarmItem);
        });
    }
    
    updateAlarmMarkers() {
        // Clear existing markers
        this.alarmMarkers.forEach(marker => this.map.removeLayer(marker));
        this.alarmMarkers = [];
        
        // Add markers for active alarms
        this.alarms.filter(alarm => alarm.isActive).forEach(alarm => {
            const marker = L.marker([alarm.coordinates.lat, alarm.coordinates.lng], {
                icon: L.divIcon({
                    className: 'alarm-marker',
                    html: `<div style="
                        background: ${alarm.color};
                        color: white;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                        border: 3px solid white;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        animation: pulse 2s infinite;
                    ">${alarm.icon}</div>`,
                    iconSize: [46, 46],
                    iconAnchor: [23, 23]
                })
            }).addTo(this.map);
            
            marker.bindPopup(`
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 8px 0; color: ${alarm.color};">${alarm.icon} ${alarm.title}</h4>
                    <p style="margin: 0 0 8px 0; color: #666;">${alarm.description || 'No description'}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="background: ${alarm.color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${alarm.severity}</span>
                        <small style="color: #999;">${alarm.coordinates.lat.toFixed(4)}, ${alarm.coordinates.lng.toFixed(4)}</small>
                    </div>
                </div>
            `);
            
            this.alarmMarkers.push(marker);
        });
    }
    
    clearAlarmForm() {
        document.getElementById('alarm-title').value = '';
        document.getElementById('alarm-description').value = '';
        document.getElementById('alarm-lat').value = '';
        document.getElementById('alarm-lng').value = '';
        document.getElementById('alarm-type').value = 'jellyfish';
        document.getElementById('alarm-severity').value = 'medium';
        document.getElementById('alarm-active').checked = true;
        document.getElementById('alarm-icon').value = '🪼';
        document.getElementById('alarm-icon-size').value = '50';
        document.getElementById('icon-size-value').textContent = '50px';
    }
    
    toggleMapClickMode() {
        this.mapClickMode = !this.mapClickMode;
        const button = document.getElementById('use-map-coords');
        
        if (this.mapClickMode) {
            button.textContent = 'Click on Map to Set Location';
            button.classList.remove('btn-info');
            button.classList.add('btn-danger');
        } else {
            button.textContent = 'Use Map Click';
            button.classList.remove('btn-danger');
            button.classList.add('btn-info');
        }
    }
    
    setAlarmCoordinates(lat, lng) {
        document.getElementById('alarm-lat').value = lat.toFixed(6);
        document.getElementById('alarm-lng').value = lng.toFixed(6);
    }
    
    showAlarmContextMenu(lat, lng, containerPoint) {
        // Remove existing context menu
        const existingMenu = document.getElementById('alarm-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.id = 'alarm-context-menu';
        contextMenu.style.cssText = `
            position: absolute;
            left: ${containerPoint.x}px;
            top: ${containerPoint.y}px;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 8px;
            z-index: 10000;
            min-width: 200px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        `;
        
        contextMenu.innerHTML = `
            <div style="color: white; font-weight: 600; margin-bottom: 8px; font-size: 14px;">
                Add Alarm at Location
            </div>
            <div style="color: rgba(255, 255, 255, 0.7); font-size: 11px; margin-bottom: 12px; font-family: monospace;">
                ${lat.toFixed(6)}, ${lng.toFixed(6)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <button class="context-menu-btn" data-action="new-alarm" style="
                    background: rgba(99, 102, 241, 0.2);
                    border: 1px solid rgba(99, 102, 241, 0.4);
                    color: #6366f1;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                ">
                    ➕ New Alarm (Copy Coords)
                </button>
                <div style="height: 1px; background: rgba(255, 255, 255, 0.2); margin: 4px 0;"></div>
                <button class="context-menu-btn" data-type="jellyfish" style="
                    background: rgba(16, 185, 129, 0.2);
                    border: 1px solid rgba(16, 185, 129, 0.4);
                    color: #10b981;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    🪼 Jellyfish Alert
                </button>
                <button class="context-menu-btn" data-type="tsunami" style="
                    background: rgba(239, 68, 68, 0.2);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    color: #ef4444;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    🌊 Tsunami Warning
                </button>
                <button class="context-menu-btn" data-type="shark" style="
                    background: rgba(245, 158, 11, 0.2);
                    border: 1px solid rgba(245, 158, 11, 0.4);
                    color: #f59e0b;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    🦈 Shark Alert
                </button>
                <button class="context-menu-btn" data-type="storm" style="
                    background: rgba(139, 69, 19, 0.2);
                    border: 1px solid rgba(139, 69, 19, 0.4);
                    color: #8b4513;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    ⛈️ Storm Warning
                </button>
                <button class="context-menu-btn" data-type="current" style="
                    background: rgba(59, 130, 246, 0.2);
                    border: 1px solid rgba(59, 130, 246, 0.4);
                    color: #3b82f6;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    🌊 Strong Current
                </button>
                <button class="context-menu-btn" data-type="other" style="
                    background: rgba(107, 114, 128, 0.2);
                    border: 1px solid rgba(107, 114, 128, 0.4);
                    color: #6b7280;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    ⚠️ Other Alert
                </button>
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <button id="close-context-menu" style="
                    background: rgba(239, 68, 68, 0.2);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    color: #ef4444;
                    padding: 6px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 11px;
                    width: 100%;
                ">
                    Cancel
                </button>
            </div>
        `;
        
        // Add hover effects
        const style = document.createElement('style');
        style.textContent = `
            .context-menu-btn:hover {
                background: rgba(255, 255, 255, 0.1) !important;
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(style);
        
        // Add to map container
        document.getElementById('map').appendChild(contextMenu);
        
        // Bind events
        contextMenu.querySelectorAll('.context-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target;
                const alarmType = target.dataset.type;
                const action = target.dataset.action;
                
                if (action === 'new-alarm') {
                    // Copy coordinates to form fields
                    document.getElementById('alarm-lat').value = lat.toFixed(6);
                    document.getElementById('alarm-lng').value = lng.toFixed(6);
                    alert(`Coordinates copied to form!\n${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                } else if (alarmType) {
                    this.quickAddAlarm(lat, lng, alarmType);
                }
                contextMenu.remove();
            });
        });
        
        document.getElementById('close-context-menu').addEventListener('click', () => {
            contextMenu.remove();
        });
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            });
        }, 100);
    }
    
    async quickAddAlarm(lat, lng, type) {
        const alarmData = {
            type,
            title: this.getDefaultTitle(type),
            description: this.getDefaultDescription(type),
            severity: 'medium',
            coordinates: { lat, lng },
            isActive: true
        };
        
        try {
            const response = await fetch('/api/weather/condition-alarms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(alarmData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.alarms.push(result.alarm);
                this.updateAlarmsList();
                this.updateAlarmMarkers();
                console.log('Quick alarm added successfully');
            } else {
                alert('Error adding alarm: ' + result.error);
            }
        } catch (error) {
            console.error('Error adding quick alarm:', error);
            alert('Error adding alarm');
        }
    }
    
    getDefaultTitle(type) {
        const titles = {
            'jellyfish': 'Jellyfish Spotted',
            'tsunami': 'Tsunami Warning',
            'shark': 'Shark Alert',
            'storm': 'Storm Warning',
            'current': 'Strong Current',
            'other': 'Safety Alert'
        };
        return titles[type] || 'Safety Alert';
    }
    
    getDefaultDescription(type) {
        const descriptions = {
            'jellyfish': 'Jellyfish have been spotted in this area. Please exercise caution when swimming.',
            'tsunami': 'Tsunami warning issued for this coastal area. Please move to higher ground.',
            'shark': 'Shark activity reported in this area. Swimming not recommended.',
            'storm': 'Severe weather conditions expected. Avoid water activities.',
            'current': 'Strong underwater currents detected. Swim with caution.',
            'other': 'Safety alert for this location. Please be aware of local conditions.'
        };
        return descriptions[type] || 'Safety alert for this location.';
    }
}

// Initialize weather admin when page loads
let weatherAdmin;
document.addEventListener('DOMContentLoaded', () => {
    weatherAdmin = new WeatherAdmin();
});

// Modal functions
function closeApiConfigModal() {
    document.getElementById('api-config-modal').classList.remove('show');
}

function saveApiConfiguration() {
    const owmKey = document.getElementById('modal-owm-key').value;
    const stormglassKey = document.getElementById('modal-stormglass-key').value;
    const interval = document.getElementById('update-interval').value;
    
    weatherAdmin.apiKeys.openweathermap = owmKey;
    weatherAdmin.apiKeys.stormglass = stormglassKey;
    weatherAdmin.updateInterval = parseInt(interval);
    
    weatherAdmin.saveApiKeys();
    closeApiConfigModal();
}
