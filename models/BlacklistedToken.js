const mongoose = require('mongoose');

const BlacklistedTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

// Index for automatic deletion using MongoDB TTL
BlacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('BlacklistedToken', BlacklistedTokenSchema);
