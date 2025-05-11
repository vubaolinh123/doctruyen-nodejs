const slugify = require('slugify');

/**
 * Định nghĩa các static methods cho User model
 * @param {Object} schema - Schema của User model
 */
const setupStatics = (schema) => {
  /**
   * Tìm người dùng theo slug
   * @param {string} slug - Slug của người dùng
   * @returns {Object} Thông tin người dùng
   */
  schema.statics.findBySlug = async function(slug) {
    return this.findOne({ slug });
  };

  /**
   * Tạo slug duy nhất từ tên người dùng
   * @param {string} name - Tên người dùng
   * @returns {string} Slug duy nhất
   */
  schema.statics.generateUniqueSlug = async function(name) {
    const generateSlug = (name, suffix = '') => {
      const baseSlug = slugify(name, {
        lower: true,      // Chuyển sang chữ thường
        strict: true,     // Loại bỏ ký tự đặc biệt
        locale: 'vi'      // Hỗ trợ tiếng Việt
      });
      
      return suffix ? `${baseSlug}-${suffix}` : baseSlug;
    };
    
    // Thử slug ban đầu
    let slug = generateSlug(name);
    
    // Kiểm tra xem slug đã tồn tại chưa
    let existingUser = await this.findOne({ slug });
    
    // Nếu slug đã tồn tại, thêm hậu tố số
    let counter = 1;
    while (existingUser) {
      slug = generateSlug(name, counter);
      existingUser = await this.findOne({ slug });
      counter++;
    }
    
    return slug;
  };

  /**
   * Tạo và lưu người dùng mới
   * @param {Object} userData - Thông tin người dùng
   * @returns {Object} Người dùng đã tạo
   */
  schema.statics.createUser = async function(userData) {
    // Tạo slug từ tên người dùng
    if (!userData.slug && userData.name) {
      userData.slug = await this.generateUniqueSlug(userData.name);
    }
    
    // Tạo người dùng mới
    const user = new this(userData);
    await user.save();
    
    return user;
  };

  /**
   * Tìm người dùng đang hoạt động theo vai trò
   * @param {string} role - Vai trò người dùng
   * @param {Object} options - Các tùy chọn
   * @returns {Array} Danh sách người dùng
   */
  schema.statics.findActiveByRole = async function(role, options = {}) {
    const { limit = 10, skip = 0, sort = '-createdAt' } = options;
    
    return this.find({
      role,
      status: 'active'
    })
      .sort(sort)
      .skip(skip)
      .limit(limit);
  };
};

module.exports = setupStatics; 