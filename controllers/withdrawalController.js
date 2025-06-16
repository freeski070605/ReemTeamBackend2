const  Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');

// @route   POST /api/withdrawals
// @desc    Submit withdrawal request
// @access  Private
exports.submitWithdrawal = [
  body('amount').isNumeric().isFloat({ min: 10 }).withMessage('Minimum withdrawal amount is $10'),
  body('cashAppTag').matches(/^\$/).withMessage('CashApp tag must start with $'),
  
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { amount, cashAppTag } = req.body;
      const userId = req.user.id;

      // Get user and check balance
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Check for pending withdrawals
      const pendingWithdrawal = await Withdrawal.findOne({
        userId,
        status: 'pending'
      });

      if (pendingWithdrawal) {
        return res.status(400).json({ error: 'You already have a pending withdrawal request' });
      }

      // Create withdrawal request
      const withdrawal = new Withdrawal({
        userId,
        amount,
        cashAppTag,
        status: 'pending'
      });

      // Reserve the funds (deduct from balance)
      user.balance -= amount;
      user.pendingWithdrawals = (user.pendingWithdrawals || 0) + amount;

      await Promise.all([withdrawal.save(), user.save()]);

      res.json({
        id: withdrawal._id,
        userId: withdrawal.userId,
        amount: withdrawal.amount,
        cashAppTag: withdrawal.cashAppTag,
        status: withdrawal.status,
        timestamp: withdrawal.createdAt.getTime()
      });
    } catch (error) {
      console.error('Submit withdrawal error:', error);
      res.status(500).json({ error: 'Server error submitting withdrawal' });
    }
  }
];

// @route   GET /api/withdrawals/user/:userId
// @desc    Get user's withdrawal history
// @access  Private
exports.getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Ensure user can only access their own withdrawals
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const withdrawals = await Withdrawal.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const formattedWithdrawals = withdrawals.map(w => ({
      id: w._id,
      userId: w.userId,
      amount: w.amount,
      cashAppTag: w.cashAppTag,
      status: w.status,
      adminNotes: w.adminNotes,
      timestamp: w.createdAt.getTime(),
      processedAt: w.processedAt ? w.processedAt.getTime() : null
    }));

    res.json(formattedWithdrawals);
  } catch (error) {
    console.error('Get user withdrawals error:', error);
    res.status(500).json({ error: 'Server error getting withdrawal history' });
  }
};

// @route   GET /api/withdrawals/pending
// @desc    Get pending withdrawals (admin only)
// @access  Private/Admin
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ status: 'pending' })
      .populate('userId', 'username email')
      .sort({ createdAt: 1 });

    res.json(withdrawals);
  } catch (error) {
    console.error('Get pending withdrawals error:', error);
    res.status(500).json({ error: 'Server error getting pending withdrawals' });
  }
};

// @route   PUT /api/withdrawals/:id/process
// @desc    Process withdrawal request (admin only)
// @access  Private/Admin
exports.processWithdrawal = [
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  body('adminNotes').optional().isString(),
  body('transactionId').optional().isString(),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { status, adminNotes, transactionId } = req.body;
      const withdrawalId = req.params.id;

      const withdrawal = await Withdrawal.findById(withdrawalId);
      
      if (!withdrawal) {
        return res.status(404).json({ error: 'Withdrawal not found' });
      }

      if (withdrawal.status !== 'pending') {
        return res.status(400).json({ error: 'Withdrawal already processed' });
      }

      // Update withdrawal
      withdrawal.status = status;
      withdrawal.adminNotes = adminNotes || '';
      withdrawal.processedBy = req.user.id;
      withdrawal.processedAt = new Date();
      
      if (transactionId) {
        withdrawal.transactionId = transactionId;
      }

      // Update user's pending withdrawals
      const user = await User.findById(withdrawal.userId);
      
      if (user) {
        user.pendingWithdrawals = Math.max(0, (user.pendingWithdrawals || 0) - withdrawal.amount);
        
        // If rejected, return funds to balance
        if (status === 'rejected') {
          user.balance += withdrawal.amount;
        }
        
        await user.save();
      }

      await withdrawal.save();

      res.json({
        message: `Withdrawal ${status} successfully`,
        withdrawal: {
          id: withdrawal._id,
          amount: withdrawal.amount,
          status: withdrawal.status,
          adminNotes: withdrawal.adminNotes,
          processedAt: withdrawal.processedAt
        }
      });
    } catch (error) {
      console.error('Process withdrawal error:', error);
      res.status(500).json({ error: 'Server error processing withdrawal' });
    }
  }
];
 