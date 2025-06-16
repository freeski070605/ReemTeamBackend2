const  mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingWithdrawals: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWinnings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWagered: {
    type: Number,
    default: 0,
    min: 0
  },
  gamesPlayed: {
    type: Number,
    default: 0,
    min: 0
  },
  gamesWon: {
    type: Number,
    default: 0,
    min: 0
  },
  avatar: {
    type: String,
    default: function() {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.username)}&background=0D8ABC&color=fff`;
    }
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  cashAppTag: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || v.startsWith('$');
      },
      message: 'CashApp tag must start with $'
    }
  }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for win rate
userSchema.virtual('winRate').get(function() {
  return this.gamesPlayed > 0 ? (this.gamesWon / this.gamesPlayed * 100).toFixed(1) : 0;
});

// Virtual for profit/loss
userSchema.virtual('netProfit').get(function() {
  return this.totalWinnings - this.totalWagered;
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to update game stats
userSchema.methods.updateGameStats = async function(won, wagered, winnings = 0) {
  this.gamesPlayed += 1;
  this.totalWagered += wagered;
  
  if (won) {
    this.gamesWon += 1;
    this.totalWinnings += winnings;
    this.balance += winnings;
  }
  
  return this.save();
};

// Static method to find by email or username
userSchema.statics.findByEmailOrUsername = function(emailOrUsername) {
  return this.findOne({
    $or: [
      { email: emailOrUsername.toLowerCase() },
      { username: emailOrUsername }
    ]
  });
};

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
 