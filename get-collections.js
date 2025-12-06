#!/usr/bin/env node

/**
 * Simple script to list all collections in MongoDB database
 * Run with: node get-collections.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function getAllCollections() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected successfully!\n');

    // Get database name from connection
    const dbName = mongoose.connection.db.databaseName;
    console.log(`📊 Database: ${dbName}\n`);

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log(`📁 Found ${collections.length} collection(s):\n`);
    
    // List each collection with document count
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`  📦 ${collection.name} (${count} documents)`);
    }

    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the script
getAllCollections();
