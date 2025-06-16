const  express = require('express');
const router = express.Router();
const Table = require('../models/Table');
const Game = require('../models/Game');

// @route   GET /api/tables
// @desc    Get all available tables
// @access  Public
router.get('/', async (req, res) => {
  try {
    const tables = await Table.find({ isActive: true }).sort({ amount: 1 });
    
    // Calculate current players for each table
    const tablesWithCounts = await Promise.all(
      tables.map(async (table) => {
        const activeGames = await Game.find({
          _id: { $in: table.activeGames },
          status: { $in: ['waiting', 'playing'] }
        });
        
        const humanPlayers = activeGames.reduce((count, game) => {
          return count + game.players.filter(p => !p.isAI && !p.isDropped).length;
        }, 0);
        
        return {
          id: table._id,
          tableId: table.tableId,
          amount: table.amount,
          maxPlayers: table.maxPlayers,
          currentPlayers: humanPlayers,
          activeGames: activeGames.map(g => g._id)
        };
      })
    );
    
    res.json(tablesWithCounts);
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({ error: 'Server error getting tables' });
  }
});

// @route   GET /api/tables/player-count
// @desc    Get total online player count
// @access  Public
router.get('/player-count', async (req, res) => {
  try {
    const activeGames = await Game.find({ 
      status: { $in: ['waiting', 'playing'] } 
    });
    
    const playerSet = new Set();
    
    activeGames.forEach(game => {
      game.players.forEach(player => {
        if (!player.isAI && !player.isDropped) {
          playerSet.add(player.id);
        }
      });
    });
    
    res.json({ count: playerSet.size });
  } catch (error) {
    console.error('Get player count error:', error);
    res.status(500).json({ error: 'Server error getting player count' });
  }
});

// @route   POST /api/tables/initialize
// @desc    Initialize default tables (admin only)
// @access  Private
router.post('/initialize', async (req, res) => {
  try {
    // Check if tables already exist
    const existingCount = await Table.countDocuments();
    
    if (existingCount > 0) {
      return res.status(400).json({ error: 'Tables already initialized' });
    }
    
    // Create default stake tables
    const stakes = [1, 5, 10, 20, 50];
    const tables = [];
    
    for (const stake of stakes) {
      // Create multiple tables per stake level
      const tableCount = stake <= 5 ? 3 : stake <= 20 ? 2 : 1;
      
      for (let i = 1; i <= tableCount; i++) {
        const table = new Table({
          tableId: `${stake}-dollar-table-${i}`,
          amount: stake,
          maxPlayers: 4,
          currentPlayers: 0,
          activeGames: []
        });
        
        tables.push(table);
      }
    }
    
    await Table.insertMany(tables);
    
    res.json({ 
      message: 'Tables initialized successfully',
      count: tables.length,
      tables: tables.map(t => ({ id: t._id, tableId: t.tableId, amount: t.amount }))
    });
  } catch (error) {
    console.error('Initialize tables error:', error);
    res.status(500).json({ error: 'Server error initializing tables' });
  }
});

module.exports = router;
 