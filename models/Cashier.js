const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const cashierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  userName: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot be more than 30 characters'],
    match: [/^[a-zA-Z0-9\s]+$/, 'Username can only contain letters, numbers, and spaces']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  activeSession: {
    type: Boolean,
    default: false
  },
  sessionInfo: {
    ipAddress: String,
    userAgent: String,
    loginTime: Date
  },
  loginHistory: [{
    action: {
      type: String,
      enum: ['login', 'logout'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    }
  }],
  orderHistory: [{
    action: {
      type: String,
      enum: ['order_status_update'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    orderId: {
      type: String,
      required: true
    },
    updateData: {
      type: Object,
      required: true
    },
    success: {
      type: Boolean,
      required: true
    },
    error: {
      type: String
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    }
  }]
}, {
  timestamps: true
});

// Hash password before saving
cashierSchema.pre('save', async function(next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();
  
  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to check password
cashierSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to find cashier by userName and include password
cashierSchema.statics.findByCredentials = async function(userName, password) {
  const cashier = await this.findOne({ userName, isActive: true }).select('+password');
  
  if (!cashier) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await cashier.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  return cashier;
};

// Method to record login activity
cashierSchema.methods.recordLogin = function(ipAddress, userAgent) {
  this.lastLogin = new Date();
  this.activeSession = true;
  this.sessionInfo = {
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    loginTime: new Date()
  };
  this.loginHistory.push({
    action: 'login',
    timestamp: new Date(),
    ipAddress: ipAddress || null,
    userAgent: userAgent || null
  });
  
  // Keep only last 50 login records to prevent array from growing too large
  if (this.loginHistory.length > 50) {
    this.loginHistory = this.loginHistory.slice(-50);
  }
  
  return this.save();
};

// Method to record logout activity
cashierSchema.methods.recordLogout = function(ipAddress, userAgent) {
  this.activeSession = false;
  this.sessionInfo = {
    ipAddress: null,
    userAgent: null,
    loginTime: null
  };
  this.loginHistory.push({
    action: 'logout',
    timestamp: new Date(),
    ipAddress: ipAddress || null,
    userAgent: userAgent || null
  });
  
  // Keep only last 50 login records to prevent array from growing too large
  if (this.loginHistory.length > 50) {
    this.loginHistory = this.loginHistory.slice(-50);
  }
  
  return this.save();
};

// Method to check if cashier has active session
cashierSchema.methods.hasActiveSession = function() {
  return this.activeSession === true;
};

// Method to log order status update
cashierSchema.methods.logOrderStatusUpdate = function(orderId, updateData, success, error = null) {
  this.orderHistory.push({
    action: 'order_status_update',
    timestamp: new Date(),
    orderId: orderId,
    updateData: updateData,
    success: success,
    error: error,
    ipAddress: this.sessionInfo?.ipAddress || null,
    userAgent: this.sessionInfo?.userAgent || null
  });
  
  // Keep only last 50 order records to prevent array from growing too large
  if (this.orderHistory.length > 50) {
    this.orderHistory = this.orderHistory.slice(-50);
  }
  
  return this.save();
};

// Method to get JSON representation without password
cashierSchema.methods.toJSON = function() {
  const cashierObject = this.toObject();
  delete cashierObject.password;
  delete cashierObject.__v;
  return cashierObject;
};

const Cashier = mongoose.model('Cashier', cashierSchema);

module.exports = Cashier;
