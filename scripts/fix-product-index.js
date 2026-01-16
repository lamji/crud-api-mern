const mongoose = require('mongoose');
require('dotenv').config();

async function fixProductIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/to-do-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Get the products collection
    const db = mongoose.connection.db;
    const collection = db.collection('products');

    // Drop the old id index if it exists
    try {
      await collection.dropIndex('id_1');
      console.log('Successfully dropped old id_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('id_1 index does not exist, skipping...');
      } else {
        console.log('Error dropping id_1 index:', error.message);
      }
    }

    // List current indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => idx.name));

    console.log('Product index fix completed successfully');

  } catch (error) {
    console.error('Error fixing product indexes:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixProductIndex();
