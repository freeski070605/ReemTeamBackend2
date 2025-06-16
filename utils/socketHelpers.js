//  Socket.IO helper functions for real-time game updates

let io = null;

// Initialize Socket.IO instance
function initializeSocket(socketIO) {
  io = socketIO;
}

// Emit game update to all players in a game room
function emitGameUpdate(gameId, gameData) {
  if (!io) return;
  
  // Emit to game room
  io.to(`game-${gameId}`).emit('gameUpdate', {
    type: 'gameState',
    game: gameData,
    timestamp: Date.now()
  });
}

// Emit player action to game room
function emitPlayerAction(gameId, playerId, action, data = {}) {
  if (!io) return;
  
  io.to(`game-${gameId}`).emit('gameUpdate', {
    type: 'playerAction',
    playerId,
    action,
    data,
    timestamp: Date.now()
  });
}

// Emit lobby update to all lobby users
function emitLobbyUpdate(data = {}) {
  if (!io) return;
  
  io.to('lobby').emit('lobbyUpdate', {
    type: 'update',
    ...data,
    timestamp: Date.now()
  });
}

// Emit player count update
function emitPlayerCountUpdate(count) {
  if (!io) return;
  
  io.to('lobby').emit('lobbyUpdate', {
    type: 'playerCount',
    count,
    timestamp: Date.now()
  });
}

// Emit table update
function emitTableUpdate(tableData) {
  if (!io) return;
  
  io.to('lobby').emit('lobbyUpdate', {
    type: 'tableUpdate',
    table: tableData,
    timestamp: Date.now()
  });
}

// Emit game end notification
function emitGameEnd(gameId, winner, pot, multiplier) {
  if (!io) return;
  
  io.to(`game-${gameId}`).emit('gameUpdate', {
    type: 'gameEnd',
    winner,
    pot,
    multiplier,
    timestamp: Date.now()
  });
}

// Emit error to specific user
function emitError(socketId, error) {
  if (!io) return;
  
  io.to(socketId).emit('error', {
    message: error,
    timestamp: Date.now()
  });
}

// Get Socket.IO instance
function getIO() {
  return io;
}

module.exports = {
  initializeSocket,
  emitGameUpdate,
  emitPlayerAction,
  emitLobbyUpdate,
  emitPlayerCountUpdate,
  emitTableUpdate,
  emitGameEnd,
  emitError,
  getIO
};
 