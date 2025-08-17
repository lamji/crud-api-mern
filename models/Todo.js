const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  completed: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  dueDate: {
    type: Date
  },
  category: {
    type: String,
    trim: true,
    maxlength: [30, 'Category cannot be more than 30 characters']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
todoSchema.index({ user: 1, completed: 1 });
todoSchema.index({ user: 1, priority: 1 });
todoSchema.index({ user: 1, dueDate: 1 });

// Virtual for checking if todo is overdue
todoSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.completed) return false;
  return this.dueDate < new Date();
});

// Ensure virtual fields are serialized
todoSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Todo', todoSchema);
