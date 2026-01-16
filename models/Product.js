const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  customerName: {
    type: String,
    required: false
  }
});

const productSchema = new mongoose.Schema({
  imageSrc: {
    type: String,
    required: [true, 'Image source is required']
  },
  imageAlt: {
    type: String,
    required: false
  },
  title: {
    type: String,
    required: [true, 'Product title is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  discountPercent: {
    type: Number,
    min: [0, 'Discount percent cannot be negative'],
    max: [100, 'Discount percent cannot exceed 100']
  },
  rating: {
    type: Number,
    required: true,
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot exceed 5']
  },
  reviewCount: {
    type: Number,
    required: true,
    min: [0, 'Review count cannot be negative']
  },
  soldCount: {
    type: Number,
    min: [0, 'Sold count cannot be negative']
  },
  stock: {
    type: Number,
    required: [true, 'Stock is required'],
    min: [0, 'Stock cannot be negative']
  },
  images: [{
    type: String
  }],
  sizes: [{
    type: String
  }],
  description: {
    type: String
  },
  categoryId: {
    type: String
  },
  category: {
    type: String
  },
  type: {
    type: String,
    enum: ['flash', 'new', 'regular']
  },
  isSummerCollection: {
    type: Boolean,
    default: false
  },
  reviews: [reviewSchema]
}, {
  timestamps: true
});

// Index for better query performance
productSchema.index({ category: 1 });
productSchema.index({ categoryId: 1 });
productSchema.index({ type: 1 });
productSchema.index({ title: 'text', description: 'text' }); // For search functionality

module.exports = mongoose.model('Product', productSchema);
