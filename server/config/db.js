const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod = null;

const connectDB = async () => {
  try {
    // Check if we should use in-memory MongoDB
    const useInMemory = process.env.USE_IN_MEMORY_DB === 'true' || !process.env.MONGO_URI;
    
    if (useInMemory) {
      console.log('Starting in-memory MongoDB...');
      mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      console.log(`In-memory MongoDB URI: ${uri}`);
      
      const conn = await mongoose.connect(uri);
      console.log(`Connected to in-memory MongoDB`);
    } else {
      // Use external MongoDB
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
    }
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
};

module.exports = { connectDB, disconnectDB };
