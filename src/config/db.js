const mongoose = require('mongoose');

// Set default timezone for the entire application before connecting to MongoDB
process.env.TZ = 'Asia/Ho_Chi_Minh';

// Override default mongoose toJSON method to convert Date fields to Vietnam timezone
mongoose.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.createdAt) {
      // Convert createdAt from UTC to Vietnam timezone
      const createdDate = new Date(ret.createdAt);
      ret.createdAt = new Date(createdDate.getTime() + (7 * 60 * 60 * 1000));
    }
    if (ret.updatedAt) {
      // Convert updatedAt from UTC to Vietnam timezone
      const updatedDate = new Date(ret.updatedAt);
      ret.updatedAt = new Date(updatedDate.getTime() + (7 * 60 * 60 * 1000));
    }
    return ret;
  }
});

// Override Date.now() function to return time in Vietnam timezone
const originalDateNow = Date.now;
Date.now = function() {
  // Add 7 hours (7 * 60 * 60 * 1000 milliseconds) to current time
  return originalDateNow() + (7 * 60 * 60 * 1000);
};

const connectDB = async () => {
  try {
    // Configure MongoDB connection with Vietnam timezone (UTC+7)
    await mongoose.connect(process.env.MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
      }
    });

    // Log current time to verify timezone
    const now = new Date();
    console.log(`✅ MongoDB connected with timezone: Asia/Ho_Chi_Minh`);
    console.log(`⏰ Current time: ${now.toISOString()} (${now.toString()})`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;