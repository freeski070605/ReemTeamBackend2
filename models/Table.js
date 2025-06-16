const  mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tableId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  maxPlayers: {
    type: Number,
    default: 4
  },
  currentPlayers: {
    type: Number,
    default: 0
  },
  activeGames: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Update lastUpdated on save
tableSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

// Index for efficient queries
tableSchema.index({ amount: 1, isActive: 1 });

module.exports = mongoose.model('Table', tableSchema);
 