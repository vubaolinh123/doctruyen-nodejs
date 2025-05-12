/**
 * Script để cập nhật lại số lượng chapter cho tất cả các truyện
 * Chạy script này sau khi thêm trường chapter_count vào model Story
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Story = require('../models/story');
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
  updateChapterCounts();
})
.catch(err => {
  console.error('❌ Lỗi kết nối database:', err);
  process.exit(1);
});

// Hàm cập nhật số lượng chapter cho tất cả các truyện
async function updateChapterCounts() {
  try {
    console.log('Bắt đầu cập nhật số lượng chapter...');

    // Lấy tất cả các truyện
    const stories = await Story.find({});
    console.log(`Tìm thấy ${stories.length} truyện cần cập nhật`);

    // Sử dụng aggregation để đếm số lượng chapter cho mỗi truyện
    const chapterCounts = await Chapter.aggregate([
      { $group: { _id: "$story_id", count: { $sum: 1 } } }
    ]);

    // Chuyển đổi kết quả thành object để dễ truy cập
    const countMap = {};
    chapterCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });

    // Cập nhật số lượng chapter cho từng truyện
    let updatedCount = 0;
    for (const story of stories) {
      const storyId = story._id.toString();
      const count = countMap[storyId] || 0;

      // Cập nhật trường chapter_count
      await Story.findByIdAndUpdate(storyId, { chapter_count: count });
      updatedCount++;

      // Log tiến trình
      if (updatedCount % 100 === 0 || updatedCount === stories.length) {
        console.log(`Đã cập nhật ${updatedCount}/${stories.length} truyện`);
      }
    }

    console.log('Hoàn thành cập nhật số lượng chapter!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi cập nhật số lượng chapter:', error);
    process.exit(1);
  }
}
