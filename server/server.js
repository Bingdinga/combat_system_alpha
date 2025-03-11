const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const socketIo = require('socket.io');
const RoomManager = require('./RoomManager');
const CombatManager = require('./CombatManager');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Setup Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize managers
const roomManager = new RoomManager(io);
const combatManager = new CombatManager(io, roomManager);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle player joining
  socket.on('join', (data) => {
    const { username, roomId } = data;
    roomManager.joinRoom(socket, username, roomId);
  });

  // Combat-related events
  socket.on('initiateCombat', (data) => {
    combatManager.initiateCombat(socket, data);
  });

  socket.on('combatAction', (data) => {
    combatManager.handleAction(socket, data);
  });

  // Disconnect event
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    roomManager.leaveRooms(socket);
  });

  // In server/server.js, add this to the socket.io connection handler
  socket.on('registerPlayer', (data) => {
    console.log(`Player registered with socket ID: ${data.socketId}`);
    socket.clientId = data.socketId; // Store in socket object for reference
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});