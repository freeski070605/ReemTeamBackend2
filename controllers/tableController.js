const Table = require('../models/Table');
const Game = require('../models/Game');

// @route   GET /api/tables
// @desc    Get all tables
// @access  Public
exports.getTables = async (req, res) => {
  console.log('📥 GET /api/tables - Fetching all tables');
  try {
    const tables = await Table.find().sort({ amount: 1 });
    console.log(`✅ Found ${tables.length} tables`);
    res.json(tables);
  } catch (error) {
    console.error('❌ Get tables error:', error);
    res.status(500).json({ error: 'Server error getting tables' });
  }
};

// @route   POST /api/tables/initialize
// @desc    Initialize default tables (admin only)
// @access  Private/Admin
exports.initializeTables = async (req, res) => {
  console.log('📥 POST /api/tables/initialize - Initializing tables');
  try {
    const existingCount = await Table.countDocuments();
    console.log(`ℹ️ Existing table count: ${existingCount}`);

    if (existingCount > 0) {
      console.warn('⚠️ Tables already initialized');
      return res.status(400).json({ error: 'Tables already initialized' });
    }

    const tables = [
      { tableId: 'table-1', amount: 1, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-2', amount: 1, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-3', amount: 5, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-4', amount: 5, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-5', amount: 10, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-6', amount: 10, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-7', amount: 20, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-8', amount: 20, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-9', amount: 50, maxPlayers: 4, currentPlayers: 0 },
      { tableId: 'table-10', amount: 50, maxPlayers: 4, currentPlayers: 0 },
    ];

    await Table.insertMany(tables);
    console.log('✅ Tables initialized successfully');
    res.json({ message: 'Tables initialized successfully', tables });
  } catch (error) {
    console.error('❌ Initialize tables error:', error);
    res.status(500).json({ error: 'Server error initializing tables' });
  }
};

// @route   GET /api/tables/:tableId
// @desc    Get table by ID
// @access  Public
exports.getTableById = async (req, res) => {
  console.log(`📥 GET /api/tables/${req.params.tableId} - Fetching table by ID`);
  try {
    const table = await Table.findOne({ tableId: req.params.tableId });

    if (!table) {
      console.warn('⚠️ Table not found');
      return res.status(404).json({ error: 'Table not found' });
    }

    console.log('✅ Table found:', table.tableId);
    res.json(table);
  } catch (error) {
    console.error('❌ Get table error:', error);
    res.status(500).json({ error: 'Server error getting table' });
  }
};

// @route   GET /api/tables/:tableId/games
// @desc    Get active games for a table
// @access  Public
exports.getTableGames = async (req, res) => {
  console.log(`📥 GET /api/tables/${req.params.tableId}/games - Fetching games for table`);
  try {
    const table = await Table.findOne({ tableId: req.params.tableId }).populate('activeGames');

    if (!table) {
      console.warn('⚠️ Table not found');
      return res.status(404).json({ error: 'Table not found' });
    }

    const activeGames = table.activeGames.filter(game => game.status !== 'ended');
    console.log(`✅ Found ${activeGames.length} active games for table ${table.tableId}`);

    res.json(activeGames);
  } catch (error) {
    console.error('❌ Get table games error:', error);
    res.status(500).json({ error: 'Server error getting table games' });
  }
};

// @route   GET /api/tables/player-count
// @desc    Get current total player count
// @access  Public
exports.getPlayerCount = async (req, res) => {
  console.log('📥 GET /api/tables/player-count - Fetching total player count');
  try {
    const activeGames = await Game.find({ status: { $ne: 'ended' } });
    const playerSet = new Set();

    activeGames.forEach(game => {
      game.players.forEach(player => {
        if (!player.isAI) {
          playerSet.add(player.id);
        }
      });
    });

    const total = playerSet.size;
    console.log(`✅ Current total human players: ${total}`);

    res.json({ count: total });
  } catch (error) {
    console.error('❌ Get player count error:', error);
    res.status(500).json({ error: 'Server error getting player count' });
  }
};

// @route   PUT /api/tables/:tableId
// @desc    Update table (admin only)
// @access  Private/Admin
exports.updateTable = async (req, res) => {
  console.log(`📥 PUT /api/tables/${req.params.tableId} - Updating table`);
  console.log('📦 Body:', req.body);
  try {
    const { currentPlayers } = req.body;
    const table = await Table.findOne({ tableId: req.params.tableId });

    if (!table) {
      console.warn('⚠️ Table not found');
      return res.status(404).json({ error: 'Table not found' });
    }

    if (typeof currentPlayers === 'number') {
      table.currentPlayers = currentPlayers;
      console.log(`🔁 Updating currentPlayers to ${currentPlayers}`);
    }

    await table.save();
    console.log('✅ Table updated:', table.tableId);
    res.json(table);
  } catch (error) {
    console.error('❌ Update table error:', error);
    res.status(500).json({ error: 'Server error updating table' });
  }
};
