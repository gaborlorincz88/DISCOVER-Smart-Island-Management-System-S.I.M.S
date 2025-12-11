const WebSocket = require('ws');
const https = require('https');
const db = require('../database');
const MarinesiaProvider = require('./aisProviders/marinesia');
const MyShipTrackingProvider = require('./aisProviders/myshiptracking');

class AISService {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 5000; // 5 seconds
    this.reconnectTimer = null;
    this.isConnected = false;
    this.isConnecting = false; // Flag to prevent duplicate connection attempts
    this.isInitialized = false; // Flag to prevent duplicate initialization
    this.reconnectAttempts = 0; // Track reconnect attempts for exponential backoff
    this.subscriptions = new Map(); // Map of place/event ID to subscription config
    this.positions = new Map(); // Map of MMSI to position data
    this.positionListeners = new Set(); // Set of callback functions for position updates
    this.currentSubscription = null; // Current active subscription message
    this.subscriptionSent = false; // Flag to prevent duplicate subscription sends
    this.lastSubscriptionTime = 0; // Track when subscription was last sent
    this.marinesiaProvider = new MarinesiaProvider(); // Marinesia provider instance
    this.myShipTrackingProviders = new Map(); // Map of API key to MyShipTracking provider instance
    this.providerSubscriptions = new Map(); // Track which provider each subscription uses
  }

  /**
   * Initialize the AIS service and load all dynamic places/events
   */
  async initialize() {
    // Prevent duplicate initialization
    if (this.isInitialized) {
      console.log('⚠️ AIS Service already initialized, skipping duplicate initialization');
      return;
    }
    
    console.log('🚢 Initializing AIS Service...');
    this.isInitialized = true;
    
    // Load all places with dynamic location enabled
    try {
      const places = db.prepare(`
        SELECT id, name, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location, latitude, longitude
        FROM places 
        WHERE is_dynamic_location = 1 AND ais_provider IS NOT NULL AND ais_api_key IS NOT NULL AND ais_mmsi IS NOT NULL
      `).all();
      
      places.forEach(place => {
        console.log(`📋 Found dynamic place: ${place.name} (ID: ${place.id}, MMSI: ${place.ais_mmsi}, Provider: ${place.ais_provider || 'AisStream'})`);
        const success = this.subscribe(place.id, 'place', place);
        if (!success) {
          console.error(`❌ Failed to subscribe to place ${place.name} (ID: ${place.id})`);
        }
      });
      
      console.log(`✅ Loaded ${places.length} dynamic places, ${this.subscriptions.size} subscriptions created`);
    } catch (error) {
      console.error('Error loading dynamic places:', error);
    }

    // Load all events with dynamic location enabled
    try {
      const events = db.prepare(`
        SELECT id, name, ais_provider, ais_api_key, ais_mmsi, is_dynamic_location, latitude, longitude
        FROM events 
        WHERE is_dynamic_location = 1 AND ais_provider IS NOT NULL AND ais_api_key IS NOT NULL AND ais_mmsi IS NOT NULL
      `).all();
      
      events.forEach(event => {
        this.subscribe(event.id, 'event', event);
      });
      
      console.log(`✅ Loaded ${events.length} dynamic events`);
    } catch (error) {
      console.error('Error loading dynamic events:', error);
    }

    // Start tracking for each subscription based on provider
    const aisStreamSubscriptions = [];
    const marinesiaSubscriptions = [];
    const myShipTrackingSubscriptions = [];
    
    this.subscriptions.forEach((sub, id) => {
      const provider = (sub.provider || 'AisStream').toLowerCase();
      if (provider === 'marinesia' || provider === 'marinesiaapi') {
        marinesiaSubscriptions.push(sub);
      } else if (provider === 'myshiptracking' || provider === 'myshiptrackingapi') {
        myShipTrackingSubscriptions.push(sub);
      } else {
        aisStreamSubscriptions.push(sub);
      }
    });
    
    // Start Marinesia tracking (REST API, no connection needed)
    if (marinesiaSubscriptions.length > 0) {
      console.log(`🌊 Starting Marinesia tracking for ${marinesiaSubscriptions.length} vessel(s)...`);
      marinesiaSubscriptions.forEach(sub => {
        sub.mmsiList.forEach(mmsi => {
          this.marinesiaProvider.startTracking(mmsi, null, (position) => {
            this.handlePositionUpdate(position);
          });
        });
      });
    }
    
    // Start MyShipTracking tracking
    if (myShipTrackingSubscriptions.length > 0) {
      console.log(`🚢 Starting MyShipTracking tracking for ${myShipTrackingSubscriptions.length} vessel(s)...`);
      myShipTrackingSubscriptions.forEach(sub => {
        // Get or create provider instance for this API key
        const providerKey = sub.apiKey || 'default';
        if (!this.myShipTrackingProviders.has(providerKey)) {
          // MyShipTracking requires both API key and secret
          // For now, we'll use the API key as both (user should provide both in apiKey field, comma-separated)
          const [apiKey, apiSecret] = sub.apiKey ? sub.apiKey.split(',') : [null, null];
          this.myShipTrackingProviders.set(providerKey, new MyShipTrackingProvider(apiKey, apiSecret));
        }
        const provider = this.myShipTrackingProviders.get(providerKey);
        
        sub.mmsiList.forEach(mmsi => {
          provider.startTracking(mmsi, sub.apiKey, (position) => {
            this.handlePositionUpdate(position);
          });
        });
      });
    }
    
    // Connect to AisStream if we have AisStream subscriptions
    if (aisStreamSubscriptions.length > 0 && !this.isConnecting && !this.isConnected) {
      console.log(`📡 Connecting to AisStream.io for ${aisStreamSubscriptions.length} subscription(s)...`);
      this.connect();
    } else if (this.subscriptions.size === 0) {
      console.log('ℹ️ No dynamic places/events found, AIS service not started');
    } else if (aisStreamSubscriptions.length === 0) {
      console.log('ℹ️ All subscriptions use REST API providers (no WebSocket connection needed)');
    } else {
      console.log('ℹ️ AIS service already connecting/connected, skipping connect()');
    }
  }

  /**
   * Connect to AisStream.io WebSocket
   */
  connect() {
    // Prevent duplicate connection attempts
    if (this.isConnecting) {
      console.log('⚠️ AIS WebSocket connection already in progress, skipping duplicate attempt');
      return;
    }
    
    if (this.ws && this.isConnected) {
      console.log('AIS WebSocket already connected');
      return;
    }

    this.isConnecting = true;
    console.log(`🔍 Checking subscriptions before connect: ${this.subscriptions.size} subscriptions`);
    this.subscriptions.forEach((sub, id) => {
      console.log(`  Subscription ${id}: name=${sub.name}, apiKey=${sub.apiKey ? 'SET' : 'MISSING'}, mmsi=${sub.mmsi}`);
    });

    // Find the first subscription to get API key (assuming all use same provider for now)
    const firstSub = Array.from(this.subscriptions.values())[0];
    if (!firstSub || !firstSub.apiKey) {
      console.error('❌ No valid subscription found with API key');
      console.error(`   Subscriptions count: ${this.subscriptions.size}`);
      if (this.subscriptions.size > 0) {
        const sub = Array.from(this.subscriptions.values())[0];
        console.error(`   First subscription:`, {
          hasApiKey: !!sub.apiKey,
          hasMmsi: !!sub.mmsi,
          hasProvider: !!sub.provider
        });
      }
      return;
    }

    const apiKey = firstSub.apiKey;
    const wsUrl = 'wss://stream.aisstream.io/v0/stream';

    console.log(`🚢 Connecting to AIS stream: ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('✅ AIS WebSocket connected to AisStream.io');
        this.isConnected = true;
        this.isConnecting = false;
        this.subscriptionSent = false; // Reset flag on new connection
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        console.log(`📊 Current subscriptions: ${this.subscriptions.size}`);
        this.subscriptions.forEach((sub, id) => {
          console.log(`  - ${id}: ${sub.name} (MMSI: ${sub.mmsi})`);
        });
        // AisStream.io requires subscription within 3 seconds of connection
        // Send immediately to ensure it's received in time
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN && !this.subscriptionSent) {
          console.log('📡 Sending subscription immediately...');
          this.sendSubscription();
        } else {
          if (this.subscriptionSent) {
            console.warn('⚠️ Subscription already sent, skipping duplicate');
          } else {
            console.warn('⚠️ WebSocket not ready when trying to send subscription');
            // Try again after a short delay
            setTimeout(() => {
              if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN && !this.subscriptionSent) {
                console.log('📡 Retrying subscription send...');
                this.sendSubscription();
              }
            }, 500);
          }
        }
      });

      this.ws.on('message', (data) => {
        try {
          const rawData = data.toString();
          const message = JSON.parse(rawData);
          
          // Log ALL messages when we haven't received positions yet (for debugging)
          const msgType = message.MessageType || message.messageType || message.type || 'unknown';
          
          // Check for error messages first - log these prominently
          if (message.error || message.Error || message.message) {
            const errorMsg = message.error || message.Error || message.message;
            console.error('❌ AIS Stream error response:', errorMsg);
            console.error('📋 Full error message:', JSON.stringify(message, null, 2));
            
            // If it's an API key error, log it clearly
            if (errorMsg.toLowerCase().includes('api') || errorMsg.toLowerCase().includes('key') || errorMsg.toLowerCase().includes('auth')) {
              console.error('🔑 API KEY ISSUE DETECTED - Check your AisStream.io API key in the database');
            }
            return;
          }
          
          if (this.positions.size === 0) {
            // Log full message until we get positions
            console.log(`📨 AIS message received (type: ${msgType}):`, JSON.stringify(message, null, 2));
          } else if (msgType !== 'PositionReport') {
            // After we have positions, log non-PositionReport messages
            console.log(`📨 AIS message type: ${msgType}`);
          }
          
          // Handle the message
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing AIS message:', error);
          console.error('Raw data (first 500 chars):', data.toString().substring(0, 500));
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ AIS WebSocket error:', error);
        console.error('Error details:', error.message, error.code);
        this.isConnected = false;
        this.isConnecting = false;
      });

      this.ws.on('close', (code, reason) => {
        console.log(`❌ AIS WebSocket closed - Code: ${code}, Reason: ${reason || 'none'}`);
        console.log('Close code meanings: 1000=normal, 1001=going away, 1006=abnormal, 1008=policy violation');
        console.log(`📊 Had ${this.positions.size} positions when connection closed`);
        if (this.positions.size === 0) {
          console.warn('⚠️ No positions received before disconnect - check subscription and API key');
        }
        this.isConnected = false;
        this.isConnecting = false;
        this.subscriptionSent = false; // Reset on close
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('Error creating AIS WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Send subscription message to AIS stream
   */
  sendSubscription() {
    if (!this.ws || !this.isConnected) {
      console.warn('⚠️ Cannot send subscription - WebSocket not connected');
      return;
    }

    // Prevent duplicate subscription sends (rate limiting protection)
    const now = Date.now();
    if (this.subscriptionSent && (now - this.lastSubscriptionTime) < 60000) {
      console.warn('⚠️ Subscription already sent recently, skipping to avoid rate limiting');
      return;
    }

    // Collect all MMSI numbers from all subscriptions
    const allMmsi = [];
    const boundingBoxes = [
      [
        [35.80, 14.15], // Southwest corner (Malta-Gozo channel)
        [36.10, 14.45]  // Northeast corner
      ]
    ];

    this.subscriptions.forEach((sub) => {
      if (sub.mmsi) {
        const mmsiList = sub.mmsi.split(',').map(m => m.trim()).filter(m => m);
        allMmsi.push(...mmsiList);
      }
    });

    // Remove duplicates
    const uniqueMmsi = [...new Set(allMmsi)];

    if (uniqueMmsi.length === 0) {
      console.warn('No MMSI numbers found in subscriptions');
      return;
    }

    // Get API key from first subscription
    const firstSub = Array.from(this.subscriptions.values())[0];
    const apiKey = firstSub.apiKey;

    // AisStream.io expects "APIKey" (all caps) - must be sent within 3 seconds
    // Send immediately on connection open
    const subscriptionMessage = {
      APIKey: apiKey,  // Official format per documentation
      BoundingBoxes: boundingBoxes,
      FiltersShipMMSI: uniqueMmsi,
      FilterMessageTypes: ['PositionReport']
    };

    console.log(`📡 Subscribing to ${uniqueMmsi.length} vessels:`, uniqueMmsi);
    console.log('📋 Subscription message:', JSON.stringify(subscriptionMessage, null, 2));
    this.currentSubscription = subscriptionMessage;

    try {
      const messageStr = JSON.stringify(subscriptionMessage);
      this.ws.send(messageStr);
      this.subscriptionSent = true;
      this.lastSubscriptionTime = now;
      console.log('✅ Subscription message sent (length:', messageStr.length, 'bytes)');
      console.log('📋 Waiting for AisStream.io to send position data...');
      // Set a timeout to warn if no data received after 15 seconds (increased from 10)
      setTimeout(() => {
        if (this.positions.size === 0 && this.isConnected) {
          console.warn('⚠️ No position data received 15 seconds after subscription. Possible issues:');
          console.warn('  1. MMSI numbers may not be active/broadcasting');
          console.warn('  2. API key may be invalid or expired');
          console.warn('  3. Vessels may be outside the bounding box');
          console.warn('  4. AisStream.io may not have data for these MMSIs');
        }
      }, 15000);
    } catch (error) {
      console.error('Error sending subscription:', error);
      this.subscriptionSent = false; // Reset on error so we can retry
    }
  }

  /**
   * Handle incoming AIS messages
   */
  handleMessage(message) {
    if (!message) {
      console.warn('⚠️ Received empty or null message');
      return;
    }

    // Log message structure for debugging (only first time or on error)
    const messageKeys = Object.keys(message);
    if (this.positions.size === 0 || messageKeys.length < 3) {
      console.log('🔍 Message keys:', messageKeys.join(', '));
    }

    // Check for different message formats - AisStream.io uses nested structure
    const messageType = message.MessageType || message.messageType || message.type || message.Message_Type;
    
    if (!messageType) {
      console.warn('⚠️ Message has no MessageType field. Full message:', JSON.stringify(message, null, 2).substring(0, 1000));
      return;
    }

    if (this.positions.size === 0) {
      console.log('📋 Message type:', messageType);
    }

    // Check for subscription confirmation/response messages
    if (messageType === 'SubscriptionResponse' || messageType === 'subscription_response' || messageType === 'Subscription_Response') {
      console.log('✅ Subscription confirmed by AisStream.io');
      if (message.Message && message.Message.SubscriptionResponse) {
        const response = message.Message.SubscriptionResponse;
        if (response.error || response.Error) {
          console.error('❌ Subscription error:', response.error || response.Error);
        } else {
          console.log('📋 Subscription response:', JSON.stringify(response, null, 2));
        }
      }
      return;
    }
    
    // Only process PositionReport messages
    if (messageType === 'PositionReport' || messageType === 'position_report' || messageType === 'Position_Report') {
      // AisStream.io uses nested structure: message.Message.PositionReport
      let positionData = null;
      
      // Try nested format first (AisStream.io standard format)
      if (message.Message && message.Message.PositionReport) {
        positionData = message.Message.PositionReport;
      } else if (message.Message && message.Message.positionReport) {
        positionData = message.Message.positionReport;
      } else if (message.PositionReport) {
        // Flat format fallback
        positionData = message.PositionReport;
      } else {
        // Try direct fields (legacy format)
        positionData = message;
      }

      if (!positionData) {
        console.warn('⚠️ Could not find PositionReport data in message');
        return;
      }

      // Extract fields from positionData - AisStream.io uses UserID for MMSI
      const mmsi = positionData.UserID || positionData.userID || positionData.MMSI || positionData.mmsi || positionData.Mmsi;
      const lat = positionData.Latitude || positionData.latitude || positionData.Lat;
      const lng = positionData.Longitude || positionData.longitude || positionData.Lon || positionData.Lng;
      // AisStream.io uses Cog (Course over Ground) and Sog (Speed over Ground)
      const course = positionData.Cog || positionData.cog || positionData.CourseOverGround || positionData.courseOverGround || positionData.Course || positionData.course || null;
      const speed = positionData.Sog || positionData.sog || positionData.SpeedOverGround || positionData.speedOverGround || positionData.Speed || positionData.speed || null;
      const timestamp = positionData.Timestamp || positionData.timestamp || message.MetaData?.Timestamp || message.MetaData?.timestamp || new Date().toISOString();

      if (mmsi && lat !== undefined && lng !== undefined) {
        const position = {
          mmsi: String(mmsi),
          latitude: lat,
          longitude: lng,
          course: course,
          speed: speed,
          timestamp: timestamp
        };

        // Use unified position update handler
        this.handlePositionUpdate(position);
        
        if (this.positions.size <= 5) {
          console.log(`💾 Stored position for MMSI ${mmsi} - Total positions in memory: ${this.positions.size}`);
        }

        if (this.positions.size <= 5) {
          console.log(`📍 Position update for MMSI ${mmsi}: ${lat.toFixed(4)}, ${lng.toFixed(4)} (Speed: ${speed || 'N/A'} knots, Course: ${course || 'N/A'}°)`);
        }
      } else {
        console.warn('⚠️ PositionReport missing required fields - MMSI:', mmsi, 'Lat:', lat, 'Lng:', lng);
        if (this.positions.size === 0) {
          console.log('📋 Full positionData:', JSON.stringify(positionData, null, 2).substring(0, 500));
        }
      }
    } else {
      if (this.positions.size === 0) {
        console.log('ℹ️ Ignoring message type:', messageType);
      }
    }
  }

  /**
   * Subscribe to track a place or event
   */
  subscribe(id, type, config) {
    // Marinesia doesn't require API key, so only check if provider is set
    const provider = (config.ais_provider || 'AisStream').toLowerCase();
    const requiresApiKey = provider !== 'marinesia' && provider !== 'marinesiaapi';
    
    if (!config.ais_provider || !config.ais_mmsi) {
      console.warn(`Cannot subscribe ${type} ${id}: missing AIS provider or MMSI`);
      return false;
    }
    
    if (requiresApiKey && !config.ais_api_key) {
      console.warn(`Cannot subscribe ${type} ${id}: ${config.ais_provider} requires API key`);
      return false;
    }

    // Parse MMSI numbers (comma-separated)
    const mmsiList = config.ais_mmsi.split(',').map(m => m.trim()).filter(m => m);
    if (mmsiList.length === 0) {
      console.warn(`Cannot subscribe ${type} ${id}: no valid MMSI numbers`);
      return false;
    }

    const subscription = {
      id: id,
      type: type,
      name: config.name,
      provider: config.ais_provider,
      apiKey: config.ais_api_key,
      mmsi: config.ais_mmsi,
      mmsiList: mmsiList,
      initialLat: config.latitude,
      initialLng: config.longitude
    };

    this.subscriptions.set(id, subscription);
    const providerName = config.ais_provider || 'AisStream';
    console.log(`✅ Subscribed to track ${type} ${id} (${config.name}) - MMSI: ${mmsiList.join(', ')}, Provider: ${providerName}`);

    // Store provider for this subscription
    this.providerSubscriptions.set(id, providerName);

    // If Marinesia provider, start tracking immediately
    if (providerName.toLowerCase() === 'marinesia' || providerName.toLowerCase() === 'marinesiaapi') {
      mmsiList.forEach(mmsi => {
        this.marinesiaProvider.startTracking(mmsi, null, (position) => {
          this.handlePositionUpdate(position);
        });
      });
      return true;
    }
    
    // If MyShipTracking provider, start tracking immediately
    if (providerName.toLowerCase() === 'myshiptracking' || providerName.toLowerCase() === 'myshiptrackingapi') {
      const providerKey = config.ais_api_key || 'default';
      if (!this.myShipTrackingProviders.has(providerKey)) {
        const [apiKey, apiSecret] = config.ais_api_key ? config.ais_api_key.split(',') : [null, null];
        this.myShipTrackingProviders.set(providerKey, new MyShipTrackingProvider(apiKey, apiSecret));
      }
      const provider = this.myShipTrackingProviders.get(providerKey);
      
      mmsiList.forEach(mmsi => {
        provider.startTracking(mmsi, config.ais_api_key, (position) => {
          this.handlePositionUpdate(position);
        });
      });
      return true;
    }

    // For AisStream, handle connection/subscription
    if (this.isConnected) {
      // Only update subscription if we haven't sent one recently (avoid rate limiting)
      const now = Date.now();
      if (!this.subscriptionSent || (now - this.lastSubscriptionTime) > 60000) {
        this.sendSubscription();
      } else {
        console.log('⚠️ Skipping subscription update - sent recently, will update on next connection');
      }
    } else if (this.subscriptions.size === 1 && !this.isConnecting) {
      // First subscription and not already connecting, connect now
      this.connect();
    }

    return true;
  }

  /**
   * Handle position update from any provider
   */
  handlePositionUpdate(position) {
    // Store position
    this.positions.set(position.mmsi, position);
    
    // Notify all listeners
    this.positionListeners.forEach(listener => {
      try {
        listener(position);
      } catch (error) {
        console.error('Error in position listener:', error);
      }
    });
  }

  /**
   * Unsubscribe from tracking a place or event
   */
  unsubscribe(id) {
    if (this.subscriptions.delete(id)) {
      console.log(`✅ Unsubscribed from tracking ${id}`);
      
      // If no more subscriptions, disconnect
      if (this.subscriptions.size === 0) {
        this.disconnect();
      } else if (this.isConnected) {
        // Update subscription
        this.sendSubscription();
      }
      return true;
    }
    return false;
  }

  /**
   * Get current position for a specific MMSI
   */
  getPosition(mmsi) {
    return this.positions.get(String(mmsi)) || null;
  }

  /**
   * Get all current positions
   */
  /**
   * Get all positions (from both AisStream and Marinesia)
   */
  getAllPositions() {
    const result = {};
    
    // Get positions from AisStream (WebSocket)
    this.positions.forEach((position, mmsi) => {
      result[mmsi] = position;
    });
    
    // Merge positions from Marinesia
    const marinesiaPositions = this.marinesiaProvider.getAllPositions();
    Object.keys(marinesiaPositions).forEach(mmsi => {
      result[mmsi] = marinesiaPositions[mmsi];
      this.positions.set(mmsi, marinesiaPositions[mmsi]);
    });
    
    // Merge positions from MyShipTracking
    this.myShipTrackingProviders.forEach((provider) => {
      const positions = provider.getAllPositions();
      Object.keys(positions).forEach(mmsi => {
        result[mmsi] = positions[mmsi];
        this.positions.set(mmsi, positions[mmsi]);
      });
    });
    
    return result;
  }
  
  /**
   * Get position for a specific MMSI (check both providers)
   */
  getPosition(mmsi) {
    const mmsiStr = String(mmsi);
    
    // Check AisStream cache first
    if (this.positions.has(mmsiStr)) {
      return this.positions.get(mmsiStr);
    }
    
    // Check Marinesia cache
    const marinesiaPos = this.marinesiaProvider.getPosition(mmsiStr);
    if (marinesiaPos) {
      this.positions.set(mmsiStr, marinesiaPos);
      return marinesiaPos;
    }
    
    // Check MyShipTracking providers
    for (const provider of this.myShipTrackingProviders.values()) {
      const pos = provider.getPosition(mmsiStr);
      if (pos) {
        this.positions.set(mmsiStr, pos);
        return pos;
      }
    }
    
    return null;
  }

  /**
   * Get positions for a specific place/event
   */
  getPositionsForSubscription(id) {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      return [];
    }

    return subscription.mmsiList
      .map(mmsi => this.positions.get(mmsi))
      .filter(pos => pos !== undefined);
  }

  /**
   * Add a listener for position updates
   */
  addPositionListener(listener) {
    this.positionListeners.add(listener);
  }

  /**
   * Remove a position listener
   */
  removePositionListener(listener) {
    this.positionListeners.delete(listener);
  }

  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Increase reconnect interval if we got rate limited (wait longer)
    // Use exponential backoff: 5s, 10s, 20s, 30s max
    const baseDelay = this.reconnectInterval;
    const maxDelay = 30000; // 30 seconds max
    const reconnectDelay = Math.min(baseDelay * Math.pow(2, Math.min(this.reconnectAttempts || 0, 3)), maxDelay);
    
    this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
    
    this.reconnectTimer = setTimeout(() => {
      if (this.subscriptions.size > 0 && !this.isConnecting && !this.isConnected) {
        console.log(`🔄 Attempting to reconnect AIS WebSocket after ${reconnectDelay}ms (attempt ${this.reconnectAttempts})...`);
        this.connect();
      }
    }, reconnectDelay);
  }

  /**
   * Disconnect from AIS stream
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    console.log('🚢 AIS WebSocket disconnected');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      trackedVessels: this.positions.size,
      currentPositions: Object.fromEntries(this.positions)
    };
  }
}

const aisService = new AISService();
module.exports = aisService;
