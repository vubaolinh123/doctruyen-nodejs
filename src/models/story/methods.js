/**
 * Định nghĩa các instance methods cho Story model
 * @param {Object} schema - Schema của Story model
 */
const setupMethods = (schema) => {
  /**
   * Cập nhật số lượng chapter
   * @param {number} delta - Số lượng thay đổi (1 hoặc -1)
   * @returns {Promise<Object>} - Truyện đã cập nhật
   */
  schema.methods.updateChapterCount = async function(delta = 1) {
    this.chapter_count += delta;
    
    // Đảm bảo chapter_count không âm
    if (this.chapter_count < 0) {
      this.chapter_count = 0;
    }
    
    return this.save();
  };

  /**
   * Cập nhật lượt xem
   * @param {number} increment - Số lượng tăng (mặc định là 1)
   * @returns {Promise<Object>} - Truyện đã cập nhật
   */
  schema.methods.incrementViews = async function(increment = 1) {
    this.views += increment;
    return this.save();
  };

  /**
   * Cập nhật đánh giá
   * @param {number} rating - Đánh giá mới (1-10)
   * @returns {Promise<Object>} - Truyện đã cập nhật
   */
  schema.methods.addRating = async function(rating) {
    // Đảm bảo rating hợp lệ
    if (rating < 1 || rating > 10) {
      throw new Error('Đánh giá phải từ 1 đến 10');
    }
    
    // Tính toán đánh giá mới
    const totalStars = (this.stars * this.count_star) + rating;
    this.count_star += 1;
    this.stars = totalStars / this.count_star;
    
    return this.save();
  };
};

module.exports = setupMethods;
