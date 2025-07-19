/**
 * Revenue Analytics Service
 * Handles revenue calculations and analytics for authors
 */

const mongoose = require('mongoose');
const Transaction = require('../../models/transaction');
const UserPurchases = require('../../models/userPurchases');
const Story = require('../../models/story');
const Chapter = require('../../models/chapter');
const Author = require('../../models/author');

class RevenueService {
  /**
   * Get revenue overview for an author
   * @param {string} authorId - Author ID
   * @param {Object} options - Query options
   * @returns {Object} Revenue overview data
   */
  async getRevenueOverview(authorId, options = {}) {
    try {
      const { startDate, endDate } = options;

      // Get author's stories
      const authorStories = await Story.find({
        author_id: authorId,
        approval_status: 'approved'
      }).select('_id name');

      const storyIds = authorStories.map(story => story._id);

      if (storyIds.length === 0) {
        return this._getEmptyOverview();
      }

      // Build date filter
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      // Use Transaction model instead of UserPurchases for more reliable data
      const transactionFilter = {
        type: 'purchase',
        status: 'completed',
        $or: [
          { reference_type: 'story', reference_id: { $in: storyIds } },
          { reference_type: 'chapter', 'metadata.story_id': { $in: storyIds.map(id => id.toString()) } }
        ]
      };

      // Add date filter if provided
      if (Object.keys(dateFilter).length > 0) {
        transactionFilter.transaction_date = dateFilter;
      }

      // Get transactions for revenue calculation
      const transactions = await Transaction.find(transactionFilter)
        .populate('reference_id', 'name slug chapter')
        .populate('user_id', 'name email')
        .sort({ transaction_date: -1 });

      console.log(`[RevenueService] Found ${transactions.length} transactions for author ${authorId}`);

      // Calculate revenue metrics from transactions
      const metrics = this._calculateRevenueMetricsFromTransactions(transactions, storyIds);

      // Get revenue trends
      const trends = await this._getRevenueTrends(storyIds, dateFilter);

      // Get top performing stories
      const topStories = await this._getTopPerformingStories(storyIds, dateFilter);

      return {
        ...metrics,
        trends,
        topStories,
        totalStories: authorStories.length
      };

    } catch (error) {
      console.error('Error getting revenue overview:', error);
      throw error;
    }
  }

  /**
   * Get revenue details for a specific story
   * @param {string} authorId - Author ID
   * @param {string} storyId - Story ID
   * @param {Object} options - Query options
   * @returns {Object} Story revenue details
   */
  async getStoryRevenue(authorId, storyId, options = {}) {
    try {
      // Verify story ownership
      const story = await Story.findOne({ 
        _id: storyId, 
        author_id: authorId,
        approval_status: 'approved'
      }).populate('categories', 'name');

      if (!story) {
        throw new Error('Story not found or access denied');
      }

      const { startDate, endDate } = options;
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      // Get story purchases
      const storyPurchaseFilter = {
        'purchasedStories.story_id': storyId
      };
      
      if (Object.keys(dateFilter).length > 0) {
        storyPurchaseFilter['purchasedStories.purchase_date'] = dateFilter;
      }

      const storyPurchases = await UserPurchases.find(storyPurchaseFilter);

      // Get chapter purchases
      const chapterPurchaseFilter = {
        'purchasedChapters.story_id': storyId
      };
      
      if (Object.keys(dateFilter).length > 0) {
        chapterPurchaseFilter['purchasedChapters.purchase_date'] = dateFilter;
      }

      const chapterPurchases = await UserPurchases.find(chapterPurchaseFilter);

      // Calculate story-specific metrics
      const storyMetrics = this._calculateStoryMetrics(story, storyPurchases, chapterPurchases, dateFilter);
      
      // Get chapter breakdown
      const chapterBreakdown = await this._getChapterBreakdown(storyId, chapterPurchases, dateFilter);
      
      // Get buyer demographics
      const buyerDemographics = await this._getBuyerDemographics(storyId, [...storyPurchases, ...chapterPurchases]);

      return {
        story: {
          _id: story._id,
          name: story.name,
          slug: story.slug,
          image: story.image,
          categories: story.categories,
          isPaid: story.isPaid,
          price: story.price,
          hasPaidChapters: story.hasPaidChapters
        },
        ...storyMetrics,
        chapterBreakdown,
        buyerDemographics
      };

    } catch (error) {
      console.error('Error getting story revenue:', error);
      throw error;
    }
  }

  /**
   * Get transaction history for an author
   * @param {string} authorId - Author ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated transaction history
   */
  async getTransactionHistory(authorId, options = {}) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        startDate, 
        endDate, 
        storyId, 
        transactionType 
      } = options;

      // Get author's stories
      const authorStories = await Story.find({ 
        author_id: authorId,
        approval_status: 'approved'
      }).select('_id');
      
      const storyIds = authorStories.map(story => story._id);
      
      if (storyIds.length === 0) {
        return {
          transactions: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalTransactions: 0,
            hasNext: false,
            hasPrev: false
          }
        };
      }

      // Build transaction filter
      const transactionFilter = {
        type: 'purchase',
        status: 'completed',
        $or: [
          { reference_type: 'story', reference_id: { $in: storyIds } },
          { reference_type: 'chapter', 'metadata.story_id': { $in: storyIds } }
        ]
      };

      // Add date filter
      if (startDate || endDate) {
        transactionFilter.transaction_date = {};
        if (startDate) transactionFilter.transaction_date.$gte = new Date(startDate);
        if (endDate) transactionFilter.transaction_date.$lte = new Date(endDate);
      }

      // Add story filter
      if (storyId) {
        transactionFilter.$or = [
          { reference_type: 'story', reference_id: storyId },
          { reference_type: 'chapter', 'metadata.story_id': storyId }
        ];
      }

      // Add transaction type filter
      if (transactionType) {
        transactionFilter.reference_type = transactionType;
      }

      // Get total count
      const totalTransactions = await Transaction.countDocuments(transactionFilter);
      
      // Get paginated transactions
      const transactions = await Transaction.find(transactionFilter)
        .populate('user_id', 'name email avatar')
        .populate('reference_id', 'name slug chapter')
        .sort({ transaction_date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Enhance transaction data
      const enhancedTransactions = await this._enhanceTransactionData(transactions);

      const totalPages = Math.ceil(totalTransactions / limit);

      return {
        transactions: enhancedTransactions,
        pagination: {
          currentPage: page,
          totalPages,
          totalTransactions,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }

  /**
   * Calculate revenue metrics from transactions
   * @private
   */
  _calculateRevenueMetricsFromTransactions(transactions, storyIds) {
    let totalRevenue = 0;
    let storyRevenue = 0;
    let chapterRevenue = 0;
    let totalBuyers = new Set();
    let storyBuyers = new Set();
    let chapterBuyers = new Set();
    let totalTransactions = 0;

    transactions.forEach(transaction => {
      // Revenue is the absolute value of coin_change (since purchases are negative)
      const revenue = Math.abs(transaction.coin_change);

      totalRevenue += revenue;
      totalTransactions++;
      totalBuyers.add(transaction.user_id.toString());

      if (transaction.reference_type === 'story') {
        storyRevenue += revenue;
        storyBuyers.add(transaction.user_id.toString());
      } else if (transaction.reference_type === 'chapter') {
        chapterRevenue += revenue;
        chapterBuyers.add(transaction.user_id.toString());
      }
    });

    console.log(`[RevenueService] Calculated metrics: totalRevenue=${totalRevenue}, storyRevenue=${storyRevenue}, chapterRevenue=${chapterRevenue}, totalTransactions=${totalTransactions}`);

    return {
      totalRevenue,
      storyRevenue,
      chapterRevenue,
      totalBuyers: totalBuyers.size,
      storyBuyers: storyBuyers.size,
      chapterBuyers: chapterBuyers.size,
      totalTransactions,
      averageRevenuePerBuyer: totalBuyers.size > 0 ? totalRevenue / totalBuyers.size : 0
    };
  }

  /**
   * Calculate revenue metrics from purchases (legacy method)
   * @private
   */
  _calculateRevenueMetrics(purchases, storyIds, dateFilter) {
    let totalRevenue = 0;
    let storyRevenue = 0;
    let chapterRevenue = 0;
    let totalBuyers = new Set();
    let storyBuyers = new Set();
    let chapterBuyers = new Set();
    let totalTransactions = 0;

    purchases.forEach(userPurchase => {
      // Process story purchases
      userPurchase.purchasedStories.forEach(purchase => {
        if (storyIds.includes(purchase.story_id.toString())) {
          if (!dateFilter || this._isDateInRange(purchase.purchase_date, dateFilter)) {
            storyRevenue += purchase.price_paid;
            totalRevenue += purchase.price_paid;
            storyBuyers.add(userPurchase.user_id.toString());
            totalBuyers.add(userPurchase.user_id.toString());
            totalTransactions++;
          }
        }
      });

      // Process chapter purchases
      userPurchase.purchasedChapters.forEach(purchase => {
        if (storyIds.includes(purchase.story_id.toString())) {
          if (!dateFilter || this._isDateInRange(purchase.purchase_date, dateFilter)) {
            chapterRevenue += purchase.price_paid;
            totalRevenue += purchase.price_paid;
            chapterBuyers.add(userPurchase.user_id.toString());
            totalBuyers.add(userPurchase.user_id.toString());
            totalTransactions++;
          }
        }
      });
    });

    return {
      totalRevenue,
      storyRevenue,
      chapterRevenue,
      totalBuyers: totalBuyers.size,
      storyBuyers: storyBuyers.size,
      chapterBuyers: chapterBuyers.size,
      totalTransactions,
      averageRevenuePerBuyer: totalBuyers.size > 0 ? totalRevenue / totalBuyers.size : 0
    };
  }

  /**
   * Get revenue trends over time
   * @private
   */
  async _getRevenueTrends(storyIds, dateFilter) {
    try {
      // Default to last 30 days if no date filter
      const endDate = dateFilter.$lte || new Date();
      const startDate = dateFilter.$gte || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const pipeline = [
        {
          $match: {
            type: 'purchase',
            status: 'completed',
            transaction_date: { $gte: startDate, $lte: endDate },
            $or: [
              { reference_type: 'story', reference_id: { $in: storyIds } },
              { reference_type: 'chapter', 'metadata.story_id': { $in: storyIds.map(id => id.toString()) } }
            ]
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$transaction_date' },
              month: { $month: '$transaction_date' },
              day: { $dayOfMonth: '$transaction_date' }
            },
            revenue: { $sum: { $abs: '$coin_change' } },
            transactions: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
        }
      ];

      const trends = await Transaction.aggregate(pipeline);

      console.log(`[RevenueService] Found ${trends.length} trend data points`);

      return trends.map(trend => ({
        date: new Date(trend._id.year, trend._id.month - 1, trend._id.day),
        revenue: trend.revenue,
        transactions: trend.transactions
      }));

    } catch (error) {
      console.error('Error getting revenue trends:', error);
      return [];
    }
  }

  /**
   * Get empty overview for authors with no stories
   * @private
   */
  _getEmptyOverview() {
    return {
      totalRevenue: 0,
      storyRevenue: 0,
      chapterRevenue: 0,
      totalBuyers: 0,
      storyBuyers: 0,
      chapterBuyers: 0,
      totalTransactions: 0,
      averageRevenuePerBuyer: 0,
      trends: [],
      topStories: [],
      totalStories: 0
    };
  }

  /**
   * Get top performing stories
   * @private
   */
  async _getTopPerformingStories(storyIds, dateFilter) {
    try {
      const pipeline = [
        {
          $match: {
            type: 'purchase',
            status: 'completed',
            $or: [
              { reference_type: 'story', reference_id: { $in: storyIds } },
              { reference_type: 'chapter', 'metadata.story_id': { $in: storyIds.map(id => id.toString()) } }
            ]
          }
        }
      ];

      // Add date filter if provided
      if (Object.keys(dateFilter).length > 0) {
        pipeline[0].$match.transaction_date = dateFilter;
      }

      pipeline.push(
        {
          $addFields: {
            storyId: {
              $cond: [
                { $eq: ['$reference_type', 'story'] },
                '$reference_id',
                { $toObjectId: '$metadata.story_id' }
              ]
            }
          }
        },
        {
          $group: {
            _id: '$storyId',
            revenue: { $sum: { $abs: '$coin_change' } },
            transactions: { $sum: 1 }
          }
        },
        {
          $sort: { revenue: -1 }
        },
        {
          $limit: 10
        }
      );

      const topStories = await Transaction.aggregate(pipeline);

      console.log(`[RevenueService] Found ${topStories.length} top performing stories`);

      // Populate story details
      const storyDetails = await Story.find({
        _id: { $in: topStories.map(s => s._id) }
      }).select('name slug image isPaid price');

      return topStories.map(story => {
        const storyDetail = storyDetails.find(s => s._id.toString() === story._id.toString());
        return {
          story: storyDetail || { _id: story._id, name: 'Unknown Story', slug: '', image: '', isPaid: false, price: 0 },
          revenue: story.revenue,
          transactions: story.transactions
        };
      });

    } catch (error) {
      console.error('Error getting top performing stories:', error);
      return [];
    }
  }

  /**
   * Calculate story-specific metrics
   * @private
   */
  _calculateStoryMetrics(story, storyPurchases, chapterPurchases, dateFilter) {
    let storyRevenue = 0;
    let chapterRevenue = 0;
    let storyBuyers = new Set();
    let chapterBuyers = new Set();
    let storyTransactions = 0;
    let chapterTransactions = 0;

    // Process story purchases
    storyPurchases.forEach(userPurchase => {
      userPurchase.purchasedStories.forEach(purchase => {
        if (purchase.story_id.toString() === story._id.toString()) {
          if (!dateFilter || this._isDateInRange(purchase.purchase_date, dateFilter)) {
            storyRevenue += purchase.price_paid;
            storyBuyers.add(userPurchase.user_id.toString());
            storyTransactions++;
          }
        }
      });
    });

    // Process chapter purchases
    chapterPurchases.forEach(userPurchase => {
      userPurchase.purchasedChapters.forEach(purchase => {
        if (purchase.story_id.toString() === story._id.toString()) {
          if (!dateFilter || this._isDateInRange(purchase.purchase_date, dateFilter)) {
            chapterRevenue += purchase.price_paid;
            chapterBuyers.add(userPurchase.user_id.toString());
            chapterTransactions++;
          }
        }
      });
    });

    const totalRevenue = storyRevenue + chapterRevenue;
    const totalBuyers = new Set([...storyBuyers, ...chapterBuyers]);

    return {
      totalRevenue,
      storyRevenue,
      chapterRevenue,
      totalBuyers: totalBuyers.size,
      storyBuyers: storyBuyers.size,
      chapterBuyers: chapterBuyers.size,
      totalTransactions: storyTransactions + chapterTransactions,
      storyTransactions,
      chapterTransactions,
      averageRevenuePerBuyer: totalBuyers.size > 0 ? totalRevenue / totalBuyers.size : 0
    };
  }

  /**
   * Get chapter breakdown for a story
   * @private
   */
  async _getChapterBreakdown(storyId, chapterPurchases, dateFilter) {
    try {
      const chapterRevenue = new Map();
      const chapterBuyers = new Map();

      chapterPurchases.forEach(userPurchase => {
        userPurchase.purchasedChapters.forEach(purchase => {
          if (purchase.story_id.toString() === storyId.toString()) {
            if (!dateFilter || this._isDateInRange(purchase.purchase_date, dateFilter)) {
              const chapterId = purchase.chapter_id.toString();

              chapterRevenue.set(chapterId, (chapterRevenue.get(chapterId) || 0) + purchase.price_paid);

              if (!chapterBuyers.has(chapterId)) {
                chapterBuyers.set(chapterId, new Set());
              }
              chapterBuyers.get(chapterId).add(userPurchase.user_id.toString());
            }
          }
        });
      });

      // Get chapter details
      const chapterIds = Array.from(chapterRevenue.keys());
      const chapters = await Chapter.find({
        _id: { $in: chapterIds }
      }).select('chapter name slug isPaid price').sort({ chapter: 1 });

      return chapters.map(chapter => ({
        chapter: {
          _id: chapter._id,
          chapter: chapter.chapter,
          name: chapter.name,
          slug: chapter.slug,
          isPaid: chapter.isPaid,
          price: chapter.price
        },
        revenue: chapterRevenue.get(chapter._id.toString()) || 0,
        buyers: chapterBuyers.get(chapter._id.toString())?.size || 0
      }));

    } catch (error) {
      console.error('Error getting chapter breakdown:', error);
      return [];
    }
  }

  /**
   * Get buyer demographics
   * @private
   */
  async _getBuyerDemographics(storyId, purchases) {
    try {
      const buyerStats = new Map();
      const uniqueBuyers = new Set();

      purchases.forEach(userPurchase => {
        const userId = userPurchase.user_id.toString();
        uniqueBuyers.add(userId);

        if (!buyerStats.has(userId)) {
          buyerStats.set(userId, {
            storyPurchases: 0,
            chapterPurchases: 0,
            totalSpent: 0
          });
        }

        const stats = buyerStats.get(userId);

        // Count story purchases
        userPurchase.purchasedStories.forEach(purchase => {
          if (purchase.story_id.toString() === storyId.toString()) {
            stats.storyPurchases++;
            stats.totalSpent += purchase.price_paid;
          }
        });

        // Count chapter purchases
        userPurchase.purchasedChapters.forEach(purchase => {
          if (purchase.story_id.toString() === storyId.toString()) {
            stats.chapterPurchases++;
            stats.totalSpent += purchase.price_paid;
          }
        });
      });

      // Calculate demographics
      const totalBuyers = uniqueBuyers.size;
      const repeatCustomers = Array.from(buyerStats.values()).filter(
        stats => (stats.storyPurchases + stats.chapterPurchases) > 1
      ).length;

      const spendingRanges = {
        low: 0,    // < 10,000 coins
        medium: 0, // 10,000 - 50,000 coins
        high: 0    // > 50,000 coins
      };

      buyerStats.forEach(stats => {
        if (stats.totalSpent < 10000) {
          spendingRanges.low++;
        } else if (stats.totalSpent <= 50000) {
          spendingRanges.medium++;
        } else {
          spendingRanges.high++;
        }
      });

      return {
        totalBuyers,
        repeatCustomers,
        repeatCustomerRate: totalBuyers > 0 ? (repeatCustomers / totalBuyers) * 100 : 0,
        spendingRanges
      };

    } catch (error) {
      console.error('Error getting buyer demographics:', error);
      return {
        totalBuyers: 0,
        repeatCustomers: 0,
        repeatCustomerRate: 0,
        spendingRanges: { low: 0, medium: 0, high: 0 }
      };
    }
  }

  /**
   * Enhance transaction data with additional info
   * @private
   */
  async _enhanceTransactionData(transactions) {
    return transactions.map(transaction => {
      const enhanced = { ...transaction };

      // Add readable transaction type
      enhanced.readableType = transaction.reference_type === 'story' ? 'Mua truyện' : 'Mua chapter';

      // Add amount (absolute value of coin_change)
      enhanced.amount = Math.abs(transaction.coin_change);

      // Add buyer info
      enhanced.buyer = {
        _id: transaction.user_id._id,
        name: transaction.user_id.name,
        email: transaction.user_id.email,
        avatar: transaction.user_id.avatar
      };

      // Add content info
      if (transaction.reference_id) {
        enhanced.content = {
          _id: transaction.reference_id._id,
          name: transaction.reference_id.name,
          slug: transaction.reference_id.slug
        };

        if (transaction.reference_type === 'chapter') {
          enhanced.content.chapter = transaction.reference_id.chapter;
        }
      }

      return enhanced;
    });
  }

  /**
   * Check if date is in range
   * @private
   */
  _isDateInRange(date, dateFilter) {
    if (dateFilter.$gte && date < dateFilter.$gte) return false;
    if (dateFilter.$lte && date > dateFilter.$lte) return false;
    return true;
  }
}

module.exports = new RevenueService();
