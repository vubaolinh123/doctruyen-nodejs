const mongoose = require('mongoose');

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

    // MongoDB connected successfully
    console.log('\x1b[32m%s\x1b[0m', '✓ Kết nối MongoDB thành công!');
    console.log('\x1b[36m%s\x1b[0m', `✓ MongoDB URL: ${process.env.MONGODB_URI}`);
    return true;
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', '✗ Kết nối MongoDB thất bại!');
    console.error('\x1b[31m%s\x1b[0m', `✗ Lỗi: ${err.message}`);
    return false;
  }
};

module.exports = connectDB;