export class Socket {
  constructor() {
    // Initialize Socket.io connection
    this.socket = io();

    // Store event callbacks
    this.callbacks = {};

    // Store the socket ID once connected
    this.socketId = null;

    // Set up basic event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Handle connection
    this.socket.on('connect', () => {
      this.socketId = this.socket.id;
      console.log('Connected to server with ID:', this.socketId);

      // Emit a custom event to associate this socket ID with this client
      this.socket.emit('registerPlayer', { socketId: this.socketId });
    });

    // Handle disconnection
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Handle connection errors
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
  }

  // Update the id getter:
  get id() {
    return this._id || this.socket.id;
  }

  // Emit an event to the server
  emit(event, data) {
    this.socket.emit(event, data);
  }

  // Register a callback for a specific event
  on(event, callback) {
    // Store the callback
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);

    // Register with socket.io
    this.socket.on(event, (data) => {
      // Call all registered callbacks for this event
      this.callbacks[event].forEach(cb => cb(data));
    });
  }

  // Remove a callback for an event
  off(event, callback) {
    if (this.callbacks[event]) {
      // Remove the callback from our list
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);

      // If no callbacks left, remove the socket.io listener
      if (this.callbacks[event].length === 0) {
        this.socket.off(event);
        delete this.callbacks[event];
      }
    }
  }


  // Check if connected to server
  get connected() {
    return this.socket.connected;
  }
}