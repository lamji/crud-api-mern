const mongoose = require('mongoose');

const removedItemSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  size: {
    type: String,
    required: false
  },
  removedAt: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    enum: ['user_removed', 'quantity_zero', 'expired', 'out_of_stock'],
    default: 'user_removed'
  }
}, {
  timestamps: true
});

// Index for better query performance
removedItemSchema.index({ user: 1, removedAt: -1 });
removedItemSchema.index({ product: 1 });

module.exports = mongoose.model('RemovedItem', removedItemSchema);
