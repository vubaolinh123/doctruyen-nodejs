const Comment = require('../../models/Comment');
const Customer = require('../../models/Customer');

/**
 * Service xử lý các tác vụ liên quan đến bình luận
 */
class CommentService {
  /**
   * Lấy danh sách bình luận
   * @param {Object} options - Các tùy chọn
   * @param {string} options.story_id - ID truyện
   * @param {string} options.chapter_id - ID chương
   * @param {string} options.parent_id - ID bình luận cha
   * @param {number} options.page - Trang hiện tại
   * @param {number} options.limit - Số lượng trên mỗi trang
   * @returns {Object} Danh sách bình luận và thông tin phân trang
   */
  async getComments({ story_id, chapter_id, parent_id, page = 1, limit = 20 }) {
    try {
      // Xây dựng query
      const query = { status: 'active' };
      if (story_id) query.story_id = story_id;
      if (chapter_id) query.chapter_id = chapter_id;
      if (parent_id) query.parent_id = parent_id;
      else query.parent_id = null; // Chỉ lấy bình luận gốc nếu không có parent_id

      // Tính toán phân trang
      const skip = (parseInt(page) - 1) * parseInt(limit);

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
      
      return {
        comments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo bình luận mới
   * @param {string} customer_id - ID người dùng
   * @param {Object} commentData - Dữ liệu bình luận
   * @returns {Object} Bình luận đã tạo
   */
  async createComment(customer_id, commentData) {
    try {
      const { story_id, chapter_id, parent_id, content, position } = commentData;

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

      return comment;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật bình luận
   * @param {string} id - ID bình luận
   * @param {string} customer_id - ID người dùng
   * @param {string} content - Nội dung mới
   * @returns {Object} Bình luận đã cập nhật
   */
  async updateComment(id, customer_id, content) {
    try {
      // Tìm bình luận
      const comment = await Comment.findOne({
        _id: id,
        customer_id,
        status: 'active'
      });

      if (!comment) {
        throw new Error('Bình luận không tồn tại hoặc bạn không có quyền chỉnh sửa');
      }

      // Cập nhật nội dung
      comment.content = content;
      await comment.save();

      return comment;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa bình luận (soft delete)
   * @param {string} id - ID bình luận
   * @param {string} customer_id - ID người dùng
   * @returns {boolean} Kết quả xóa
   */
  async deleteComment(id, customer_id) {
    try {
      // Tìm bình luận
      const comment = await Comment.findOne({
        _id: id,
        customer_id,
        status: 'active'
      });

      if (!comment) {
        throw new Error('Bình luận không tồn tại hoặc bạn không có quyền xóa');
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

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Like/Unlike bình luận
   * @param {string} id - ID bình luận
   * @param {string} customer_id - ID người dùng
   * @returns {Object} Thông tin like
   */
  async toggleLike(id, customer_id) {
    try {
      // Tìm bình luận
      const comment = await Comment.findById(id);
      if (!comment || comment.status !== 'active') {
        throw new Error('Bình luận không tồn tại');
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

      return {
        message,
        likes: comment.likes,
        hasLiked: !hasLiked
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new CommentService(); 