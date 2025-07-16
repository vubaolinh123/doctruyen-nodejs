/**
 * Định nghĩa các static methods cho Author model
 * @param {Object} schema - Schema của Author model
 */
const setupStatics = (schema) => {
  /**
   * Tìm tác giả theo slug
   * @param {string} slug - Slug của tác giả
   * @returns {Promise<Object>} - Thông tin tác giả
   */
  schema.statics.findBySlug = function(slug) {
    return this.findOne({
      slug: slug,
      status: true
    });
  };

  /**
   * Lấy danh sách tác giả đang hoạt động
   * @param {number} limit - Số lượng tác giả cần lấy
   * @param {number} skip - Số lượng tác giả cần bỏ qua
   * @returns {Promise<Array>} - Danh sách tác giả
   */
  schema.statics.findActive = function(limit = 0, skip = 0) {
    const query = this.find({
      status: true
    }).sort({ name: 1 });

    if (limit > 0) {
      query.limit(limit);
    }

    if (skip > 0) {
      query.skip(skip);
    }

    return query;
  };

  /**
   * Tìm tác giả theo tên
   * @param {string} name - Tên tác giả
   * @returns {Promise<Object>} - Thông tin tác giả
   */
  schema.statics.findByName = function(name) {
    return this.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      status: true
    });
  };

  /**
   * Tìm kiếm tác giả theo từ khóa
   * @param {string} keyword - Từ khóa tìm kiếm
   * @param {number} limit - Số lượng tác giả cần lấy
   * @returns {Promise<Array>} - Danh sách tác giả
   */
  schema.statics.search = function(keyword, limit = 10) {
    return this.find({
      name: { $regex: keyword, $options: 'i' },
      status: true
    })
      .sort({ name: 1 })
      .limit(limit);
  };

  /**
   * Tìm tác giả theo userId (chỉ áp dụng cho system author)
   * @param {string} userId - ID của user
   * @returns {Promise<Object|null>} - Thông tin tác giả hoặc null
   */
  schema.statics.findByUserId = function(userId) {
    return this.findOne({
      userId: userId,
      authorType: 'system',
      status: true
    });
  };

  /**
   * Lấy danh sách system authors
   * @param {number} limit - Số lượng tác giả cần lấy
   * @param {number} skip - Số lượng tác giả cần bỏ qua
   * @returns {Promise<Array>} - Danh sách system authors
   */
  schema.statics.findSystemAuthors = function(limit = 0, skip = 0) {
    const query = this.find({
      authorType: 'system',
      status: true
    }).sort({ createdAt: -1 });

    if (limit > 0) {
      query.limit(limit);
    }

    if (skip > 0) {
      query.skip(skip);
    }

    return query;
  };

  /**
   * Lấy danh sách external authors
   * @param {number} limit - Số lượng tác giả cần lấy
   * @param {number} skip - Số lượng tác giả cần bỏ qua
   * @returns {Promise<Array>} - Danh sách external authors
   */
  schema.statics.findExternalAuthors = function(limit = 0, skip = 0) {
    const query = this.find({
      authorType: 'external',
      status: true
    }).sort({ name: 1 });

    if (limit > 0) {
      query.limit(limit);
    }

    if (skip > 0) {
      query.skip(skip);
    }

    return query;
  };

  /**
   * Kiểm tra xem user đã có author record chưa
   * @param {string} userId - ID của user
   * @returns {Promise<boolean>} - true nếu user đã có author record
   */
  schema.statics.userHasAuthorRecord = async function(userId) {
    const author = await this.findOne({
      userId: userId,
      authorType: 'system'
    });
    return !!author;
  };
};

module.exports = setupStatics;
