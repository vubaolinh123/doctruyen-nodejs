/**
 * Định nghĩa các instance methods cho UserLevel model
 * @param {Object} schema - Schema của UserLevel model
 */
const setupMethods = (schema) => {
  /**
   * Kiểm tra xem người dùng có đặc quyền không
   * @param {string} type - Loại đặc quyền
   * @param {*} value - Giá trị đặc quyền
   * @returns {boolean} - true nếu có đặc quyền, false nếu không
   */
  schema.methods.hasPrivilege = function(type, value) {
    return this.unlocked_privileges.some(p => 
      p.type === type && p.value === value && p.active
    );
  };

  /**
   * Lấy danh sách đặc quyền đã mở khóa
   * @param {string} type - Loại đặc quyền (không bắt buộc)
   * @returns {Array} - Danh sách đặc quyền
   */
  schema.methods.getUnlockedPrivileges = function(type = null) {
    if (type) {
      return this.unlocked_privileges.filter(p => p.type === type);
    }
    
    return this.unlocked_privileges;
  };

  /**
   * Lấy danh sách đặc quyền đang kích hoạt
   * @param {string} type - Loại đặc quyền (không bắt buộc)
   * @returns {Array} - Danh sách đặc quyền
   */
  schema.methods.getActivePrivileges = function(type = null) {
    if (type) {
      return this.unlocked_privileges.filter(p => p.type === type && p.active);
    }
    
    return this.unlocked_privileges.filter(p => p.active);
  };

  /**
   * Kích hoạt đặc quyền
   * @param {string} type - Loại đặc quyền
   * @param {*} value - Giá trị đặc quyền
   * @returns {boolean} - true nếu kích hoạt thành công, false nếu không
   */
  schema.methods.activatePrivilege = function(type, value) {
    const privilege = this.unlocked_privileges.find(p => 
      p.type === type && p.value === value
    );
    
    if (!privilege) {
      return false;
    }
    
    // Vô hiệu hóa các đặc quyền cùng loại khác
    this.unlocked_privileges.forEach(p => {
      if (p.type === type) {
        p.active = false;
      }
    });
    
    // Kích hoạt đặc quyền mới
    privilege.active = true;
    
    return true;
  };

  /**
   * Lấy kinh nghiệm cần thiết để lên cấp tiếp theo
   * @returns {number} - Kinh nghiệm cần thiết
   */
  schema.methods.getExpToNextLevel = function() {
    return this.next_level_exp - this.experience;
  };

  /**
   * Lấy thông tin cấp độ dưới dạng đối tượng đơn giản
   * @returns {Object} - Thông tin cấp độ
   */
  schema.methods.toSimpleObject = function() {
    return {
      level: this.level,
      experience: this.experience,
      next_level_exp: this.next_level_exp,
      exp_percentage: this.exp_percentage,
      exp_to_next_level: this.getExpToNextLevel(),
      total_experience: this.total_experience,
      active_privileges: this.getActivePrivileges()
    };
  };
};

module.exports = setupMethods;
