/**
 * BUSINESS LOGIC ADMIN ROUTES
 * Routes for managing and validating business logic
 */

const express = require('express');
const router = express.Router();
const BusinessLogicValidator = require('../../services/validation/businessLogicValidator');
const { isAuthenticated, requireAdmin } = require('../../middleware/auth');

/**
 * GET /api/admin/business-logic/validate-story
 * Validate story business logic
 */
router.get('/validate-story', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { isPaid, hasPaidChapters, price } = req.query;
    
    const storyData = {
      isPaid: isPaid === 'true',
      hasPaidChapters: hasPaidChapters === 'true',
      price: price ? parseFloat(price) : 0
    };

    const validation = BusinessLogicValidator.validateWithSuggestions(storyData);

    res.json({
      success: true,
      validation,
      model: validation.valid ? BusinessLogicValidator.getPurchaseModel(storyData) : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Validation error',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/business-logic/auto-fix-story/:storyId
 * Auto-fix story model based on chapters
 */
router.post('/auto-fix-story/:storyId', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { storyId } = req.params;
    
    const fixResult = await BusinessLogicValidator.autoFixStoryModel(storyId);

    res.json({
      success: true,
      message: fixResult.fixed ? 'Story model auto-fixed successfully' : 'No fixes needed',
      fixResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Auto-fix error',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/business-logic/story-model/:storyId
 * Get current purchase model for a story
 */
router.get('/story-model/:storyId', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { storyId } = req.params;
    
    const Story = require('../../models/story');
    const Chapter = require('../../models/chapter');
    
    const story = await Story.findById(storyId).select('name isPaid hasPaidChapters price');
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      });
    }

    const paidChaptersCount = await Chapter.countDocuments({ 
      story_id: storyId, 
      isPaid: true 
    });

    const totalChaptersCount = await Chapter.countDocuments({ 
      story_id: storyId 
    });

    const model = BusinessLogicValidator.getPurchaseModel(story);
    const validation = BusinessLogicValidator.validateWithSuggestions(story.toObject());

    res.json({
      success: true,
      story: {
        name: story.name,
        isPaid: story.isPaid,
        hasPaidChapters: story.hasPaidChapters,
        price: story.price
      },
      model,
      validation,
      stats: {
        totalChapters: totalChaptersCount,
        paidChapters: paidChaptersCount,
        freeChapters: totalChaptersCount - paidChaptersCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting story model',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/business-logic/validate-chapter-pricing
 * Validate chapter pricing against story model
 */
router.post('/validate-chapter-pricing', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { storyId, isPaid, price } = req.body;
    
    await BusinessLogicValidator.validateChapterPricing(storyId, { isPaid, price });

    res.json({
      success: true,
      message: 'Chapter pricing is valid',
      valid: true
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      valid: false,
      type: 'CHAPTER_PRICING_VIOLATION'
    });
  }
});

/**
 * GET /api/admin/business-logic/purchase-compatibility/:storyId
 * Check purchase compatibility for a story
 */
router.get('/purchase-compatibility/:storyId', isAuthenticated, requireAdmin, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { purchaseType } = req.query; // 'story' or 'chapter'
    
    const Story = require('../../models/story');
    const story = await Story.findById(storyId).select('name isPaid hasPaidChapters');
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found'
      });
    }

    try {
      BusinessLogicValidator.validatePurchaseCompatibility(story, purchaseType);
      
      res.json({
        success: true,
        message: `${purchaseType} purchase is compatible with this story`,
        compatible: true,
        model: BusinessLogicValidator.getPurchaseModel(story)
      });
    } catch (error) {
      res.json({
        success: true,
        message: error.message,
        compatible: false,
        model: BusinessLogicValidator.getPurchaseModel(story)
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking purchase compatibility',
      error: error.message
    });
  }
});

module.exports = router;
