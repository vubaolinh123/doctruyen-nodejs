/**
 * Corrective migration script to convert chapters that should be published
 * This script converts chapters that were previously "true" (active) to "published" status
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Chapter = require('../models/chapter');

// Thiết lập timezone cho Việt Nam
process.env.TZ = 'Asia/Ho_Chi_Minh';
console.log(`⏰ Timezone set to: ${process.env.TZ} (${new Date().toString()})`);

// Kết nối đến database
mongoose.connect(process.env.MONGODB_URI, {
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true
  }
})
.then(() => {
  console.log('✅ Đã kết nối đến database');
  fixChapterStatusToPublished();
})
.catch(err => {
  console.error('❌ Lỗi kết nối database:', err);
  process.exit(1);
});

// Hàm sửa lại status cho chapters
async function fixChapterStatusToPublished() {
  try {
    console.log('🔧 Bắt đầu sửa lại chapter status thành published...');

    // Đếm số lượng chapters hiện tại
    const totalChapters = await Chapter.countDocuments({});
    const draftChapters = await Chapter.countDocuments({ status: 'draft' });
    const publishedChapters = await Chapter.countDocuments({ status: 'published' });

    console.log(`📊 Tổng số chapters: ${totalChapters}`);
    console.log(`📊 Chapters draft: ${draftChapters}`);
    console.log(`📊 Chapters published: ${publishedChapters}`);

    // Convert chapters that should be published
    // Criteria: chapters that have approval_status 'not_submitted' and are currently 'draft'
    // These were likely the old "true" status chapters that should be visible
    console.log('🔄 Đang chuyển chapters draft thành published...');
    
    const result = await Chapter.updateMany(
      { 
        status: 'draft',
        approval_status: 'not_submitted'
      },
      {
        $set: {
          status: 'published',
          approval_status: 'approved'
        }
      }
    );
    
    console.log(`✅ Đã chuyển ${result.modifiedCount} chapters từ draft thành published`);

    // Kiểm tra kết quả
    const newDraftChapters = await Chapter.countDocuments({ status: 'draft' });
    const newPublishedChapters = await Chapter.countDocuments({ status: 'published' });

    console.log('📊 Thống kê sau khi sửa:');
    console.log(`   Draft: ${newDraftChapters} chapters`);
    console.log(`   Published: ${newPublishedChapters} chapters`);

    console.log('🎉 Hoàn thành sửa lại chapter status!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi sửa chapter status:', error);
    process.exit(1);
  }
}
