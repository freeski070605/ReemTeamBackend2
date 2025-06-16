const  User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// @route   POST /api/auth/register
// @desc    Register a user
// @access  Public
exports.register = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { username, email, password } = req.body;
  
  try {
    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    
    if (user) {
      if (user.email === email) {
        return res.status(400).json({ error: 'Email already in use' });
      } else {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }
    
    // Create new user
    user = new User({
      username,
      email,
      password
    });
    
    await user.save();
    
    // Create and send JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // Return user data and token
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        avatar: user.avatar,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
exports.login = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { username, password } = req.body;
  
  try {
    // Check if user exists
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Create and send JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // Return user data and token
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        avatar: user.avatar,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// @route   GET /api/auth/user
// @desc    Get user data
// @access  Private
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      balance: user.balance,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error getting user data' });
  }
};

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Only allow updating certain fields
    const { email } = req.body;
    
    if (email) {
      // Check if email is already in use by another user
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      user.email = email;
    }
    
    await user.save();
    
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      balance: user.balance,
      avatar: user.avatar,
      isAdmin: user.isAdmin
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error updating profile' });
  }
};

// @route   PUT /api/auth/balance
// @desc    Update user balance (for testing only, normally handled by game logic)
// @access  Private
exports.updateBalance = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (typeof amount !== 'number') {
      return res.status(400).json({ error: 'Amount must be a number' });
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.balance += amount;
    
    // Prevent negative balance
    if (user.balance < 0) {
      user.balance = 0;
    }
    
    await user.save();
    
    res.json({
      id: user._id,
      username: user.username,
      balance: user.balance
    });
  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({ error: 'Server error updating balance' });
  }
};
 