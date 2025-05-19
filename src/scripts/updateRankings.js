/**
 * Script để cập nhật dữ liệu xếp hạng
 * 
 * Cách sử dụng:
 * node src/scripts/updateRankings.js
 */

// Import các module cần thiết
const mongoose = require('mongoose');
const config = require('../config');
const rankingService = require('../services/ranking/rankingService');
const Story = require('../models/story');
const StoryRankings = require('../models/storyRankings');
const moment = require('moment');

// Kết nối đến MongoDB
mongoose.connect(config.mongodb.uri, config.mongodb.options)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });

// Hàm kiểm tra dữ liệu xếp hạng
async function checkRankingData() {
  try {
    // Kiểm tra số lượng truyện
    const storyCount = await Story.countDocuments();
    console.log(`Total stories in database: ${storyCount}`);

    // Kiểm tra số lượng xếp hạng theo ngày
    const today = moment().startOf('day').toDate();
    const dailyRankingsCount = await StoryRankings.countDocuments({
      date: {
        $gte: moment(today).startOf('day').toDate(),
        $lte: moment(today).endOf('day').toDate()
      }
    });
    console.log(`Daily rankings count: ${dailyRankingsCount}`);

    // Kiểm tra số lượng xếp hạng theo tuần
    const weeklyRankingsCount = await StoryRankings.countDocuments({
      date: {
        $gte: moment(today).startOf('day').toDate(),
        $lte: moment(today).endOf('day').toDate()
      },
      weekly_score: { $exists: true }
    });
    console.log(`Weekly rankings count: ${weeklyRankingsCount}`);

    // Kiểm tra số lượng xếp hạng theo tháng
    const monthlyRankingsCount = await StoryRankings.countDocuments({
      date: {
        $gte: moment(today).startOf('day').toDate(),
        $lte: moment(today).endOf('day').toDate()
      },
      monthly_score: { $exists: true }
    });
    console.log(`Monthly rankings count: ${monthlyRankingsCount}`);

    // Kiểm tra số lượng xếp hạng toàn thời gian
    const allTimeRankingsCount = await StoryRankings.countDocuments({
      date: {
        $gte: moment(today).startOf('day').toDate(),
        $lte: moment(today).endOf('day').toDate()
      },
      all_time_score: { $exists: true }
    });
    console.log(`All-time rankings count: ${allTimeRankingsCount}`);

    return {
      storyCount,
      dailyRankingsCount,
      weeklyRankingsCount,
      monthlyRankingsCount,
      allTimeRankingsCount
    };
  } catch (error) {
    console.error('Error checking ranking data:', error);
    throw error;
  }
}

// Hàm cập nhật dữ liệu xếp hạng
async function updateAllRankings() {
  try {
    console.log('Updating daily rankings...');
    const dailyCount = await rankingService.updateDailyRankings();
    console.log(`Updated daily rankings for ${dailyCount} stories`);

    console.log('Updating weekly rankings...');
    const weeklyCount = await rankingService.updateWeeklyRankings();
    console.log(`Updated weekly rankings for ${weeklyCount} stories`);

    console.log('Updating monthly rankings...');
    const monthlyCount = await rankingService.updateMonthlyRankings();
    console.log(`Updated monthly rankings for ${monthlyCount} stories`);

    console.log('Updating all-time rankings...');
    const allTimeCount = await rankingService.updateAllTimeRankings();
    console.log(`Updated all-time rankings for ${allTimeCount} stories`);

    return {
      dailyCount,
      weeklyCount,
      monthlyCount,
      allTimeCount
    };
  } catch (error) {
    console.error('Error updating rankings:', error);
    throw error;
  }
}

// Hàm chính
async function main() {
  try {
    console.log('Checking ranking data...');
    const beforeCounts = await checkRankingData();

    if (beforeCounts.dailyRankingsCount === 0 || 
        beforeCounts.weeklyRankingsCount === 0 || 
        beforeCounts.monthlyRankingsCount === 0 || 
        beforeCounts.allTimeRankingsCount === 0) {
      console.log('Some ranking data is missing. Updating all rankings...');
      await updateAllRankings();
    } else {
      console.log('All ranking data exists. Do you want to update anyway? (y/n)');
      process.stdin.once('data', async (data) => {
        const answer = data.toString().trim().toLowerCase();
        if (answer === 'y' || answer === 'yes') {
          await updateAllRankings();
        } else {
          console.log('Update cancelled.');
        }
        
        // Kiểm tra lại sau khi cập nhật
        console.log('Checking ranking data after update...');
        await checkRankingData();
        
        // Đóng kết nối và thoát
        mongoose.connection.close();
        process.exit(0);
      });
      return; // Đợi input từ người dùng
    }

    // Kiểm tra lại sau khi cập nhật
    console.log('Checking ranking data after update...');
    await checkRankingData();
    
    // Đóng kết nối và thoát
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error in main function:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

// Chạy hàm chính
main();
