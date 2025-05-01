/**
 * Script để kiểm tra timezone trong MongoDB
 * Chạy script này để xác nhận rằng timezone đã được thiết lập đúng
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Thiết lập timezone cho Việt Nam
process.env.TZ = 'Asia/Ho_Chi_Minh';

async function checkTimezone() {
  try {
    // Kết nối đến MongoDB
    await connectDB();
    
    // Lấy thời gian hiện tại
    const now = new Date();
    console.log('Thời gian hiện tại (local):', now.toString());
    console.log('Thời gian hiện tại (ISO):', now.toISOString());
    console.log('Thời gian hiện tại (UTC):', now.toUTCString());
    console.log('Thời gian hiện tại (Locale):', now.toLocaleString('vi-VN'));
    console.log('Timezone offset (phút):', now.getTimezoneOffset());
    console.log('Timezone offset (giờ):', -now.getTimezoneOffset() / 60);
    
    // Tạo một bản ghi tạm thời để kiểm tra
    const TestModel = mongoose.model('TestTimezone', new mongoose.Schema({
      name: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }, { timestamps: true }));
    
    // Tạo một bản ghi mới
    const testDoc = await TestModel.create({ name: 'Test Timezone' });
    console.log('\nBản ghi mới được tạo:');
    console.log('ID:', testDoc._id);
    console.log('createdAt (raw):', testDoc.createdAt);
    console.log('createdAt (ISO):', testDoc.createdAt.toISOString());
    console.log('createdAt (string):', testDoc.createdAt.toString());
    console.log('createdAt (locale):', testDoc.createdAt.toLocaleString('vi-VN'));
    
    // Lấy bản ghi từ cơ sở dữ liệu
    const fetchedDoc = await TestModel.findById(testDoc._id);
    console.log('\nBản ghi được lấy từ cơ sở dữ liệu:');
    console.log('ID:', fetchedDoc._id);
    console.log('createdAt (raw):', fetchedDoc.createdAt);
    console.log('createdAt (ISO):', fetchedDoc.createdAt.toISOString());
    console.log('createdAt (string):', fetchedDoc.createdAt.toString());
    console.log('createdAt (locale):', fetchedDoc.createdAt.toLocaleString('vi-VN'));
    
    // Chuyển đổi sang JSON để kiểm tra
    const jsonDoc = fetchedDoc.toJSON();
    console.log('\nBản ghi dưới dạng JSON:');
    console.log('createdAt:', jsonDoc.createdAt);
    
    // Xóa collection tạm thời
    await mongoose.connection.dropCollection('testtimezones');
    console.log('\nĐã xóa collection tạm thời');
    
    // Đóng kết nối
    await mongoose.connection.close();
    console.log('Đã đóng kết nối MongoDB');
  } catch (error) {
    console.error('Lỗi:', error);
  }
}

// Chạy kiểm tra
checkTimezone();
