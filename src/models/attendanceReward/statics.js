/**
 * AttendanceReward Static Methods
 */

module.exports = function(schema) {
  /**
   * Lấy tất cả mốc phần thưởng đang hoạt động
   * @param {String} type - Loại phần thưởng ('consecutive' | 'total' | null)
   * @returns {Promise<Array>} - Danh sách mốc phần thưởng
   */
  schema.statics.getActiveRewards = async function(type = null) {
    const query = { is_active: true };
    if (type) {
      query.type = type;
    }

    return this.find(query)
      .populate('permission_id', 'name description')
      .sort({ type: 1, required_days: 1 })
      .lean();
  };

  /**
   * Tạo mốc phần thưởng mới với validation
   * @param {Object} rewardData - Dữ liệu mốc phần thưởng
   * @returns {Promise<Object>} - Mốc phần thưởng đã tạo
   */
  schema.statics.createReward = async function(rewardData) {
    // Kiểm tra xem đã có mốc cùng type và required_days chưa
    const existingReward = await this.findOne({
      type: rewardData.type,
      required_days: rewardData.required_days
    });

    if (existingReward) {
      throw new Error(`Mốc phần thưởng ${rewardData.type} ${rewardData.required_days} ngày đã tồn tại`);
    }

    // Validate dữ liệu
    if (rewardData.reward_type === 'coin' && (!rewardData.reward_value || rewardData.reward_value <= 0)) {
      throw new Error('Giá trị xu phải lớn hơn 0 khi loại phần thưởng là coin');
    }

    if (rewardData.reward_type === 'permission' && !rewardData.permission_id) {
      throw new Error('Permission ID là bắt buộc khi loại phần thưởng là permission');
    }

    return this.create(rewardData);
  };

  /**
   * Cập nhật mốc phần thưởng
   * @param {String} rewardId - ID mốc phần thưởng
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Mốc phần thưởng đã cập nhật
   */
  schema.statics.updateReward = async function(rewardId, updateData) {
    // Nếu cập nhật type hoặc required_days, kiểm tra unique constraint
    if (updateData.type || updateData.required_days) {
      const currentReward = await this.findById(rewardId);
      if (!currentReward) {
        throw new Error('Không tìm thấy mốc phần thưởng');
      }

      const newType = updateData.type || currentReward.type;
      const newRequiredDays = updateData.required_days || currentReward.required_days;

      // Chỉ kiểm tra nếu type hoặc required_days thay đổi
      if (newType !== currentReward.type || newRequiredDays !== currentReward.required_days) {
        const existingReward = await this.findOne({
          _id: { $ne: rewardId },
          type: newType,
          required_days: newRequiredDays
        });

        if (existingReward) {
          throw new Error(`Mốc phần thưởng ${newType} ${newRequiredDays} ngày đã tồn tại`);
        }
      }
    }

    // Validate dữ liệu
    if (updateData.reward_type === 'coin' && (!updateData.reward_value || updateData.reward_value <= 0)) {
      throw new Error('Giá trị xu phải lớn hơn 0 khi loại phần thưởng là coin');
    }

    if (updateData.reward_type === 'permission' && !updateData.permission_id) {
      throw new Error('Permission ID là bắt buộc khi loại phần thưởng là permission');
    }

    updateData.updated_at = new Date();

    return this.findByIdAndUpdate(rewardId, updateData, { 
      new: true, 
      runValidators: true 
    }).populate('permission_id', 'name description');
  };

  /**
   * Xóa mốc phần thưởng (soft delete)
   * @param {String} rewardId - ID mốc phần thưởng
   * @returns {Promise<Object>} - Kết quả xóa
   */
  schema.statics.deleteReward = async function(rewardId) {
    const reward = await this.findById(rewardId);
    if (!reward) {
      throw new Error('Không tìm thấy mốc phần thưởng');
    }

    // Soft delete bằng cách set is_active = false
    return this.findByIdAndUpdate(rewardId, { 
      is_active: false,
      updated_at: new Date()
    }, { new: true });
  };

  /**
   * Lấy mốc phần thưởng theo ID
   * @param {String} rewardId - ID mốc phần thưởng
   * @returns {Promise<Object>} - Mốc phần thưởng
   */
  schema.statics.getRewardById = async function(rewardId) {
    return this.findById(rewardId)
      .populate('permission_id', 'name description')
      .lean();
  };

  /**
   * Lấy mốc phần thưởng có thể đạt được cho user
   * @param {Number} consecutiveDays - Số ngày điểm danh liên tiếp
   * @param {Number} totalDays - Tổng số ngày điểm danh
   * @returns {Promise<Object>} - Mốc phần thưởng có thể đạt được
   */
  schema.statics.getEligibleRewards = async function(consecutiveDays, totalDays) {
    const consecutiveRewards = await this.find({
      type: 'consecutive',
      required_days: { $lte: consecutiveDays },
      is_active: true
    }).sort({ required_days: -1 }).lean();

    const totalRewards = await this.find({
      type: 'total',
      required_days: { $lte: totalDays },
      is_active: true
    }).sort({ required_days: -1 }).lean();

    return {
      consecutive: consecutiveRewards,
      total: totalRewards
    };
  };
};
