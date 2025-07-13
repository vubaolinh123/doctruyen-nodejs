/**
 * UserAttendanceReward Hooks
 */

module.exports = function(schema) {
  console.log('[UserAttendanceReward] 🔧 Registering hooks...');
  /**
   * Pre-save hook: Validate và set default values
   */
  schema.pre('save', function(next) {
    try {
      // Validate dữ liệu
      this.validateClaim();

      // Set month và year từ claimed_at nếu chưa có
      if (!this.month && !this.year && this.claimed_at) {
        const claimedDate = new Date(this.claimed_at);
        this.month = claimedDate.getMonth();
        this.year = claimedDate.getFullYear();
      }

      // Trim notes nếu có
      if (this.notes) {
        this.notes = this.notes.trim();
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Post-save hook: Log và thực hiện các action sau khi claim thành công
   */
  schema.post('save', async function(doc) {
    console.log(`[UserAttendanceReward] ✅ POST-SAVE HOOK TRIGGERED! isNew: ${this.isNew}, doc: ${doc._id}`);

    if (this.isNew) {
      console.log(`[UserAttendanceReward] 🎯 Processing new claim: User ${doc.user_id} claimed milestone ${doc.milestone_id} (${doc.reward_type}: ${doc.reward_value})`);

      try {
        // Nếu là coin reward, cập nhật coin cho user
        if (doc.reward_type === 'coin' && doc.reward_value > 0) {
          console.log(`[UserAttendanceReward] 💰 Processing coin reward: ${doc.reward_value} coins for user ${doc.user_id}`);

          const User = require('../user');
          const user = await User.findById(doc.user_id);

          if (user) {
            console.log(`[UserAttendanceReward] 👤 Found user: ${user.email}, current coin: ${user.coin}`);

            // ✅ Improved coin addition with proper description and metadata
            const description = `Phần thưởng điểm danh: ${doc.notes || 'Nhận thưởng mốc điểm danh'}`;
            const metadata = {
              reward_claim_id: doc._id,
              reward_type: doc.reward_type,
              reward_value: doc.reward_value,
              claimed_at: doc.claimed_at,
              month: doc.month,
              year: doc.year
            };

            console.log(`[UserAttendanceReward] 🔧 About to call addCoins with:`, {
              amount: doc.reward_value,
              description: description,
              metadata: metadata
            });

            // ✅ Fix: addCoins expects (amount, options) where options can be string or object
            const result = await user.addCoins(doc.reward_value, {
              description: description,
              metadata: metadata
            });

            console.log(`[UserAttendanceReward] ✅ addCoins result: ${result}`);
            console.log(`[UserAttendanceReward] ✅ Successfully added ${doc.reward_value} coins to user ${doc.user_id}`);

            // ✅ Verify coin was actually added
            const updatedUser = await User.findById(doc.user_id).select('coin');
            console.log(`[UserAttendanceReward] ✅ User coin after update: ${updatedUser.coin}`);
          } else {
            console.log(`[UserAttendanceReward] ❌ User not found: ${doc.user_id}`);
          }
        } else {
          console.log(`[UserAttendanceReward] ⚠️ Not a coin reward or invalid value: type=${doc.reward_type}, value=${doc.reward_value}`);
        }

        // Nếu là permission reward, cập nhật permission cho user
        if (doc.reward_type === 'permission' && doc.permission_id) {
          const UserPermission = require('../userPermission');

          // Kiểm tra xem user đã có permission này chưa
          const existingPermission = await UserPermission.findOne({
            user_id: doc.user_id,
            template_id: doc.permission_id
          });

          if (!existingPermission) {
            await UserPermission.create({
              user_id: doc.user_id,
              template_id: doc.permission_id,
              granted_at: doc.claimed_at,
              granted_by: 'system',
              reason: `Phần thưởng điểm danh: ${doc.notes}`
            });
            console.log(`[UserAttendanceReward] Granted permission ${doc.permission_id} to user ${doc.user_id}`);
          }
        }

        // TODO: Có thể thêm logic gửi notification cho user ở đây

      } catch (error) {
        console.error(`[UserAttendanceReward] ❌ CRITICAL ERROR in post-save hook:`, error);
        console.error(`[UserAttendanceReward] ❌ Error details:`, error.message);
        console.error(`[UserAttendanceReward] ❌ Error stack:`, error.stack);
        console.error(`[UserAttendanceReward] ❌ Doc data:`, JSON.stringify(doc, null, 2));
        // Không throw error để không ảnh hưởng đến flow chính
      }
    } else {
      console.log(`[UserAttendanceReward] ⚠️ Hook triggered but not a new document`);
    }
  });

  /**
   * Pre-findOneAndUpdate hook: Prevent update của các trường quan trọng
   */
  schema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    // Không cho phép update các trường quan trọng
    const protectedFields = ['user_id', 'milestone_id', 'claimed_at', 'month', 'year', 'milestone_type', 'days_at_claim', 'reward_type', 'reward_value', 'permission_id'];

    for (const field of protectedFields) {
      if (update[field] !== undefined) {
        return next(new Error(`Cannot update protected field: ${field}`));
      }
    }

    // Chỉ cho phép update notes
    if (update.notes) {
      update.notes = update.notes.trim();
    }

    next();
  });

  /**
   * Post-findOneAndDelete hook: Log khi xóa claim
   */
  schema.post('findOneAndDelete', function(doc) {
    if (doc) {
      console.log(`[UserAttendanceReward] Deleted claim: User ${doc.user_id}, Milestone ${doc.milestone_id}, ${doc.getClaimedTimeText()}`);
    }
  });

  /**
   * Pre-deleteMany hook: Log khi cleanup
   */
  schema.pre('deleteMany', function(next) {
    console.log('[UserAttendanceReward] Starting cleanup of old claims...');
    next();
  });

  /**
   * Post-deleteMany hook: Log kết quả cleanup
   */
  schema.post('deleteMany', function(result) {
    console.log(`[UserAttendanceReward] Cleanup completed. Deleted ${result.deletedCount} old claims.`);
  });
};
