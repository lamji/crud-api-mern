const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  productName: {
    type: String,
    required: false
  },
  productImage: {
    type: String,
    required: false
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
    required: false // Make optional for testing
  },
  name: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: false
  },
  address: {
    line1: { type: String, required: false },
    city: { type: String, required: false },
    state: { type: String, required: false },
    postal_code: { type: String, required: false },
    country: { type: String, required: false }
  },
  phonenumber: {
    type: String,
    required: [true, 'Phone number is required']
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
  subtotal: {
    type: Number,
    required: false
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total cannot be negative']
  },
  total: {
    type: Number,
    required: false // Keep for backward compatibility
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
    enum: ['pending', 'processing', 'received', 'preparing', 'shipped', 'delivered', 'cancelled', 'paid'],
    default: 'pending'
  },
  date: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: mongoose.Schema.Types.Mixed, // Accept both string and object
    required: [true, 'Payment method is required']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentLink: {
    id: { type: String, required: false },
    checkoutUrl: { type: String, required: false },
    reference: { type: String, required: false },
    status: { type: String, required: false },
    paid: { type: Boolean, default: false }
  },
  paymentId: {
    type: String,
    required: false
  },
  paymentReference: {
    type: String,
    required: false
  },
  paymentAmount: {
    type: Number,
    required: false
  },
  paymentFee: {
    type: Number,
    required: false
  },
  paymentNetAmount: {
    type: Number,
    required: false
  },
  paymentCurrency: {
    type: String,
    required: false
  },
  paidAt: {
    type: Date,
    required: false
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
