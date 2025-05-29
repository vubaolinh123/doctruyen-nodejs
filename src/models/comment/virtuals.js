/**
 * Virtual fields cho Comment model
 * Các field được tính toán động
 */
const setupVirtuals = (schema) => {

  /**
   * Virtual để lấy thông tin user
   */
  schema.virtual('user', {
    ref: 'User',
    localField: 'user_id',
    foreignField: '_id',
    justOne: true,
    options: {
      select: 'name avatar slug level'
    }
  });

  /**
   * Virtual để lấy thông tin story
   */
  schema.virtual('story', {
    ref: 'Story',
    localField: 'target.story_id',
    foreignField: '_id',
    justOne: true,
    options: {
      select: 'title slug cover_image'
    }
  });

  /**
   * Virtual để lấy thông tin chapter
   */
  schema.virtual('chapter', {
    ref: 'Chapter',
    localField: 'target.chapter_id',
    foreignField: '_id',
    justOne: true,
    options: {
      select: 'title chapter_number slug'
    }
  });

  /**
   * Virtual để lấy parent comment
   */
  schema.virtual('parent', {
    ref: 'Comment',
    localField: 'hierarchy.parent_id',
    foreignField: '_id',
    justOne: true
  });

  /**
   * Virtual để lấy root comment
   */
  schema.virtual('root', {
    ref: 'Comment',
    localField: 'hierarchy.root_id',
    foreignField: '_id',
    justOne: true
  });

  /**
   * Virtual để lấy direct replies
   */
  schema.virtual('directReplies', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'hierarchy.parent_id',
    options: {
      match: { 'moderation.status': 'active' },
      sort: { createdAt: 1 },
      limit: 5 // Chỉ lấy 5 replies đầu tiên
    }
  });

  /**
   * Virtual để check xem comment có được edit không
   */
  schema.virtual('isEdited').get(function() {
    return this.metadata.edit_history && this.metadata.edit_history.length > 0;
  });

  /**
   * Virtual để lấy thời gian edit cuối cùng
   */
  schema.virtual('lastEditedAt').get(function() {
    if (!this.metadata.edit_history || this.metadata.edit_history.length === 0) {
      return null;
    }
    return this.metadata.edit_history[this.metadata.edit_history.length - 1].edited_at;
  });

  /**
   * Virtual để tính engagement ratio
   */
  schema.virtual('engagementRatio').get(function() {
    const likes = this.engagement.likes.count || 0;
    const dislikes = this.engagement.dislikes.count || 0;
    const total = likes + dislikes;
    
    if (total === 0) return 0;
    return (likes / total) * 100;
  });

  /**
   * Virtual để check xem comment có bị flag nhiều không
   */
  schema.virtual('isHighlyFlagged').get(function() {
    return this.moderation.flags.count >= 3;
  });

  /**
   * Virtual để check xem comment có suspicious không
   */
  schema.virtual('isSuspicious').get(function() {
    const spamScore = this.moderation.auto_moderation.spam_score || 0;
    const toxicityScore = this.moderation.auto_moderation.toxicity_score || 0;
    const flagCount = this.moderation.flags.count || 0;
    
    return spamScore > 0.7 || toxicityScore > 0.7 || flagCount >= 5;
  });

  /**
   * Virtual để tính comment age
   */
  schema.virtual('ageInHours').get(function() {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
  });

  /**
   * Virtual để tính comment age readable
   */
  schema.virtual('ageReadable').get(function() {
    const ageInMinutes = Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
    
    if (ageInMinutes < 1) return 'Vừa xong';
    if (ageInMinutes < 60) return `${ageInMinutes} phút trước`;
    
    const ageInHours = Math.floor(ageInMinutes / 60);
    if (ageInHours < 24) return `${ageInHours} giờ trước`;
    
    const ageInDays = Math.floor(ageInHours / 24);
    if (ageInDays < 30) return `${ageInDays} ngày trước`;
    
    const ageInMonths = Math.floor(ageInDays / 30);
    if (ageInMonths < 12) return `${ageInMonths} tháng trước`;
    
    const ageInYears = Math.floor(ageInMonths / 12);
    return `${ageInYears} năm trước`;
  });

  /**
   * Virtual để check xem user có thể edit không
   */
  schema.virtual('canBeEdited').get(function() {
    const editTimeLimit = 15 * 60 * 1000; // 15 minutes
    const timeSinceCreated = Date.now() - this.createdAt.getTime();
    
    return timeSinceCreated <= editTimeLimit && this.moderation.status === 'active';
  });

  /**
   * Virtual để lấy content preview (truncated)
   */
  schema.virtual('contentPreview').get(function() {
    const maxLength = 100;
    const content = this.content.sanitized || this.content.original || '';
    
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  });

  /**
   * Virtual để check xem có mentions không
   */
  schema.virtual('hasMentions').get(function() {
    return this.content.mentions && this.content.mentions.length > 0;
  });

  /**
   * Virtual để lấy mention usernames
   */
  schema.virtual('mentionedUsernames').get(function() {
    if (!this.content.mentions) return [];
    return this.content.mentions.map(mention => mention.username);
  });

  /**
   * Virtual để tính depth level readable
   */
  schema.virtual('depthLevel').get(function() {
    const level = this.hierarchy.level || 0;
    if (level === 0) return 'Bình luận gốc';
    if (level === 1) return 'Phản hồi';
    if (level === 2) return 'Phản hồi cấp 2';
    return `Phản hồi cấp ${level}`;
  });

  /**
   * Virtual để check xem có phải root comment không
   */
  schema.virtual('isRootComment').get(function() {
    return this.hierarchy.level === 0;
  });

  /**
   * Virtual để check xem có phải reply không
   */
  schema.virtual('isReply').get(function() {
    return this.hierarchy.level > 0;
  });

  /**
   * Virtual để lấy total engagement
   */
  schema.virtual('totalEngagement').get(function() {
    const likes = this.engagement.likes.count || 0;
    const dislikes = this.engagement.dislikes.count || 0;
    const replies = this.engagement.replies.count || 0;
    
    return likes + dislikes + replies;
  });

  /**
   * Virtual để check moderation status readable
   */
  schema.virtual('moderationStatusReadable').get(function() {
    const statusMap = {
      'active': 'Hoạt động',
      'pending': 'Chờ duyệt',
      'hidden': 'Đã ẩn',
      'deleted': 'Đã xóa',
      'spam': 'Spam'
    };
    
    return statusMap[this.moderation.status] || 'Không xác định';
  });

  /**
   * Virtual để lấy URL của comment
   */
  schema.virtual('url').get(function() {
    if (this.target.type === 'story') {
      return `/story/${this.story?.slug || this.target.story_id}#comment-${this._id}`;
    } else if (this.target.type === 'chapter') {
      return `/story/${this.story?.slug || this.target.story_id}/chapter/${this.chapter?.slug || this.target.chapter_id}#comment-${this._id}`;
    }
    return '#';
  });

  /**
   * Virtual để check xem comment có hot không (engagement cao)
   */
  schema.virtual('isHot').get(function() {
    const score = this.engagement.score || 0;
    const ageInHours = this.ageInHours;
    
    // Hot nếu score cao và còn mới
    return score >= 10 && ageInHours <= 24;
  });

  /**
   * Virtual để check xem comment có trending không
   */
  schema.virtual('isTrending').get(function() {
    const likes = this.engagement.likes.count || 0;
    const replies = this.engagement.replies.count || 0;
    const ageInHours = this.ageInHours;
    
    // Trending nếu có nhiều interaction trong thời gian ngắn
    return (likes >= 5 || replies >= 3) && ageInHours <= 6;
  });
};

module.exports = setupVirtuals;
