const mongoose = require('mongoose');
const Story = require('../../models/story');
const Chapter = require('../../models/chapter');

/**
 * Service for managing hasPaidChapters field auto-updates
 * Ensures data consistency when chapter isPaid status changes
 */
class HasPaidChaptersService {
  
  /**
   * Calculate if a story has any paid chapters (OPTIMIZED with aggregation)
   * @param {string|ObjectId} storyId - Story ID
   * @returns {Promise<boolean>} - True if story has at least one paid chapter
   */
  async calculateHasPaidChapters(storyId) {
    try {
      // Validate storyId
      if (!mongoose.Types.ObjectId.isValid(storyId)) {
        throw new Error('Invalid story ID');
      }

      const startTime = Date.now();

      // PERFORMANCE: Use aggregation pipeline with $limit 1 for maximum efficiency
      // This stops after finding the first paid chapter instead of counting all
      const aggregationResult = await Chapter.aggregate([
        {
          $match: {
            story_id: new mongoose.Types.ObjectId(storyId),
            isPaid: true
          }
        },
        {
          $limit: 1 // Stop immediately after finding first paid chapter
        },
        {
          $project: { _id: 1 } // Only return minimal data
        }
      ]);

      // Business rule: If ANY chapter is paid, story hasPaidChapters = true
      const hasPaidChapters = aggregationResult.length > 0;

      const executionTime = Date.now() - startTime;
      console.log(`[HasPaidChaptersService] Calculated hasPaidChapters for story ${storyId}: ${hasPaidChapters} (${executionTime}ms)`);

      return hasPaidChapters;
    } catch (error) {
      console.error('[HasPaidChaptersService] Error calculating hasPaidChapters:', error);
      throw error;
    }
  }

  /**
   * Update story's hasPaidChapters field based on current chapter data (OPTIMIZED)
   * @param {string|ObjectId} storyId - Story ID
   * @returns {Promise<{updated: boolean, hasPaidChapters: boolean}>}
   */
  async updateStoryHasPaidChapters(storyId) {
    try {
      console.log(`[HasPaidChaptersService] Updating hasPaidChapters for story: ${storyId}`);

      const startTime = Date.now();

      // Calculate current hasPaidChapters value
      const hasPaidChapters = await this.calculateHasPaidChapters(storyId);

      // PERFORMANCE: Only update if value actually changed
      const currentStory = await Story.findById(storyId).select('hasPaidChapters');
      if (currentStory && currentStory.hasPaidChapters === hasPaidChapters) {
        console.log(`[HasPaidChaptersService] No update needed for story ${storyId}: hasPaidChapters already ${hasPaidChapters}`);

        return {
          updated: false,
          hasPaidChapters,
          story: currentStory
        };
      }

      // Update the story
      const updateResult = await Story.findByIdAndUpdate(
        storyId,
        { hasPaidChapters },
        { new: true, runValidators: true }
      );

      if (!updateResult) {
        throw new Error('Story not found');
      }

      const executionTime = Date.now() - startTime;
      console.log(`[HasPaidChaptersService] Updated story ${storyId}: hasPaidChapters = ${hasPaidChapters} (${executionTime}ms)`);

      return {
        updated: true,
        hasPaidChapters,
        story: updateResult
      };
    } catch (error) {
      console.error('[HasPaidChaptersService] Error updating story hasPaidChapters:', error);
      throw error;
    }
  }

  /**
   * Calculate hasPaidChapters for multiple stories in a single aggregation query (OPTIMIZED)
   * @param {Array<string>} storyIds - Array of story IDs
   * @returns {Promise<Object>} - Object with storyId as key and hasPaidChapters as value
   */
  async calculateBatchHasPaidChapters(storyIds) {
    try {
      const startTime = Date.now();

      // PERFORMANCE: Single aggregation query for all stories
      const aggregationResult = await Chapter.aggregate([
        {
          $match: {
            story_id: { $in: storyIds.map(id => new mongoose.Types.ObjectId(id)) },
            isPaid: true
          }
        },
        {
          $group: {
            _id: "$story_id",
            hasPaidChapters: { $sum: 1 }
          }
        }
      ]);

      // Convert to lookup object
      const results = {};
      storyIds.forEach(storyId => {
        results[storyId] = false; // Default to false
      });

      aggregationResult.forEach(result => {
        const storyId = result._id.toString();
        results[storyId] = result.hasPaidChapters > 0;
      });

      const executionTime = Date.now() - startTime;
      console.log(`[HasPaidChaptersService] Batch calculated hasPaidChapters for ${storyIds.length} stories in ${executionTime}ms`);

      return results;
    } catch (error) {
      console.error('[HasPaidChaptersService] Error in batch calculation:', error);
      throw error;
    }
  }

  /**
   * Update multiple stories' hasPaidChapters fields (OPTIMIZED with batch processing)
   * @param {Array<string|ObjectId>} storyIds - Array of story IDs
   * @param {number} batchSize - Batch size for processing (default: 10)
   * @returns {Promise<Array<{storyId, updated, hasPaidChapters}>>}
   */
  async updateMultipleStoriesHasPaidChapters(storyIds, batchSize = 10) {
    try {
      console.log(`[HasPaidChaptersService] Batch updating hasPaidChapters for ${storyIds.length} stories (batch size: ${batchSize})`);

      const startTime = Date.now();
      const results = [];
      const uniqueStoryIds = [...new Set(storyIds.map(id => id.toString()))]; // Remove duplicates

      // PERFORMANCE: Process in batches to avoid overwhelming the database
      for (let i = 0; i < uniqueStoryIds.length; i += batchSize) {
        const batch = uniqueStoryIds.slice(i, i + batchSize);
        console.log(`[HasPaidChaptersService] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uniqueStoryIds.length / batchSize)}`);

        // PERFORMANCE: Use aggregation to get paid chapter status for entire batch
        const batchResults = await this.calculateBatchHasPaidChapters(batch);

        // PERFORMANCE: Prepare bulk update operations
        const bulkOps = [];

        for (const storyId of batch) {
          try {
            const hasPaidChapters = batchResults[storyId] || false;

            // Prepare bulk update operation
            bulkOps.push({
              updateOne: {
                filter: { _id: new mongoose.Types.ObjectId(storyId) },
                update: { $set: { hasPaidChapters } }
              }
            });



            results.push({
              storyId,
              updated: true,
              hasPaidChapters
            });
          } catch (error) {
            console.error(`[HasPaidChaptersService] Error processing story ${storyId}:`, error);
            results.push({
              storyId,
              updated: false,
              error: error.message
            });
          }
        }

        // PERFORMANCE: Execute bulk update
        if (bulkOps.length > 0) {
          await Story.bulkWrite(bulkOps);
        }
      }

      const executionTime = Date.now() - startTime;
      console.log(`[HasPaidChaptersService] Batch update completed: ${results.length} stories processed in ${executionTime}ms`);

      return results;
    } catch (error) {
      console.error('[HasPaidChaptersService] Error updating multiple stories:', error);
      throw error;
    }
  }

  /**
   * Recalculate hasPaidChapters for all stories in database
   * Used for migration and data consistency checks
   * @returns {Promise<{totalStories, updatedStories, errors}>}
   */
  async recalculateAllStoriesHasPaidChapters() {
    try {
      console.log('[HasPaidChaptersService] Starting recalculation for all stories...');

      // Get all stories
      const stories = await Story.find({}).select('_id name');
      console.log(`[HasPaidChaptersService] Found ${stories.length} stories to process`);

      let updatedCount = 0;
      const errors = [];

      for (const story of stories) {
        try {
          await this.updateStoryHasPaidChapters(story._id);
          updatedCount++;
        } catch (error) {
          console.error(`[HasPaidChaptersService] Error processing story ${story._id}:`, error);
          errors.push({
            storyId: story._id,
            storyName: story.name,
            error: error.message
          });
        }
      }

      console.log(`[HasPaidChaptersService] Recalculation complete: ${updatedCount}/${stories.length} stories updated`);

      return {
        totalStories: stories.length,
        updatedStories: updatedCount,
        errors
      };
    } catch (error) {
      console.error('[HasPaidChaptersService] Error in recalculateAllStoriesHasPaidChapters:', error);
      throw error;
    }
  }

  /**
   * Get stories that need hasPaidChapters recalculation
   * Useful for identifying data inconsistencies
   * @returns {Promise<Array<{storyId, currentValue, calculatedValue}>>}
   */
  async getStoriesNeedingRecalculation() {
    try {
      const stories = await Story.find({}).select('_id name hasPaidChapters');
      const inconsistentStories = [];

      for (const story of stories) {
        const calculatedValue = await this.calculateHasPaidChapters(story._id);
        const currentValue = story.hasPaidChapters;

        if (currentValue !== calculatedValue) {
          inconsistentStories.push({
            storyId: story._id,
            storyName: story.name,
            currentValue,
            calculatedValue
          });
        }
      }

      return inconsistentStories;
    } catch (error) {
      console.error('[HasPaidChaptersService] Error checking for inconsistencies:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new HasPaidChaptersService();
