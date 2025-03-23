class WebSocketClient {
    constructor(options) {
      this.serverAddress = options.serverAddress;
      this.apiKey = options.apiKey;
      this.deviceId = options.deviceId;
      this.protocol = options.protocol || 'wss'; // Default to secure WebSocket
      this.port = options.port || '';
  
      this._webSocket = null;
      this.keepAliveInterval = null;
  
      // Event callbacks
      this.onMessageCallback = options.onMessage || function (msg) { console.log('Message received:', msg); };
      this.onConnectCallback = options.onConnect || function () { console.log('WebSocket connected!'); };
      this.onErrorCallback = options.onError || function (error) { console.error('WebSocket error:', error); };
      this.onCloseCallback = options.onClose || function () { console.log('WebSocket closed'); };
      
      // New callback for unexpected closures
      this.onUnexpectedClose = options.onUnexpectedClose || function() { console.log('WebSocket closed unexpectedly'); };
    }
  
    connect() {
      if (this.isWebSocketOpenOrConnecting()) {
        console.log('WebSocket is already open or connecting');
        return;
      }
  
      if (!this.isWebSocketSupported()) {
        console.error('WebSocket is not supported in this browser');
        return;
      }
  
      try {
        this.openWebSocket();
      } catch (err) {
        console.error(`Error opening WebSocket: ${err}`);
        this.onErrorCallback(err);
      }
    }
  
    openWebSocket() {
      if (!this.apiKey) {
        throw new Error('Cannot open WebSocket without API key');
      }
  
      // Build the WebSocket URL - fixed to match Jellyfin's expected format
      const portStr = this.port ? `:${this.port}` : '';
      // Use protocol directly since we're now expecting 'ws' or 'wss' in the constructor
      const url = `${this.protocol}://${this.serverAddress}${portStr}/socket`;
  
      // Add query parameters
      const fullUrl = `${url}?api_key=${encodeURIComponent(this.apiKey)}&deviceId=${encodeURIComponent(this.deviceId)}`;
  
      console.log(`Opening WebSocket connection to: ${fullUrl}`);
  
      const webSocket = new WebSocket(fullUrl);
  
      webSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log('Message received:', msg);
  
          // Handle keep-alive messages
          if (msg.MessageType === 'KeepAlive') {
            console.debug('Received KeepAlive from server.');
          } else if (msg.MessageType === 'ForceKeepAlive') {
            console.debug(`Received ForceKeepAlive from server. Timeout is ${msg.Data} seconds.`);
            this.sendMessage('KeepAlive');
            this.scheduleKeepAlive(msg.Data);
          }
  
          // Trigger the user's callback
          this.onMessageCallback(msg);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err, event.data);
        }
      };
  
      webSocket.onopen = () => {
        console.log('WebSocket connection opened successfully');
        this.onConnectCallback();
      };
  
      webSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onErrorCallback(error);
      };
  
      webSocket.onclose = (event) => {
        console.log('WebSocket connection closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        
        this.clearKeepAlive();
  
        if (this._webSocket === webSocket) {
          this._webSocket = null;
        }
  
        // If this was an unexpected closure, notify
        if (!event.wasClean) {
          this.onUnexpectedClose();
        }
  
        this.onCloseCallback(event);
      };
  
      this._webSocket = webSocket;
    }
  
    // Send a message to the server
    sendMessage(messageType, data) {
      if (!this.isWebSocketOpen()) {
        console.error('Cannot send message: WebSocket is not open');
        return false;
      }
  
      console.log(`Sending WebSocket message: ${messageType}`, data);
  
      let msg = { MessageType: messageType };
  
      if (data !== undefined) {
        msg.Data = data;
      }
  
      this._webSocket.send(JSON.stringify(msg));
      return true;
    }
  
    // Close the WebSocket connection
    disconnect() {
      if (this._webSocket && this.isWebSocketOpen()) {
        this._webSocket.close();
      }
    }
  
    // Check if WebSocket is open
    isWebSocketOpen() {
      return this._webSocket && this._webSocket.readyState === WebSocket.OPEN;
    }
  
    // Check if WebSocket is open or connecting
    isWebSocketOpenOrConnecting() {
      return this._webSocket &&
        (this._webSocket.readyState === WebSocket.OPEN ||
          this._webSocket.readyState === WebSocket.CONNECTING);
    }
  
    // Check if WebSocket is supported
    isWebSocketSupported() {
      return typeof WebSocket !== 'undefined';
    }
  
    // Set up keep-alive interval
    scheduleKeepAlive(timeout) {
      this.clearKeepAlive();
  
      // Send keep-alive at half the timeout interval to ensure connection stays open
      const intervalTime = Math.max(10, timeout * 1000 * 0.5); // At least 10 seconds
      this.keepAliveInterval = setInterval(() => {
        this.sendMessage('KeepAlive');
        console.log('KeepAlive sent');
      }, intervalTime);
  
      return this.keepAliveInterval;
    }
  
    // Clear keep-alive interval
    clearKeepAlive() {
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
    }
    
    // Get current connection status
    getStatus() {
      if (!this._webSocket) return 'CLOSED';
      
      switch(this._webSocket.readyState) {
        case WebSocket.CONNECTING:
          return 'CONNECTING';
        case WebSocket.OPEN:
          return 'OPEN';
        case WebSocket.CLOSING:
          return 'CLOSING';
        case WebSocket.CLOSED:
          return 'CLOSED';
        default:
          return 'UNKNOWN';
      }
    }
  }