const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  street: { type: String, required: true },
  barangay: { type: String, required: true },
  city: { type: String, required: true },
  province: { type: String, required: true },
  region: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true },
  phone: { type: String, required: true },
  nearestLandmark: String
});

const phoneSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['mobile', 'home', 'work'],
    default: 'mobile'
  },
  number: { type: String, required: true },
  isPrimary: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  }
});

// Custom validation to ensure only one primary phone per profile
phoneSchema.pre('save', async function() {
  if (this.isPrimary) {
    // Find the parent profile and unset other primary phones
    const Profile = mongoose.model('Profile');
    await Profile.updateOne(
      { 'phones._id': { $ne: this._id } },
      { $set: { 'phones.$[].isPrimary': false } }
    );
  }
});

const paymentMethodSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'gcash'],
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  last4: String,
  brand: String,
  expiryMonth: Number,
  expiryYear: Number,
  email: String,
  number: String
});

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  productImage: String,
  productPrice: { type: Number, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
});

const shippingAddressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true }
});

const paymentMethodOrderSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit_card', 'paypal', 'apple_pay', 'google_pay'],
    required: true
  },
  lastFour: String,
  brand: String,
  email: String,
  paidAt: { type: Date, required: true },
  transactionId: { type: String, required: true }
});

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true },
  date: { type: String, required: true },
  orderDate: { type: Date, required: true },
  shippedDate: Date,
  deliveredDate: Date,
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    required: true
  },
  totalAmount: { type: Number, required: true },
  items: [orderItemSchema],
  shippingAddress: shippingAddressSchema,
  paymentMethod: paymentMethodOrderSchema,
  trackingNumber: String,
  carrier: String,
  estimatedDelivery: Date
});

const profileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  oneSignalUserId: { type: String, unique: true, sparse: true },
  phones: [phoneSchema],
  emailVerified: { type: Boolean, default: false },
  emailVerificationOtp: String,
  emailVerificationOtpExpiry: Date,
  otpAttempts: { type: Number, default: 0 },
  otpLockedUntil: Date,
  pendingEmail: String,
  avatar: String,
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  bio: String,
  preferences: {
    newsletter: { type: Boolean, default: false },
    smsNotifications: { type: Boolean, default: false },
    pushNotifications: { type: Boolean, default: false },
    language: { type: String, default: 'en' },
    currency: { type: String, default: 'PHP' }
  },
  stats: {
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    favoriteCategories: [String],
    loyaltyPoints: { type: Number, default: 0 },
    memberSince: { type: Date, default: Date.now }
  },
  addresses: [addressSchema],
  paymentMethods: [paymentMethodSchema],
  orders: [orderSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Profile', profileSchema);
