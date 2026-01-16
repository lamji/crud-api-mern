const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide a user ID']
  },
  type: {
    type: String,
    required: [true, 'Please provide a notification type'],
    enum: ['order', 'shipping', 'payment', 'promotion', 'delivery']
  },
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Please provide a message'],
    trim: true,
    maxlength: [500, 'Message cannot be more than 500 characters']
  },
  status: {
    type: String,
    required: [true, 'Please provide a status'],
    enum: ['success', 'info', 'warning', 'error'],
    default: 'info'
  },
  read: {
    type: Boolean,
    default: false
  },
  amount: {
    type: Number,
    min: [0, 'Amount cannot be negative']
  },
  orderId: {
    type: String,
    trim: true
  },
  // Payment specific fields
  paymentId: {
    type: String,
    trim: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['gcash', 'maya', 'card', 'bank_transfer', 'cash_on_delivery', 'paypal'],
    trim: true
  },
  paymentAmount: {
    type: Number,
    min: [0, 'Payment amount cannot be negative']
  },
  paymentFee: {
    type: Number,
    min: [0, 'Payment fee cannot be negative'],
    default: 0
  },
  // Order specific fields
  orderStatus: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  // Array of items in the notification
  items: [{
    productId: {
      type: String,
      required: true,
      trim: true
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Product name cannot be more than 200 characters']
    },
    productImage: {
      type: String,
      trim: true
    },
    productPrice: {
      type: Number,
      required: true,
      min: [0, 'Product price cannot be negative']
    },
    productCategory: {
      type: String,
      trim: true,
      maxlength: [50, 'Category name cannot be more than 50 characters']
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      default: 1
    }
  }]
}, {
  timestamps: true
});

// Index for better query performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ paymentStatus: 1 });
notificationSchema.index({ orderStatus: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
