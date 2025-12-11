const WebSocket = require('ws');
const aisService = require('./aisService');

class AISWebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    // Don't reinitialize if already initialized
    if (this.wss) {
      console.log('⚠️ AIS WebSocket server already initialized');
      return;
    }

    // Create WebSocket server
    this.wss = new WebSocket.Server({ 
      server,
      path: '/api/ais/ws',
      perMessageDeflate: false, // Disable compression for better performance
      verifyClient: (info, callback) => {
        // Log connection attempt
        const origin = info.origin || info.req.headers.origin || 'no origin';
        console.log('🔍 WebSocket upgrade request:', info.req.url, 'Origin:', origin);
        
        // Accept connection (origin check happens in connection handler)
        callback(true);
      }
    });

    console.log('✅ AIS WebSocket server created, waiting for connections on /api/ais/ws');

    this.wss.on('connection', (ws, req) => {
      const origin = req.headers.origin;
      const ip = req.socket.remoteAddress;
      
      console.log('🔌 New WebSocket connection attempt from:', origin || 'no origin', 'IP:', ip);
      
      // Basic origin check (CORS is handled at HTTP level)
      if (origin && !origin.includes('discover-gozo.com') && !origin.includes('localhost')) {
        console.warn('⚠️ Rejected WebSocket connection from unauthorized origin:', origin);
        ws.close(1008, 'Unauthorized origin');
        return;
      }

      console.log('✅ AIS WebSocket client connected from:', origin || 'no origin');
      this.clients.add(ws);

      // Send current positions immediately
      const currentPositions = aisService.getAllPositions();
      if (Object.keys(currentPositions).length > 0) {
        ws.send(JSON.stringify({ 
          type: 'positions', 
          data: currentPositions 
        }));
      } else {
        ws.send(JSON.stringify({ 
          type: 'connected', 
          message: 'AIS WebSocket connected' 
        }));
      }

      // Listen for position updates from AIS service
      const positionListener = (position) => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'position', 
              data: position 
            }));
          }
        } catch (error) {
          console.error('Error sending position to WebSocket client:', error);
        }
      };

      aisService.addPositionListener(positionListener);

      // Handle client disconnect
      ws.on('close', () => {
        console.log('❌ AIS WebSocket client disconnected');
        this.clients.delete(ws);
        aisService.removePositionListener(positionListener);
      });

      ws.on('error', (error) => {
        console.error('AIS WebSocket client error:', error);
        this.clients.delete(ws);
        aisService.removePositionListener(positionListener);
      });

      // Handle ping/pong for keepalive
      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });

    // Ping all clients every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(pingInterval);
    });

    console.log('✅ AIS WebSocket server initialized on /api/ais/ws');
  }

  /**
   * Broadcast position update to all connected clients
   */
  broadcast(data) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  /**
   * Get number of connected clients
   */
  getClientCount() {
    return this.wss ? this.wss.clients.size : 0;
  }
}

const aisWebSocketServer = new AISWebSocketServer();
module.exports = aisWebSocketServer;

