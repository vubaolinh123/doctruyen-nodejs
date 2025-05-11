const mongoose = require('mongoose');
const { Schema } = mongoose;
const slugify = require('slugify');

/**
 * Schema cho chapter
 * Lưu thông tin các chapter của truyện
 */
const chapterSchema = new Schema({
  // Tham chiếu đến kho truyện chapter (nếu có)
  kho_truyen_chapter_id: {
    type: Number,
    default: 0
  },

  // Tham chiếu đến truyện
  story_id: {
    type: Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
    index: true
  },

  // Thông tin cơ bản
  chapter: {
    type: Number,
    required: true,
    min: 0
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  slug: {
    type: String
  },

  // Nội dung chapter
  content: {
    type: String,
    default: ''
  },

  // Thông tin audio
  audio: {
    type: String,
    default: ''
  },

  audio_show: {
    type: Boolean,
    default: false
  },

  // Hiển thị quảng cáo
  show_ads: {
    type: Boolean,
    default: false
  },

  // Link tham khảo
  link_ref: {
    type: String,
    default: ''
  },

  // Mã truy cập nếu có
  pass_code: {
    type: String,
    default: ''
  },

  // Thông tin chapter mới
  is_new: {
    type: Boolean,
    default: false
  },

  // Trạng thái hiển thị
  status: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      if (ret.createdAt) {
        // Convert createdAt to Vietnam timezone (UTC+7)
        const createdAtVN = new Date(ret.createdAt);
        createdAtVN.setHours(createdAtVN.getHours() + 7);
        ret.createdAt = createdAtVN;
      }
      if (ret.updatedAt) {
        // Convert updatedAt to Vietnam timezone (UTC+7)
        const updatedAtVN = new Date(ret.updatedAt);
        updatedAtVN.setHours(updatedAtVN.getHours() + 7);
        ret.updatedAt = updatedAtVN;
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
chapterSchema.index({ story_id: 1, chapter: 1 });
chapterSchema.index({ story_id: 1, createdAt: -1 });
chapterSchema.index({ createdAt: -1 });

// Virtuals
chapterSchema.virtual('story', {
  ref: 'Story',
  localField: 'story_id',
  foreignField: '_id',
  justOne: true
});

// Middleware pre-save
chapterSchema.pre('save', async function(next) {
  // Tạo slug nếu chưa có
  if (!this.slug && this.name) {
    this.slug = slugify(`chuong-${this.chapter}-${this.name}`, {
      lower: true,
      strict: true,
      locale: 'vi'
    });
  }

  // Nếu là chapter mới (không phải cập nhật), tăng chapter_count trong Story
  if (this.isNew) {
    try {
      const Story = mongoose.model('Story');
      await Story.findByIdAndUpdate(
        this.story_id,
        { $inc: { chapter_count: 1 } }
      );
      console.log(`Tăng chapter_count cho truyện ${this.story_id}`);
    } catch (error) {
      console.error('Lỗi khi cập nhật chapter_count:', error);
    }
  }

  next();
});

// Middleware pre-remove
chapterSchema.pre('remove', async function(next) {
  try {
    const Story = mongoose.model('Story');
    await Story.findByIdAndUpdate(
      this.story_id,
      { $inc: { chapter_count: -1 } }
    );
    console.log(`Giảm chapter_count cho truyện ${this.story_id}`);
  } catch (error) {
    console.error('Lỗi khi cập nhật chapter_count:', error);
  }
  next();
});

// Phương thức tĩnh để tìm chapter theo story_id và chapter number
chapterSchema.statics.findByStoryAndNumber = function(storyId, chapterNumber) {
  return this.findOne({
    story_id: storyId,
    chapter: chapterNumber,
    status: true
  });
};

// Phương thức tĩnh để tìm chapter theo story_id và slug
chapterSchema.statics.findByStoryAndSlug = function(storyId, slug) {
  return this.findOne({
    story_id: storyId,
    slug: slug,
    status: true
  });
};

// Phương thức tĩnh để lấy danh sách chapter của truyện
chapterSchema.statics.findByStory = function(storyId, limit = 0, skip = 0) {
  const query = this.find({
    story_id: storyId,
    status: true
  }).sort({ chapter: 1 });

  if (limit > 0) {
    query.limit(limit);
  }

  if (skip > 0) {
    query.skip(skip);
  }

  return query;
};

// Phương thức tĩnh để lấy chapter mới nhất của truyện
chapterSchema.statics.findLatestByStory = function(storyId) {
  return this.findOne({
    story_id: storyId,
    status: true
  }).sort({ chapter: -1 });
};

// Phương thức tĩnh để lấy chapter đầu tiên của truyện
chapterSchema.statics.findFirstByStory = function(storyId) {
  return this.findOne({
    story_id: storyId,
    status: true
  }).sort({ chapter: 1 });
};

// Phương thức tĩnh để lấy chapter tiếp theo
chapterSchema.statics.findNextChapter = function(storyId, currentChapter) {
  return this.findOne({
    story_id: storyId,
    chapter: { $gt: currentChapter },
    status: true
  }).sort({ chapter: 1 });
};

// Phương thức tĩnh để lấy chapter trước đó
chapterSchema.statics.findPreviousChapter = function(storyId, currentChapter) {
  return this.findOne({
    story_id: storyId,
    chapter: { $lt: currentChapter },
    status: true
  }).sort({ chapter: -1 });
};

module.exports = mongoose.model('Chapter', chapterSchema);