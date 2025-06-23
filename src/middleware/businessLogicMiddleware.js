/**
 * BUSINESS LOGIC MIDDLEWARE
 * Middleware to enforce business logic validation across all APIs
 */

const BusinessLogicValidator = require('../services/validation/businessLogicValidator');

/**
 * Middleware to validate story business logic before create/update
 */
const validateStoryBusinessLogic = (req, res, next) => {
  try {
    const storyData = req.body;
    
    // Skip validation if no relevant fields are being updated
    if (!('isPaid' in storyData) && !('hasPaidChapters' in storyData) && !('price' in storyData)) {
      return next();
    }

    // Validate business logic
    BusinessLogicValidator.validateStoryBusinessLogic(storyData);
    
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
      type: 'BUSINESS_LOGIC_VIOLATION'
    });
  }
};

/**
 * Middleware to validate chapter pricing against story model
 */
const validateChapterPricing = async (req, res, next) => {
  try {
    const { story_id } = req.body;
    const chapterData = req.body;
    
    // Skip validation if no pricing fields are being updated
    if (!('isPaid' in chapterData) && !('price' in chapterData)) {
      return next();
    }

    // Skip if no story_id provided
    if (!story_id) {
      return next();
    }

    // Validate chapter pricing
    await BusinessLogicValidator.validateChapterPricing(story_id, chapterData);
    
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
      type: 'CHAPTER_PRICING_VIOLATION'
    });
  }
};

/**
 * Middleware to validate purchase compatibility
 */
const validatePurchaseCompatibility = async (req, res, next) => {
  try {
    const { storyId, purchaseType } = req.body; // purchaseType: 'story' or 'chapter'
    
    if (!storyId || !purchaseType) {
      return next();
    }

    const Story = require('../models/story');
    const story = await Story.findById(storyId).select('isPaid hasPaidChapters name');
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      });
    }

    // Validate purchase compatibility
    BusinessLogicValidator.validatePurchaseCompatibility(story, purchaseType);
    
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
      type: 'PURCHASE_COMPATIBILITY_VIOLATION'
    });
  }
};

/**
 * Middleware to auto-fix story model if needed
 */
const autoFixStoryModel = async (req, res, next) => {
  try {
    const { story_id } = req.body;
    
    if (!story_id) {
      return next();
    }

    // Auto-fix story model
    const fixResult = await BusinessLogicValidator.autoFixStoryModel(story_id);
    
    if (fixResult.fixed) {
      console.log(`[BusinessLogicMiddleware] Auto-fixed story ${story_id}:`, fixResult.updates);
    }
    
    // Attach fix result to request for logging
    req.businessLogicFix = fixResult;
    
    next();
  } catch (error) {
    console.error('[BusinessLogicMiddleware] Auto-fix error:', error.message);
    // Don't block the request, just log the error
    next();
  }
};

/**
 * Middleware to provide business logic suggestions
 */
const provideBusinessLogicSuggestions = (req, res, next) => {
  try {
    const storyData = req.body;
    
    // Skip if no relevant fields
    if (!('isPaid' in storyData) && !('hasPaidChapters' in storyData) && !('price' in storyData)) {
      return next();
    }

    const validation = BusinessLogicValidator.validateWithSuggestions(storyData);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Business logic validation failed',
        errors: validation.errors,
        suggestions: validation.suggestions,
        type: 'BUSINESS_LOGIC_VALIDATION_FAILED'
      });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Business logic validation error',
      error: error.message
    });
  }
};

/**
 * Combined middleware for comprehensive business logic validation
 */
const comprehensiveBusinessLogicValidation = [
  validateStoryBusinessLogic,
  provideBusinessLogicSuggestions
];

/**
 * Combined middleware for chapter operations
 */
const chapterBusinessLogicValidation = [
  validateChapterPricing,
  autoFixStoryModel
];

/**
 * Combined middleware for purchase operations
 */
const purchaseBusinessLogicValidation = [
  validatePurchaseCompatibility
];

module.exports = {
  validateStoryBusinessLogic,
  validateChapterPricing,
  validatePurchaseCompatibility,
  autoFixStoryModel,
  provideBusinessLogicSuggestions,
  comprehensiveBusinessLogicValidation,
  chapterBusinessLogicValidation,
  purchaseBusinessLogicValidation
};
