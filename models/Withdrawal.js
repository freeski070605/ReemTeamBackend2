const  mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 10
  },
  cashAppTag: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return v.startsWith('$');
      },
      message: 'CashApp tag must start with $'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processed'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  transactionId: {
    type: String
  }
});

// Index for efficient queries
withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
 