const  mongoose = require('mongoose');



const playerSchema = new mongoose.Schema({
  id: String,
  username: String,
  avatar: String,
  isAI: { type: Boolean, default: false },
  hand: [cardSchema],
  isDropped: { type: Boolean, default: false },
  canDrop: { type: Boolean, default: false },
  score: { type: Number, default: 0 },
  penalties: { type: Number, default: 0 },
  hitCount: { type: Number, default: 0 },
  hasDrawn: { type: Boolean, default: false },
  dropTime: Date
}); 

// Card schema
const cardSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  suit: {
    type: String,
    required: true,
    enum: ['hearts', 'diamonds', 'clubs', 'spades', '?']
  },
  rank: {
    type: String,
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  isHidden: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Player schema
const playerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  isAI: {
    type: Boolean,
    default: false
  },
  hand: [cardSchema],
  isDropped: {
    type: Boolean,
    default: false
  },
  canDrop: {
    type: Boolean,
    default: false
  },
  score: {
    type: Number,
    default: 0
  },
  penalties: {
    type: Number,
    default: 0
  },
  avatar: {
    type: String
  }
}, { _id: false });



const  gameSchema = new mongoose.Schema({
  players: [playerSchema],
  currentPlayerIndex: {
    type: Number,
    default: 0
  },
  deck: [cardSchema],
  discardPile: [cardSchema],
  status: {
    type: String,
    enum: ['waiting', 'playing', 'ended'],
    default: 'waiting'
  },
  stake: {
    type: Number,
    required: true,
    min: 1
  },
  pot: {
    type: Number,
    default: function() {
      return this.stake * 4;
    }
  },
  winner: String,
  winningMultiplier: {
    type: Number,
    default: 1
  },
  gameStarted: {
    type: Boolean,
    default: false
  },
  turnStartTime: {
    type: Date,
    default: Date.now
  },
  lastActionAt: {
    type: Date,
    default: Date.now
  },
  lastAction: {
    type: {
      type: String
    },
    player: String,
    timestamp: Date,
    card: cardSchema,
    score: Number,
    multiplier: Number,
    penalties: [{
      playerId: String,
      penaltyTurns: Number,
      hitSpread: mongoose.Schema.Types.Mixed
    }]
  },
  endTime: Date
}, {
  timestamps: true
});

// Index for efficient queries
gameSchema.index({ status: 1, createdAt: -1 });
gameSchema.index({ 'players.id': 1 });

module.exports = mongoose.model('Game', gameSchema); 
 
