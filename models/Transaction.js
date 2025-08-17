const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['loan', 'payment', 'update'],
    required: [true, 'Please specify transaction type']
  },
  amount: {
    type: Number,
    required: [true, 'Please provide transaction amount'],
    min: [0, 'Transaction amount cannot be negative']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  transactionDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  details: {
    debt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Debt',
      required: [true, 'Please link transaction to a debt']
    },
    paymentScheduleIndex: {
      type: Number,
      // Only required for payment transactions
      validate: {
        validator: function(value) {
          // If type is payment, paymentScheduleIndex is required
          if (this.type === 'payment') {
            return value !== null && value !== undefined && value >= 0;
          }
          return true;
        },
        message: 'Payment schedule index is required for payment transactions'
      }
    },
    bankReference: {
      type: String,
      trim: true,
      maxlength: [100, 'Bank reference cannot be more than 100 characters']
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'cash', 'check', 'online', 'auto_debit'],
      default: 'bank_transfer'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Static method to get transaction summary for a debt
transactionSchema.statics.getDebtSummary = async function(debtId) {
  const summary = await this.aggregate([
    { $match: { 'details.debt': new mongoose.Types.ObjectId(debtId) } },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        transactions: { $push: '$$ROOT' }
      }
    }
  ]);
  
  return summary;
};

// Static method to get monthly payment summary
transactionSchema.statics.getMonthlyPayments = async function(userId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return await this.find({
    user: userId,
    type: 'payment',
    transactionDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('details.debt', 'bankName');
};

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(this.amount);
});

// Indexes for better query performance
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ user: 1, transactionDate: -1 });
transactionSchema.index({ 'details.debt': 1, type: 1 });
transactionSchema.index({ user: 1, status: 1 });
transactionSchema.index({ transactionDate: -1 });

// Ensure virtual fields are serialized
transactionSchema.set('toJSON', { virtuals: true });
transactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Transaction', transactionSchema);
