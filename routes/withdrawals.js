const  express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const withdrawalController = require('../controllers/withdrawalController');

// @route   POST /api/withdrawals
// @desc    Submit withdrawal request
// @access  Private
router.post('/', auth, withdrawalController.submitWithdrawal);

// @route   GET /api/withdrawals/user/:userId
// @desc    Get user's withdrawal history
// @access  Private
router.get('/user/:userId', auth, withdrawalController.getUserWithdrawals);

// @route   GET /api/withdrawals/pending
// @desc    Get pending withdrawals (admin only)
// @access  Private/Admin
router.get('/pending', [auth, admin], withdrawalController.getPendingWithdrawals);

// @route   PUT /api/withdrawals/:id/process
// @desc    Process withdrawal request (admin only)
// @access  Private/Admin
router.put('/:id/process', [auth, admin], withdrawalController.processWithdrawal);

module.exports = router;
 