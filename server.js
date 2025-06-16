const  express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const dotenv = require('dotenv')
const {initializeTables} = require('./controllers/tablesController');

// Load environment variables
dotenv.config();

const connectDB = require('./config/db');
const { initializeSocket, emitLobbyUpdate } = require('./utils/socketHelpers');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'reem-team-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Connect to database
connectDB({
  initializeTables();
});

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());
app.set('trust proxy', 1);


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'https://reem-team-frontend.vercel.app'
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/games', require('./routes/games'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/withdrawals', require('./routes/withdrawals'));

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Reem Team Tonk API v1.0.0',
    status: 'Online',
    documentation: '/api/docs'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Create HTTP server
const server = http.createServer(app);

// Set up Socket.IO with authentication
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize socket helpers
initializeSocket(io);

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return next(new Error('Authentication token required'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Invalid authentication token'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id} (User: ${socket.userId})`);
  
  // Join lobby room
  socket.on('joinLobby', () => {
    socket.join('lobby');
    logger.info(`User ${socket.userId} joined lobby`);
  });
  
  // Leave lobby room
  socket.on('leaveLobby', () => {
    socket.leave('lobby');
    logger.info(`User ${socket.userId} left lobby`);
  });
  
  // Join game room
  socket.on('joinGame', (gameId) => {
    if (!gameId) return;
    
    socket.join(`game-${gameId}`);
    logger.info(`User ${socket.userId} joined game ${gameId}`);
  });
  
  // Leave game room
  socket.on('leaveGame', (gameId) => {
    if (!gameId) return;
    
    socket.leave(`game-${gameId}`);
    logger.info(`User ${socket.userId} left game ${gameId}`);
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id} (User: ${socket.userId}), Reason: ${reason}`);
  });
  
  // Handle connection errors
  socket.on('error', (error) => {
    logger.error('Socket error:', error);
  });
});

// Define port
const PORT = process.env.PORT || 5000;

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  
  // Set up periodic lobby updates
  setInterval(async () => {
    try {
      await updateLobbyStats();
    } catch (error) {
      logger.error('Error updating lobby stats:', error);
    }
  }, 10000); // Update every 10 seconds
});

// Function to update lobby statistics
async function updateLobbyStats() {
  try {
    const Game = mongoose.model('Game');
    const Table = mongoose.model('Table');
    
    // Get active games
    const activeGames = await Game.find({ 
      status: { $in: ['waiting', 'playing'] } 
    });
    
    // Count unique human players
    const playerSet = new Set();
    activeGames.forEach(game => {
      game.players.forEach(player => {
        if (!player.isAI && !player.isDropped) {
          playerSet.add(player.id);
        }
      });
    });
    
    // Get updated tables
    const tables = await Table.find({ isActive: true });
    
    // Update table player counts
    for (const table of tables) {
      const tableGames = activeGames.filter(game => 
        table.activeGames.includes(game._id)
      );
      
      const humanPlayers = tableGames.reduce((count, game) => {
        return count + game.players.filter(p => !p.isAI && !p.isDropped).length;
      }, 0);
      
      if (table.currentPlayers !== humanPlayers) {
        table.currentPlayers = humanPlayers;
        await table.save();
      }
    }
    
    // Emit updates
    emitLobbyUpdate({
      playerCount: playerSet.size,
      tables: tables.map(t => ({
        id: t._id,
        tableId: t.tableId,
        amount: t.amount,
        maxPlayers: t.maxPlayers,
        currentPlayers: t.currentPlayers
      }))
    });
    
  } catch (error) {
    logger.error('Error in updateLobbyStats:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = server;
 
