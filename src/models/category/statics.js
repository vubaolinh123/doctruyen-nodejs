/**
 * Định nghĩa các static methods cho Category model
 * @param {Object} schema - Schema của Category model
 */
const setupStatics = (schema) => {
  /**
   * Tìm thể loại theo slug
   * @param {string} slug - Slug của thể loại
   * @returns {Promise<Object>} - Thông tin thể loại
   */
  schema.statics.findBySlug = function(slug) {
    return this.findOne({
      slug: slug,
      status: true
    });
  };

  /**
   * Lấy danh sách thể loại đang hoạt động
   * @param {number} limit - Số lượng thể loại cần lấy
   * @param {number} skip - Số lượng thể loại cần bỏ qua
   * @returns {Promise<Array>} - Danh sách thể loại
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
   * Tìm thể loại theo tên
   * @param {string} name - Tên thể loại
   * @returns {Promise<Object>} - Thông tin thể loại
   */
  schema.statics.findByName = function(name) {
    return this.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      status: true
    });
  };

  /**
   * Tìm kiếm thể loại theo từ khóa
   * @param {string} keyword - Từ khóa tìm kiếm
   * @param {number} limit - Số lượng thể loại cần lấy
   * @returns {Promise<Array>} - Danh sách thể loại
   */
  schema.statics.search = function(keyword, limit = 10) {
    return this.find({
      name: { $regex: keyword, $options: 'i' },
      status: true
    })
      .sort({ name: 1 })
      .limit(limit);
  };
};

module.exports = setupStatics;
