const mongoose = require('mongoose');

/**
 * Định nghĩa các static methods cho UserLevel model
 * @param {Object} schema - Schema của UserLevel model
 */
const setupStatics = (schema) => {
  /**
   * Tính toán kinh nghiệm cần thiết cho một cấp độ
   * @param {number} level - Cấp độ cần tính
   * @returns {number} - Kinh nghiệm cần thiết
   */
  schema.statics.calculateExpForLevel = function(level) {
    // Công thức tính kinh nghiệm: 100 * (level ^ 1.5)
    return Math.floor(100 * Math.pow(level, 1.5));
  };

  /**
   * Lấy danh sách đặc quyền theo cấp độ
   * @param {number} level - Cấp độ cần lấy đặc quyền
   * @returns {Array} - Danh sách đặc quyền
   */
  schema.statics.getPrivilegesByLevel = function(level) {
    // Danh sách đặc quyền theo cấp độ
    const privileges = [
      // Cấp 1
      {
        level: 1,
        privileges: [
          { type: 'feature', value: 'bookmark', description: 'Đánh dấu truyện yêu thích' }
        ]
      },
      // Cấp 5
      {
        level: 5,
        privileges: [
          { type: 'nameColor', value: '#3498db', description: 'Màu tên xanh dương' }
        ]
      },
      // Cấp 10
      {
        level: 10,
        privileges: [
          { type: 'feature', value: 'comment_edit', description: 'Chỉnh sửa bình luận' },
          { type: 'nameColor', value: '#2ecc71', description: 'Màu tên xanh lá' }
        ]
      },
      // Cấp 15
      {
        level: 15,
        privileges: [
          { type: 'badge', value: 'reader', description: 'Huy hiệu Độc Giả' }
        ]
      },
      // Cấp 20
      {
        level: 20,
        privileges: [
          { type: 'nameColor', value: '#e74c3c', description: 'Màu tên đỏ' },
          { type: 'chatColor', value: '#3498db', description: 'Màu chat xanh dương' }
        ]
      },
      // Cấp 30
      {
        level: 30,
        privileges: [
          { type: 'badge', value: 'bookworm', description: 'Huy hiệu Mọt Sách' },
          { type: 'frame', value: 'gold', description: 'Khung hồ sơ vàng' }
        ]
      },
      // Cấp 50
      {
        level: 50,
        privileges: [
          { type: 'badge', value: 'master', description: 'Huy hiệu Bậc Thầy' },
          { type: 'nameColor', value: '#9b59b6', description: 'Màu tên tím' },
          { type: 'chatColor', value: '#9b59b6', description: 'Màu chat tím' }
        ]
      },
      // Cấp 100
      {
        level: 100,
        privileges: [
          { type: 'badge', value: 'legend', description: 'Huy hiệu Huyền Thoại' },
          { type: 'frame', value: 'diamond', description: 'Khung hồ sơ kim cương' },
          { type: 'nameColor', value: '#f1c40f', description: 'Màu tên vàng' },
          { type: 'chatColor', value: '#f1c40f', description: 'Màu chat vàng' }
        ]
      }
    ];
    
    // Lọc ra các đặc quyền có cấp độ <= level
    const availablePrivileges = [];
    privileges.forEach(p => {
      if (p.level <= level) {
        availablePrivileges.push(...p.privileges);
      }
    });
    
    return availablePrivileges;
  };

  /**
   * Lấy thông tin cấp độ của người dùng
   * @param {string} userId - ID của người dùng
   * @returns {Promise<Object>} - Thông tin cấp độ
   */
  schema.statics.getUserLevel = async function(userId) {
    let userLevel = await this.findOne({ user_id: userId });
    
    if (!userLevel) {
      // Tạo mới nếu chưa có
      userLevel = new this({
        user_id: userId,
        level: 1,
        experience: 0,
        next_level_exp: this.calculateExpForLevel(2),
        total_experience: 0
      });
      
      await userLevel.save();
    }
    
    return userLevel;
  };

  /**
   * Thêm kinh nghiệm cho người dùng
   * @param {string} userId - ID của người dùng
   * @param {number} exp - Số kinh nghiệm cần thêm
   * @param {Object} metadata - Metadata bổ sung
   * @returns {Promise<Object>} - Thông tin cấp độ sau khi cập nhật
   */
  schema.statics.addExperience = async function(userId, exp, metadata = {}) {
    if (exp <= 0) {
      return null;
    }
    
    // Lấy thông tin cấp độ hiện tại
    let userLevel = await this.getUserLevel(userId);
    
    // Thêm vào lịch sử kinh nghiệm
    userLevel.experience_history.push({
      amount: exp,
      source: metadata.source || 'other',
      timestamp: new Date(),
      metadata: metadata
    });
    
    // Cập nhật tổng kinh nghiệm
    userLevel.total_experience += exp;
    
    // Cập nhật kinh nghiệm hiện tại
    userLevel.experience += exp;
    
    // Kiểm tra lên cấp
    let leveledUp = false;
    let oldLevel = userLevel.level;
    let newPrivileges = [];
    
    while (userLevel.experience >= userLevel.next_level_exp) {
      // Tăng cấp
      userLevel.level += 1;
      leveledUp = true;
      
      // Cập nhật kinh nghiệm còn lại
      userLevel.experience -= userLevel.next_level_exp;
      
      // Tính kinh nghiệm cần thiết cho cấp tiếp theo
      userLevel.next_level_exp = this.calculateExpForLevel(userLevel.level + 1);
      
      // Cập nhật thống kê
      userLevel.stats.last_level_up = new Date();
      userLevel.stats.highest_level = Math.max(userLevel.stats.highest_level, userLevel.level);
      
      // Kiểm tra đặc quyền mới
      const levelPrivileges = this.getPrivilegesByLevel(userLevel.level).filter(p => {
        // Lọc ra các đặc quyền chưa có
        return !userLevel.unlocked_privileges.some(up => 
          up.type === p.type && up.value === p.value
        );
      });
      
      // Thêm đặc quyền mới
      levelPrivileges.forEach(p => {
        userLevel.unlocked_privileges.push({
          type: p.type,
          value: p.value,
          unlocked_at_level: userLevel.level,
          unlocked_at: new Date(),
          active: true
        });
        
        newPrivileges.push(p);
      });
    }
    
    // Tính tốc độ tăng cấp trung bình
    if (userLevel.createdAt) {
      const daysSinceCreation = (Date.now() - userLevel.createdAt) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation > 0) {
        userLevel.stats.average_level_rate = (userLevel.level - 1) / daysSinceCreation;
      }
    }
    
    await userLevel.save();
    
    // Trả về kết quả
    return {
      userLevel,
      leveledUp,
      oldLevel,
      newLevel: userLevel.level,
      expAdded: exp,
      newPrivileges
    };
  };

  /**
   * Lấy bảng xếp hạng cấp độ
   * @param {number} limit - Số lượng người dùng cần lấy
   * @returns {Promise<Array>} - Danh sách người dùng
   */
  schema.statics.getLeaderboard = async function(limit = 10) {
    return this.find()
      .sort({ level: -1, experience: -1 })
      .limit(limit)
      .populate('user_id', 'name avatar slug');
  };
};

module.exports = setupStatics;
