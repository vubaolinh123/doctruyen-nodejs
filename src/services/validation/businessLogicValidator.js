/**
 * BUSINESS LOGIC VALIDATOR
 * Centralized validation for story/chapter purchase models
 * Ensures business constraints are enforced across all APIs
 */

const Story = require('../../models/story');
const Chapter = require('../../models/chapter');

class BusinessLogicValidator {
  
  /**
   * CORE BUSINESS RULE: isPaid và hasPaidChapters không được cùng true
   * @param {Object} storyData - Story data to validate
   * @throws {Error} - If business logic is violated
   */
  static validatePurchaseModelConstraint(storyData) {
    if (storyData.isPaid === true && storyData.hasPaidChapters === true) {
      throw new Error('Business Logic Violation: isPaid và hasPaidChapters không thể cùng là true. Chỉ được chọn một trong hai mô hình: Story-level purchase (isPaid=true) hoặc Chapter-level purchase (hasPaidChapters=true)');
    }
  }

  /**
   * Validate Model A: Story-level purchase
   * @param {Object} storyData - Story data to validate
   * @throws {Error} - If Model A constraints are violated
   */
  static validateModelA(storyData) {
    if (storyData.isPaid === true) {
      // Model A: Story must have price > 0
      if (!storyData.price || storyData.price <= 0) {
        throw new Error('Model A Violation: Story-level purchase requires price > 0');
      }

      // Model A: hasPaidChapters must be false
      if (storyData.hasPaidChapters === true) {
        throw new Error('Model A Violation: Story-level purchase cannot have hasPaidChapters=true');
      }
    }
  }

  /**
   * Validate Model B: Chapter-level purchase
   * @param {Object} storyData - Story data to validate
   * @throws {Error} - If Model B constraints are violated
   */
  static validateModelB(storyData) {
    if (storyData.hasPaidChapters === true) {
      // Model B: Story must be free (isPaid=false)
      if (storyData.isPaid === true) {
        throw new Error('Model B Violation: Chapter-level purchase requires story to be free (isPaid=false)');
      }

      // Model B: Story price should be 0
      if (storyData.price && storyData.price > 0) {
        throw new Error('Model B Violation: Chapter-level purchase story cannot have price > 0');
      }
    }
  }

  /**
   * Validate Free Story Model
   * @param {Object} storyData - Story data to validate
   * @throws {Error} - If free story constraints are violated
   */
  static validateFreeModel(storyData) {
    if (storyData.isPaid === false && storyData.hasPaidChapters === false) {
      // Free story: price must be 0
      if (storyData.price && storyData.price > 0) {
        throw new Error('Free Story Violation: Free story cannot have price > 0');
      }
    }
  }

  /**
   * Comprehensive story validation
   * @param {Object} storyData - Story data to validate
   * @throws {Error} - If any business logic is violated
   */
  static validateStoryBusinessLogic(storyData) {
    this.validatePurchaseModelConstraint(storyData);
    this.validateModelA(storyData);
    this.validateModelB(storyData);
    this.validateFreeModel(storyData);
  }

  /**
   * Validate chapter pricing against story model
   * @param {string} storyId - Story ID
   * @param {Object} chapterData - Chapter data to validate
   * @throws {Error} - If chapter pricing violates story model
   */
  static async validateChapterPricing(storyId, chapterData) {
    const story = await Story.findById(storyId).select('isPaid hasPaidChapters name');
    
    if (!story) {
      throw new Error('Story not found for chapter validation');
    }

    // Model A: Story-level purchase - chapters cannot be individually paid
    if (story.isPaid === true && chapterData.isPaid === true) {
      throw new Error(`Chapter Pricing Violation: Story "${story.name}" uses Model A (Story-level purchase). Individual chapters cannot be paid. All chapters must be free.`);
    }

    // Model B: Chapter-level purchase - allowed
    if (story.hasPaidChapters === true && chapterData.isPaid === true) {
      if (!chapterData.price || chapterData.price <= 0) {
        throw new Error('Chapter Pricing Violation: Paid chapters must have price > 0');
      }
    }

    // Free story: chapters can be paid (converts to Model B)
    if (story.isPaid === false && story.hasPaidChapters === false && chapterData.isPaid === true) {
      // This will auto-convert story to Model B
      console.log(`[BusinessLogicValidator] Auto-converting story ${storyId} to Model B due to paid chapter`);
    }
  }

  /**
   * Get purchase model for a story
   * @param {Object} story - Story object
   * @returns {string} - 'MODEL_A', 'MODEL_B', or 'FREE'
   */
  static getPurchaseModel(story) {
    if (story.isPaid === true) {
      return 'MODEL_A'; // Story-level purchase
    } else if (story.hasPaidChapters === true) {
      return 'MODEL_B'; // Chapter-level purchase
    } else {
      return 'FREE'; // Free story
    }
  }

  /**
   * Validate purchase compatibility
   * @param {Object} story - Story object
   * @param {string} purchaseType - 'story' or 'chapter'
   * @throws {Error} - If purchase type is not compatible with story model
   */
  static validatePurchaseCompatibility(story, purchaseType) {
    const model = this.getPurchaseModel(story);

    if (model === 'MODEL_A' && purchaseType === 'chapter') {
      throw new Error(`Purchase Compatibility Violation: Story "${story.name}" uses Model A (Story-level purchase). Cannot purchase individual chapters. Must purchase entire story.`);
    }

    if (model === 'FREE' && purchaseType === 'story') {
      throw new Error(`Purchase Compatibility Violation: Story "${story.name}" is free. Cannot purchase story-level access.`);
    }

    if (model === 'FREE' && purchaseType === 'chapter') {
      throw new Error(`Purchase Compatibility Violation: Story "${story.name}" is free. Cannot purchase individual chapters.`);
    }
  }

  /**
   * Auto-fix story model based on chapters
   * @param {string} storyId - Story ID
   * @returns {Promise<Object>} - Updated story model info
   */
  static async autoFixStoryModel(storyId) {
    const story = await Story.findById(storyId);
    if (!story) {
      throw new Error('Story not found for auto-fix');
    }

    // Count paid chapters
    const paidChaptersCount = await Chapter.countDocuments({ 
      story_id: storyId, 
      isPaid: true 
    });

    const updates = {};
    let modelChanged = false;

    // If story has paid chapters but hasPaidChapters is false, fix it
    if (paidChaptersCount > 0 && !story.hasPaidChapters && !story.isPaid) {
      updates.hasPaidChapters = true;
      modelChanged = true;
      console.log(`[BusinessLogicValidator] Auto-fixing story ${storyId}: Setting hasPaidChapters=true (found ${paidChaptersCount} paid chapters)`);
    }

    // If story has no paid chapters but hasPaidChapters is true, fix it
    if (paidChaptersCount === 0 && story.hasPaidChapters && !story.isPaid) {
      updates.hasPaidChapters = false;
      modelChanged = true;
      console.log(`[BusinessLogicValidator] Auto-fixing story ${storyId}: Setting hasPaidChapters=false (no paid chapters found)`);
    }

    // Apply updates if needed
    if (modelChanged) {
      await Story.updateOne({ _id: storyId }, { $set: updates });
      return {
        fixed: true,
        model: this.getPurchaseModel({ ...story.toObject(), ...updates }),
        updates
      };
    }

    return {
      fixed: false,
      model: this.getPurchaseModel(story),
      updates: {}
    };
  }

  /**
   * Validate and suggest fixes for business logic violations
   * @param {Object} storyData - Story data to validate
   * @returns {Object} - Validation result with suggestions
   */
  static validateWithSuggestions(storyData) {
    const errors = [];
    const suggestions = [];

    try {
      this.validateStoryBusinessLogic(storyData);
      return { valid: true, errors: [], suggestions: [] };
    } catch (error) {
      errors.push(error.message);

      // Provide suggestions based on error type
      if (error.message.includes('isPaid và hasPaidChapters không thể cùng là true')) {
        suggestions.push('Chọn một trong hai: Model A (isPaid=true, hasPaidChapters=false) hoặc Model B (isPaid=false, hasPaidChapters=true)');
      }

      if (error.message.includes('Model A Violation')) {
        suggestions.push('Model A: Đặt isPaid=true, price>0, hasPaidChapters=false');
      }

      if (error.message.includes('Model B Violation')) {
        suggestions.push('Model B: Đặt isPaid=false, price=0, hasPaidChapters=true');
      }

      return { valid: false, errors, suggestions };
    }
  }
}

module.exports = BusinessLogicValidator;
