/**
 * Định nghĩa các virtual properties cho StoriesReading model
 * @param {Object} schema - Schema của StoriesReading
 */
module.exports = function(schema) {
  // Virtuals để populate các thông tin liên quan

  // Virtual cho Story
  schema.virtual('story', {
    ref: 'Story',
    localField: 'story_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual cho User
  schema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual cho Current Chapter
  schema.virtual('current_chapter_info', {
    ref: 'Chapter',
    localField: 'current_chapter.chapter_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual cho Last Completed Chapter
  schema.virtual('last_completed_chapter_info', {
    ref: 'Chapter',
    localField: 'last_completed_chapter.chapter_id',
    foreignField: '_id',
    justOne: true
  });

  // Virtual tính toán reading progress (phần trăm)
  schema.virtual('reading_progress').get(function() {
    if (!this.story_id || !this.current_chapter) {
      return 0;
    }

    // Cần thông tin tổng số chapter của story để tính chính xác
    // Tạm thời return dựa trên chapter number
    const currentChapter = this.current_chapter.chapter_number || 0;
    const completedChapters = this.reading_stats.completed_chapters || 0;

    return Math.min(Math.round((completedChapters / Math.max(currentChapter, 1)) * 100), 100);
  });

  // Virtual tính reading streak (số ngày đọc liên tiếp)
  schema.virtual('reading_streak').get(function() {
    // Logic tính streak sẽ được implement trong service layer
    // Vì cần query database để tính chính xác
    return 0;
  });

  // Virtual format reading time
  schema.virtual('formatted_reading_time').get(function() {
    const totalSeconds = this.reading_stats.total_reading_time || 0;

    // Convert seconds to appropriate unit
    if (totalSeconds < 60) {
      return `${totalSeconds} giây`;
    }

    const totalMinutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    if (totalMinutes < 60) {
      return remainingSeconds > 0 ? `${totalMinutes} phút ${remainingSeconds} giây` : `${totalMinutes} phút`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours < 24) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  });

  // Virtual cho bookmark count
  schema.virtual('bookmark_count').get(function() {
    return this.bookmarks ? this.bookmarks.length : 0;
  });

  // Virtual cho reading status display
  schema.virtual('reading_status_display').get(function() {
    const statusMap = {
      'reading': 'Đang đọc',
      'completed': 'Đã hoàn thành',
      'paused': 'Tạm dừng',
      'dropped': 'Bỏ dở',
      'plan_to_read': 'Dự định đọc'
    };

    return statusMap[this.reading_status] || 'Không xác định';
  });

  // Virtual cho last activity
  schema.virtual('last_activity').get(function() {
    const lastRead = this.reading_stats.last_read_at;
    if (!lastRead) return 'Chưa có hoạt động';

    const now = new Date();
    const diffMs = now - lastRead;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng trước`;

    return `${Math.floor(diffDays / 365)} năm trước`;
  });

  // Virtual cho priority display
  schema.virtual('priority_display').get(function() {
    const priority = this.metadata?.priority || 3;
    const priorityMap = {
      1: 'Rất thấp',
      2: 'Thấp',
      3: 'Bình thường',
      4: 'Cao',
      5: 'Rất cao'
    };

    return priorityMap[priority] || 'Bình thường';
  });
};