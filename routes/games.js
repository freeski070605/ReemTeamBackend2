const  express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const gameController = require('../controllers/gameController');

// All routes are protected
router.use(auth);

// @route   POST /api/games
// @desc    Create a new game
// @access  Private
router.post('/', gameController.createGame);

// @route   GET /api/games/:id
// @desc    Get game by ID
// @access  Private
router.get('/:id', gameController.getGameById);

// @route   POST /api/games/:id/join
// @desc    Join an existing game
// @access  Private
router.post('/:id/join', gameController.joinGame);

// @route   POST /api/games/:id/action
// @desc    Perform a game action
// @access  Private
router.post('/:id/action', gameController.performAction);

module.exports = router;
 