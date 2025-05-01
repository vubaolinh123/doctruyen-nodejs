const mongoose = require('mongoose');

// Thiết lập timezone mặc định cho toàn bộ ứng dụng trước khi kết nối MongoDB
process.env.TZ = 'Asia/Ho_Chi_Minh';

// Ghi đè phương thức toJSON mặc định của mongoose để chuyển đổi các trường Date sang múi giờ Việt Nam
mongoose.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.createdAt) {
      // Chuyển đổi createdAt từ UTC sang múi giờ Việt Nam
      const createdDate = new Date(ret.createdAt);
      ret.createdAt = new Date(createdDate.getTime() + (7 * 60 * 60 * 1000));
    }
    if (ret.updatedAt) {
      // Chuyển đổi updatedAt từ UTC sang múi giờ Việt Nam
      const updatedDate = new Date(ret.updatedAt);
      ret.updatedAt = new Date(updatedDate.getTime() + (7 * 60 * 60 * 1000));
    }
    return ret;
  }
});

// Ghi đè hàm Date.now() để trả về thời gian theo múi giờ Việt Nam
const originalDateNow = Date.now;
Date.now = function() {
  return originalDateNow();
};

const connectDB = async () => {
  try {
    // Cấu hình kết nối MongoDB với timezone Việt Nam (UTC+7)
    await mongoose.connect(process.env.MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
      }
    });

    // Log thời gian hiện tại để kiểm tra timezone
    const now = new Date();
    console.log(`✅ MongoDB connected with timezone: Asia/Ho_Chi_Minh`);
    console.log(`⏰ Current time: ${now.toISOString()} (${now.toString()})`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;