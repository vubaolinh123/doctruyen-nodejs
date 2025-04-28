const Comment = require('../models/Comment');
const Customer = require('../models/Customer');
const { validationResult } = require('express-validator');

// Lấy danh sách bình luận
exports.getComments = async (req, res) => {
  try {
    const { story_id, chapter_id, parent_id, page = 1, limit = 20 } = req.query;
    
    // Xây dựng query
    const query = { status: 'active' };
    if (story_id) query.story_id = story_id;
    if (chapter_id) query.chapter_id = chapter_id;
    if (parent_id) query.parent_id = parent_id;
    else query.parent_id = null; // Chỉ lấy bình luận gốc nếu không có parent_id

    // Tính toán phân trang
    const skip = (page - 1) * limit;

    // Lấy bình luận và populate thông tin người dùng
    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customer_id', 'name avatar')
      .populate('replies', 'content customer_id createdAt')
      .populate('replies.customer_id', 'name avatar');

    // Đếm tổng số bình luận
    const total = await Comment.countDocuments(query);

    res.json({
      success: true,
      data: comments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách bình luận'
    });
  }
};

// Tạo bình luận mới
exports.createComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { story_id, chapter_id, parent_id, content, position } = req.body;
    const customer_id = req.user._id;

    // Tạo bình luận mới
    const comment = new Comment({
      customer_id,
      story_id,
      chapter_id,
      parent_id,
      content,
      metadata: {
        type: chapter_id ? 'chapter' : 'story',
        position: position || null
      }
    });

    await comment.save();

    // Cập nhật số lượng bình luận của người dùng
    await Customer.findByIdAndUpdate(customer_id, {
      $inc: { 'metadata.comment_count': 1 }
    });

    // Nếu là reply, cập nhật số lượng reply của bình luận gốc
    if (parent_id) {
      await Comment.findByIdAndUpdate(parent_id, {
        $inc: { reply_count: 1 }
      });
    }

    // Populate thông tin người dùng
    await comment.populate('customer_id', 'name avatar');

    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo bình luận'
    });
  }
};

// Cập nhật bình luận
exports.updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const customer_id = req.user._id;

    // Tìm bình luận
    const comment = await Comment.findOne({
      _id: id,
      customer_id,
      status: 'active'
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Bình luận không tồn tại hoặc bạn không có quyền chỉnh sửa'
      });
    }

    // Cập nhật nội dung
    comment.content = content;
    await comment.save();

    res.json({
      success: true,
      data: comment
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật bình luận'
    });
  }
};

// Xóa bình luận (soft delete)
exports.deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const customer_id = req.user._id;

    // Tìm bình luận
    const comment = await Comment.findOne({
      _id: id,
      customer_id,
      status: 'active'
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Bình luận không tồn tại hoặc bạn không có quyền xóa'
      });
    }

    // Soft delete
    comment.status = 'deleted';
    await comment.save();

    // Cập nhật số lượng bình luận của người dùng
    await Customer.findByIdAndUpdate(customer_id, {
      $inc: { 'metadata.comment_count': -1 }
    });

    // Nếu là reply, cập nhật số lượng reply của bình luận gốc
    if (comment.parent_id) {
      await Comment.findByIdAndUpdate(comment.parent_id, {
        $inc: { reply_count: -1 }
      });
    }

    res.json({
      success: true,
      message: 'Xóa bình luận thành công'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa bình luận'
    });
  }
};

// Like/Unlike bình luận
exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const customer_id = req.user._id;

    // Tìm bình luận
    const comment = await Comment.findById(id);
    if (!comment || comment.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Bình luận không tồn tại'
      });
    }

    // Kiểm tra đã like chưa
    const hasLiked = comment.liked_by.includes(customer_id);
    let message = '';

    if (hasLiked) {
      // Unlike
      await comment.removeLike(customer_id);
      await Customer.findByIdAndUpdate(customer_id, {
        $inc: { 'metadata.liked_comments_count': -1 }
      });
      message = 'Bỏ thích bình luận thành công';
    } else {
      // Like
      await comment.addLike(customer_id);
      await Customer.findByIdAndUpdate(customer_id, {
        $inc: { 'metadata.liked_comments_count': 1 }
      });
      message = 'Thích bình luận thành công';
    }

    res.json({
      success: true,
      message,
      data: {
        likes: comment.likes,
        hasLiked: !hasLiked
      }
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi thích/bỏ thích bình luận'
    });
  }
}; 