const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Database Indexing Script
 * Creates optimized indexes for better query performance
 */

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todo-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🔗 Connected to MongoDB - Creating indexes...');

    // User collection indexes
    const User = require('../models/User');
    const Cashier = require('../models/Cashier');
    const Profile = require('../models/Profile');
    const Order = require('../models/Order');
    const Product = require('../models/Product');

    // Create compound index for user login queries (email + isActive)
    console.log('📊 Creating user login index...');
    try {
      await User.collection.createIndex(
        { email: 1, isActive: 1 },
        { name: 'user_login_index' }
      );
      console.log('✅ User login index created');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  User login index already exists');
      } else {
        throw error;
      }
    }

    // Create index for cashier login queries
    console.log('📊 Creating cashier login index...');
    try {
      await Cashier.collection.createIndex(
        { userName: 1, isActive: 1 },
        { name: 'cashier_login_index' }
      );
      console.log('✅ Cashier login index created');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  Cashier login index already exists');
      } else {
        throw error;
      }
    }

    // Create index for order queries
    console.log('📊 Creating order indexes...');
    try {
      await Order.collection.createIndex(
        { id: 1 },
        { name: 'order_id_index', unique: true }
      );
      console.log('✅ Order ID index created');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  Order ID index already exists');
      } else {
        throw error;
      }
    }

    try {
      await Order.collection.createIndex(
        { 'customer.userid': 1, createdAt: -1 },
        { name: 'customer_orders_index' }
      );
      console.log('✅ Customer orders index created');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  Customer orders index already exists');
      } else {
        throw error;
      }
    }

    // Create index for product queries
    console.log('📊 Creating product indexes...');
    try {
      await Product.collection.createIndex(
        { _id: 1, stock: 1 },
        { name: 'product_stock_index' }
      );
      console.log('✅ Product stock index created');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  Product stock index already exists');
      } else {
        throw error;
      }
    }

    // Create indexes for profile queries
    console.log('📊 Creating profile indexes...');
    try {
      await Profile.collection.createIndex(
        { user: 1 },
        { name: 'profile_user_index' }
      );
      console.log('✅ Profile user index created');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  Profile user index already exists');
      } else {
        throw error;
      }
    }

    try {
      await Profile.collection.createIndex(
        { user: 1, createdAt: -1 },
        { name: 'profile_user_date_index' }
      );
      console.log('✅ Profile user-date index created');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️  Profile user-date index already exists');
      } else {
        throw error;
      }
    }

    console.log('✅ All indexes created successfully!');
    
    // List all indexes
    const userIndexes = await User.collection.getIndexes();
    console.log('📋 User indexes:', Object.keys(userIndexes));

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  createIndexes();
}

module.exports = { createIndexes };
