const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
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
  }
});

const customerSchema = new mongoose.Schema({
  userid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  address: {
    type: String,
    required: function() { return this.parent().deliveryType === 'delivery'; }
  },
  phonenumber: {
    type: String,
    required: [true, 'Phone number is required']
  }
});

const paymentMethodSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['cash', 'card', 'ewallet'],
    required: [true, 'Payment type is required'],
    default: 'cash'
  },
  details: {
    // For card payments
    cardType: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'discover'],
      required: function() { return this.parent().type === 'card'; }
    },
    lastFour: {
      type: String,
      required: function() { return this.parent().type === 'card'; },
      validate: {
        validator: function(v) {
          return this.parent().type !== 'card' || /^\d{4}$/.test(v);
        },
        message: 'Last four digits must be exactly 4 digits'
      }
    },
    // For e-wallet payments
    provider: {
      type: String,
      enum: ['paypal', 'venmo', 'cashapp', 'zelle', 'applepay', 'googlepay'],
      required: function() { return this.parent().type === 'ewallet'; }
    },
    accountEmail: {
      type: String,
      required: function() { return this.parent().type === 'ewallet'; },
      validate: {
        validator: function(v) {
          return this.parent().type !== 'ewallet' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Valid email is required for e-wallet'
      }
    },
    // Transaction reference
    transactionId: {
      type: String,
      required: function() { return this.parent().type !== 'cash'; }
    }
  }
});

const orderSchema = new mongoose.Schema({
  id: {
    type: String,
    required: [true, 'Order ID is required'],
    unique: true
  },
  customer: {
    type: customerSchema,
    required: [true, 'Customer information is required']
  },
  items: [orderItemSchema],
  total: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total cannot be negative']
  },
  deliveryType: {
    type: String,
    enum: ['pickup', 'delivery'],
    required: [true, 'Delivery type is required'],
    default: 'pickup'
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: [0, 'Delivery fee cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'received', 'preparing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  date: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: paymentMethodSchema,
    required: [true, 'Payment method is required']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
orderSchema.index({ 'customer.userid': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ date: -1 });
orderSchema.index({ deliveryType: 1 });

module.exports = mongoose.model('Order', orderSchema);
