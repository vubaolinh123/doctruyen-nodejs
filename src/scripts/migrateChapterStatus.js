/**
 * Migration script to update chapter status from boolean to string format
 * This script converts:
 * - status: true -> status: 'published', approval_status: 'approved'
 * - status: false -> status: 'draft', approval_status: 'not_submitted'
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
  migrateChapterStatus();
})
.catch(err => {
  console.error('❌ Lỗi kết nối database:', err);
  process.exit(1);
});

// Hàm migration chính
async function migrateChapterStatus() {
  try {
    console.log('🚀 Bắt đầu migration chapter status từ boolean sang string...');

    // Đếm số lượng chapters cần migration
    const totalChapters = await Chapter.countDocuments({});

    // Try different approaches to find the chapters
    const trueStatusChapters = await Chapter.countDocuments({ status: "true" });
    const falseStatusChapters = await Chapter.countDocuments({ status: "false" });

    // Try regex approach
    const regexTrueChapters = await Chapter.countDocuments({ status: /^true$/i });
    const regexFalseChapters = await Chapter.countDocuments({ status: /^false$/i });

    // Try finding chapters that are NOT the new enum values
    const nonEnumChapters = await Chapter.countDocuments({
      status: { $nin: ['draft', 'published', 'archived'] }
    });

    const booleanStatusChapters = trueStatusChapters + falseStatusChapters;

    console.log(`📊 Tổng số chapters: ${totalChapters}`);
    console.log(`📊 Chapters có status "true": ${trueStatusChapters}`);
    console.log(`📊 Chapters có status "false": ${falseStatusChapters}`);
    console.log(`📊 Chapters có status regex true: ${regexTrueChapters}`);
    console.log(`📊 Chapters có status regex false: ${regexFalseChapters}`);
    console.log(`📊 Chapters không phải enum mới: ${nonEnumChapters}`);
    console.log(`📊 Tổng chapters cần migration: ${booleanStatusChapters}`);

    // Kiểm tra một vài chapters để xem cấu trúc dữ liệu
    const sampleChapters = await Chapter.find({}).limit(5).select('status approval_status');
    console.log('📋 Sample chapters:');
    sampleChapters.forEach((chapter, index) => {
      console.log(`   ${index + 1}. status: ${chapter.status} (type: ${typeof chapter.status}), approval_status: ${chapter.approval_status}`);
      console.log(`       Raw status value: ${JSON.stringify(chapter.status)}`);
      console.log(`       Status === true: ${chapter.status === true}`);
      console.log(`       Status === "true": ${chapter.status === "true"}`);
    });

    if (nonEnumChapters === 0) {
      console.log('✅ Không có chapters nào cần migration');
      process.exit(0);
    }

    // Migration approach: Update all chapters that don't have the new enum values
    console.log('🔄 Đang migration tất cả chapters không có enum status mới...');

    // First, let's see what status values exist
    const statusValues = await Chapter.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('📊 Các giá trị status hiện tại:');
    statusValues.forEach(item => {
      console.log(`   ${item._id}: ${item.count} chapters`);
    });

    // Migration for chapters that are not using new enum values
    // Assume old "true" values should become "published" and others become "draft"
    const publishedResult = await Chapter.updateMany(
      {
        status: { $nin: ['draft', 'published', 'archived'] },
        $or: [
          { status: { $regex: /^true$/i } },
          { status: true },
          { status: 'true' }
        ]
      },
      {
        $set: {
          status: 'published',
          approval_status: 'approved'
        }
      }
    );
    console.log(`✅ Đã migration ${publishedResult.modifiedCount} chapters thành 'published'`);

    // Migration for remaining non-enum chapters (assume they should be draft)
    const draftResult = await Chapter.updateMany(
      { status: { $nin: ['draft', 'published', 'archived'] } },
      {
        $set: {
          status: 'draft',
          approval_status: 'not_submitted'
        }
      }
    );
    console.log(`✅ Đã migration ${draftResult.modifiedCount} chapters thành 'draft'`);

    // Kiểm tra kết quả
    const remainingNonEnumChapters = await Chapter.countDocuments({
      status: { $nin: ['draft', 'published', 'archived'] }
    });

    console.log(`📊 Chapters còn lại không có enum status: ${remainingNonEnumChapters}`);

    if (remainingNonEnumChapters === 0) {
      console.log('🎉 Migration hoàn thành thành công!');
      
      // Hiển thị thống kê sau migration
      const stats = await Chapter.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      
      console.log('📊 Thống kê status sau migration:');
      stats.forEach(stat => {
        console.log(`   ${stat._id}: ${stat.count} chapters`);
      });
      
    } else {
      console.log('⚠️ Vẫn còn chapters không có enum status, cần kiểm tra lại');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi migration chapter status:', error);
    process.exit(1);
  }
}
