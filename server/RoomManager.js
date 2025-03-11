class RoomManager {
    constructor(io) {
      this.io = io;
      this.rooms = new Map(); // Maps roomId to room data
      this.socketToRoom = new Map(); // Maps socketId to roomId
    }
  
    createRoom(roomId) {
      if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, {
          id: roomId,
          players: new Map(), // Maps socketId to player data
          inCombat: false,
          combatState: null
        });
        console.log(`Room created: ${roomId}`);
      }
      return this.rooms.get(roomId);
    }
  
    joinRoom(socket, username, roomId) {
      // Create room if it doesn't exist
      const room = this.createRoom(roomId);
      
      // Add player to room
      const player = {
        id: socket.id,
        username,
        isReady: false,
        stats: {
          health: 100,
          maxHealth: 100,
          energy: 50,
          maxEnergy: 50
        }
      };
      
      room.players.set(socket.id, player);
      this.socketToRoom.set(socket.id, roomId);
      
      // Join the Socket.io room
      socket.join(roomId);
      
      // Notify room about new player
      this.io.to(roomId).emit('playerJoined', {
        playerId: socket.id,
        username,
        players: Array.from(room.players.values())
      });
      
      console.log(`Player ${username} (${socket.id}) joined room ${roomId}`);
      return player;
    }
  
    leaveRoom(socket) {
      const roomId = this.socketToRoom.get(socket.id);
      if (!roomId) return null;
      
      const room = this.rooms.get(roomId);
      if (!room) return null;
      
      // Remove player from room
      const player = room.players.get(socket.id);
      room.players.delete(socket.id);
      this.socketToRoom.delete(socket.id);
      
      // Leave the Socket.io room
      socket.leave(roomId);
      
      // Notify room about player leaving
      this.io.to(roomId).emit('playerLeft', {
        playerId: socket.id,
        username: player.username,
        players: Array.from(room.players.values())
      });
      
      console.log(`Player ${player.username} (${socket.id}) left room ${roomId}`);
      
      // Clean up empty rooms
      if (room.players.size === 0) {
        this.rooms.delete(roomId);
        console.log(`Room deleted: ${roomId}`);
      }
      
      return player;
    }
  
    leaveRooms(socket) {
      return this.leaveRoom(socket);
    }
  
    getRoom(roomId) {
      return this.rooms.get(roomId);
    }
  
    getPlayerRoom(socketId) {
      const roomId = this.socketToRoom.get(socketId);
      if (!roomId) return null;
      return this.rooms.get(roomId);
    }
  
    getRoomPlayers(roomId) {
      const room = this.rooms.get(roomId);
      if (!room) return [];
      return Array.from(room.players.values());
    }
  
    // Utility method to broadcast to all players in a room
    broadcastToRoom(roomId, event, data) {
      this.io.to(roomId).emit(event, data);
    }
  }
  
  module.exports = RoomManager;