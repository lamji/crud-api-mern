const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'cashier', 'guest'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  passwordResetOtp: {
    type: String,
    select: false // Don't include in queries by default
  },
  passwordResetOtpExpiry: {
    type: Date,
    select: false // Don't include in queries by default
  },
  passwordResetToken: {
    type: String,
    select: false // Don't include in queries by default
  },
  passwordResetTokenExpiry: {
    type: Date,
    select: false // Don't include in queries by default
  },
  signupPlatform: {
    type: String,
    enum: ['web', 'mobile', 'webview'],
    default: 'web'
  },
  createdAtKey: {
    type: String,
    default: function() {
      return this.email + '_' + Date.now();
    }
  },
  emailVerificationOtp: {
    type: String,
    select: false // Don't include in queries by default
  },
  emailVerificationOtpExpiry: {
    type: Date,
    select: false // Don't include in queries by default
  },
  isPendingVerification: {
    type: Boolean,
    default: false,
    select: false // Don't include in queries by default
  },
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }]
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });

// Hash password before saving
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

// Instance method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Static method to find user by email and include password
userSchema.statics.findByCredentials = async function(email, password) {
  // Use lean query for better performance and normalize email
  const user = await this.findOne({ 
    email: email.toLowerCase().trim(), 
    isActive: true 
  }).select('+password').lean();
  
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Create a temporary user instance for password comparison
  const UserInstance = new this(user);
  const isMatch = await UserInstance.matchPassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  return user;
};

// Add indexes for better query performance
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ lastLogin: -1 });

module.exports = mongoose.model('User', userSchema);
