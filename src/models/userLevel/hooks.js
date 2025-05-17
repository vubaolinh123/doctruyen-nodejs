/**
 * Định nghĩa các hooks cho UserLevel model
 * @param {Object} schema - Schema của UserLevel model
 */
const setupHooks = (schema) => {
  /**
   * Pre-save hook
   * Thực hiện trước khi lưu document
   */
  schema.pre('save', function(next) {
    // Đảm bảo rằng experience không âm
    if (this.experience < 0) {
      this.experience = 0;
    }
    
    // Đảm bảo rằng level không nhỏ hơn 1
    if (this.level < 1) {
      this.level = 1;
    }
    
    // Đảm bảo rằng next_level_exp không âm
    if (this.next_level_exp < 0) {
      this.next_level_exp = 100;
    }
    
    // Đảm bảo rằng total_experience không âm
    if (this.total_experience < 0) {
      this.total_experience = 0;
    }
    
    // Đảm bảo rằng highest_level không nhỏ hơn level
    if (this.stats.highest_level < this.level) {
      this.stats.highest_level = this.level;
    }
    
    next();
  });
};

module.exports = setupHooks;
