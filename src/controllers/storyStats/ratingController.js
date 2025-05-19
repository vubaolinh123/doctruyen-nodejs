const StoryStats = require('../../models/storyStats');
const UserRating = require('../../models/userRating');
const mongoose = require('mongoose');
const moment = require('moment');

/**
 * Lấy đánh giá của người dùng cho truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
exports.getUserRating = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    console.log(`[API] Lấy đánh giá của người dùng - story_id: ${storyId}, user_id: ${userId}`);

    // Kiểm tra dữ liệu đầu vào
    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu ID truyện'
      });
    }

    // Chuyển đổi storyId và userId thành ObjectId
    const storyObjectId = new mongoose.Types.ObjectId(storyId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    console.log(`[API] Tìm UserRating với user_id: ${userObjectId}, story_id: ${storyObjectId}`);

    // Kiểm tra xem có bản ghi UserRating nào trong database không
    const totalRatings = await UserRating.countDocuments();
    console.log(`[API] Tổng số bản ghi UserRating trong database: ${totalRatings}`);

    // Tìm đánh giá của người dùng
    const userRating = await UserRating.findOne({
      user_id: userObjectId,
      story_id: storyObjectId
    });

    console.log(`[API] Kết quả tìm UserRating: ${userRating ? 'Tìm thấy' : 'Không tìm thấy'}`);

    if (userRating) {
      console.log(`[API] Chi tiết UserRating: ${JSON.stringify(userRating)}`);
    } else {
      // Kiểm tra xem có bản ghi UserRating nào cho user_id này không
      const userRatings = await UserRating.find({ user_id: userObjectId });
      console.log(`[API] Số lượng đánh giá của user ${userId}: ${userRatings.length}`);

      // Kiểm tra xem có bản ghi UserRating nào cho story_id này không
      const storyRatings = await UserRating.find({ story_id: storyObjectId });
      console.log(`[API] Số lượng đánh giá cho truyện ${storyId}: ${storyRatings.length}`);
    }

    // Lấy thống kê đánh giá của truyện
    const stats = await StoryStats.aggregate([
      { $match: { story_id: storyObjectId } },
      {
        $group: {
          _id: null,
          ratingsCount: { $sum: '$ratings_count' },
          ratingsSum: { $sum: '$ratings_sum' }
        }
      }
    ]);

    // Tính toán đánh giá trung bình
    let averageRating = 0;
    let ratingsCount = 0;
    let ratingsSum = 0;

    if (stats && stats.length > 0) {
      ratingsCount = stats[0].ratingsCount;
      ratingsSum = stats[0].ratingsSum;
      averageRating = ratingsCount > 0 ? ratingsSum / ratingsCount : 0;
    }

    // Trả về kết quả
    return res.status(200).json({
      success: true,
      message: userRating ? 'Lấy đánh giá thành công' : 'Người dùng chưa đánh giá truyện này',
      data: {
        user_rating: userRating ? userRating.rating : null,
        average_rating: averageRating,
        ratings_count: ratingsCount,
        ratings_sum: ratingsSum
      }
    });
  } catch (error) {
    console.error('[API] Error getting user rating:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

/**
 * Đánh giá truyện
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
exports.rateStory = async (req, res) => {
  try {
    const { story_id, rating } = req.body;
    const userId = req.user.id;

    console.log(`[API] Đánh giá truyện - story_id: ${story_id}, rating: ${rating}, user_id: ${userId}`);

    // Kiểm tra dữ liệu đầu vào
    if (!story_id || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin đánh giá'
      });
    }

    // Kiểm tra rating có hợp lệ không (1-10)
    if (rating < 1 || rating > 10 || !Number.isInteger(rating)) {
      return res.status(400).json({
        success: false,
        message: 'Đánh giá phải là số nguyên từ 1 đến 10'
      });
    }

    // Kiểm tra xem người dùng đã đánh giá truyện này chưa
    try {
      console.log(`[API] Bắt đầu kiểm tra và cập nhật đánh giá - story_id: ${story_id}, rating: ${rating}, user_id: ${userId}`);

      // Chuyển đổi story_id và user_id thành ObjectId
      const storyObjectId = new mongoose.Types.ObjectId(story_id);
      const userObjectId = new mongoose.Types.ObjectId(userId);

      // Tìm đánh giá hiện có của người dùng
      const existingRating = await UserRating.findOne({
        user_id: userObjectId,
        story_id: storyObjectId
      });

      console.log(`[API] Kết quả tìm UserRating: ${existingRating ? 'Đã tồn tại' : 'Chưa tồn tại'}`);

      // Biến để lưu trữ đánh giá cũ (nếu có)
      let oldRating = 0;
      let isNewRating = true;

      // Xử lý UserRating
      if (existingRating) {
        // Người dùng đã đánh giá trước đó, cập nhật đánh giá
        oldRating = existingRating.rating;
        isNewRating = false;

        console.log(`[API] Cập nhật đánh giá hiện có - oldRating: ${oldRating}, newRating: ${rating}`);

        // Cập nhật đánh giá
        existingRating.rating = rating;
        await existingRating.save();
      } else {
        // Người dùng chưa đánh giá, tạo đánh giá mới
        console.log(`[API] Tạo đánh giá mới - rating: ${rating}`);

        const newRating = new UserRating({
          user_id: userObjectId,
          story_id: storyObjectId,
          rating: rating
        });

        const savedRating = await newRating.save();
        console.log(`[API] Đã lưu đánh giá mới - _id: ${savedRating._id}`);

        // Kiểm tra xem đã lưu thành công chưa
        const checkRating = await UserRating.findById(savedRating._id);
        if (checkRating) {
          console.log(`[API] Kiểm tra đánh giá mới - Tìm thấy: ${JSON.stringify(checkRating)}`);
        } else {
          console.error(`[API] Kiểm tra đánh giá mới - Không tìm thấy!`);
        }
      }

      // Cập nhật StoryStats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Lấy thông tin ngày, tháng, năm, tuần
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      const week = moment(today).isoWeek();

      console.log(`[API] Thông tin ngày: ${today.toISOString()}, year: ${year}, month: ${month}, day: ${day}, week: ${week}`);

      // Tìm hoặc tạo bản ghi thống kê cho ngày hôm nay
      let stats = await StoryStats.findOne({
        story_id: storyObjectId,
        date: today
      });

      console.log(`[API] Kết quả tìm StoryStats: ${stats ? 'Tìm thấy' : 'Không tìm thấy'}`);

      if (!stats) {
        // Tạo bản ghi mới nếu chưa có
        console.log(`[API] Tạo bản ghi StoryStats mới cho story_id: ${story_id}`);
        stats = new StoryStats({
          story_id: storyObjectId,
          date: today,
          views: 0,
          unique_views: 0,
          ratings_count: 1, // Đánh giá đầu tiên
          ratings_sum: rating,
          comments_count: 0,
          bookmarks_count: 0,
          shares_count: 0,
          day,
          month,
          year,
          week
        });
      } else {
        // Cập nhật bản ghi hiện có
        console.log(`[API] Cập nhật bản ghi StoryStats hiện có - ratings_count: ${stats.ratings_count}, ratings_sum: ${stats.ratings_sum}`);

        if (isNewRating) {
          // Nếu là đánh giá mới, tăng số lượng đánh giá và tổng điểm đánh giá
          stats.ratings_count += 1;
          stats.ratings_sum += rating;
          console.log(`[API] Đánh giá mới - ratings_count mới: ${stats.ratings_count}, ratings_sum mới: ${stats.ratings_sum}`);
        } else {
          // Nếu là cập nhật đánh giá, chỉ cập nhật tổng điểm đánh giá
          // Trừ đi điểm cũ và cộng điểm mới
          const oldSum = stats.ratings_sum;
          stats.ratings_sum = stats.ratings_sum - oldRating + rating;
          console.log(`[API] Cập nhật đánh giá - ratings_sum cũ: ${oldSum}, ratings_sum mới: ${stats.ratings_sum}`);
        }
      }

      console.log(`[API] Lưu StoryStats - story_id: ${story_id}, ratings_count: ${stats.ratings_count}, ratings_sum: ${stats.ratings_sum}`);
      const savedStats = await stats.save();
      console.log(`[API] Đã lưu StoryStats - _id: ${savedStats._id}`);

      // Kiểm tra xem đã lưu thành công chưa
      const updatedStats = await StoryStats.findOne({
        story_id: storyObjectId,
        date: today
      });

      if (updatedStats) {
        console.log(`[API] StoryStats sau khi cập nhật - _id: ${updatedStats._id}, ratings_count: ${updatedStats.ratings_count}, ratings_sum: ${updatedStats.ratings_sum}`);
      } else {
        console.error(`[API] Không tìm thấy StoryStats sau khi cập nhật - story_id: ${story_id}`);
      }

      // Trả về kết quả
      return res.status(200).json({
        success: true,
        message: isNewRating ? 'Đánh giá thành công' : 'Cập nhật đánh giá thành công',
        data: {
          story_id,
          rating,
          user_id: userId,
          is_new_rating: isNewRating
        }
      });
    } catch (statsError) {
      console.error('[API] Error updating StoryStats for rating:', statsError);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật đánh giá',
        error: statsError.message
      });
    }
  } catch (error) {
    console.error('[API] Error rating story:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};
