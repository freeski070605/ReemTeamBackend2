const  Table = require('../models/Table');
const Game = require('../models/Game');

// @route   GET /api/tables
// @desc    Get all tables
// @access  Public
exports.getTables = async (req, res) => {
  try {
    const tables = await Table.find().sort({ amount: 1 });
    res.json(tables);
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({ error: 'Server error getting tables' });
  }
};

// @route   POST /api/tables/initialize
// @desc    Initialize default tables (admin only)
// @access  Private/Admin
exports.initializeTables = async (req, res) => {
  try {
    // Check if tables already exist
    const existingCount = await Table.countDocuments();
    
    if (existingCount > 0) {
      return res.status(400).json({ error: 'Tables already initialized' });
    }
    
    // Create sample tables
    const tables = [
      { tableId: 'table-1', amount: 1, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-2', amount: 1, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-3', amount: 5, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-4', amount: 5, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-5', amount: 10, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-6', amount: 20, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-7', amount: 50, maxPlayers: 4, currentPlayers: 0 },
    ];
    
    await Table.insertMany(tables);
    
    res.json({ message: 'Tables initialized successfully', tables });
  } catch (error) {
    console.error('Initialize tables error:', error);
    res.status(500).json({ error: 'Server error initializing tables' });
  }
};

// @route   GET /api/tables/:tableId
// @desc    Get table by ID
// @access  Public
exports.getTableById = async (req, res) => {
  try {
    const table = await Table.findOne({ tableId: req.params.tableId });
    
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    res.json(table);
  } catch (error) {
    console.error('Get table error:', error);
    res.status(500).json({ error: 'Server error getting table' });
  }
};

// @route   GET /api/tables/:tableId/games
// @desc    Get active games for a table
// @access  Public
exports.getTableGames = async (req, res) => {
  try {
    const table = await Table.findOne({ tableId: req.params.tableId })
      .populate('activeGames');
    
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    // Filter out only active games
    const activeGames = table.activeGames.filter(game => game.status !== 'ended');
    
    res.json(activeGames);
  } catch (error) {
    console.error('Get table games error:', error);
    res.status(500).json({ error: 'Server error getting table games' });
  }
};

// @route   GET /api/tables/player-count
// @desc    Get current total player count
// @access  Public
exports.getPlayerCount = async (req, res) => {
  try {
    // Get count of active players in games
    const activeGames = await Game.find({ status: { $ne: 'ended' } });
    
    // Count unique human players (non-AI)
    const playerSet = new Set();
    
    activeGames.forEach(game => {
      game.players.forEach(player => {
        if (!player.isAI) {
          playerSet.add(player.id);
        }
      });
    });
    
    res.json({ count: playerSet.size });
  } catch (error) {
    console.error('Get player count error:', error);
    res.status(500).json({ error: 'Server error getting player count' });
  }
};

// @route   PUT /api/tables/:tableId
// @desc    Update table (admin only)
// @access  Private/Admin
exports.updateTable = async (req, res) => {
  try {
    const { currentPlayers } = req.body;
    
    const table = await Table.findOne({ tableId: req.params.tableId });
    
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    if (typeof currentPlayers === 'number') {
      table.currentPlayers = currentPlayers;
    }
    
    await table.save();
    
    res.json(table);
  } catch (error) {
    console.error('Update table error:', error);
    res.status(500).json({ error: 'Server error updating table' });
  }
};
 