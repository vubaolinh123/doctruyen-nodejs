/**
 * Comment Quote Utilities
 * Handles quote generation for Level 3 -> Level 2 comment conversion
 */

/**
 * Truncate text to specified length with proper Vietnamese character handling
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default: 50)
 * @returns {string} - Truncated text with "..." if needed
 */
function truncateText(text, maxLength = 50) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove extra whitespace and normalize
  const cleanText = text.trim().replace(/\s+/g, ' ');
  
  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  // Find the last space before maxLength to avoid cutting words
  let truncateAt = maxLength;
  const lastSpaceIndex = cleanText.lastIndexOf(' ', maxLength - 3); // -3 for "..."
  
  if (lastSpaceIndex > maxLength * 0.7) { // Only use space if it's not too far back
    truncateAt = lastSpaceIndex;
  } else {
    truncateAt = maxLength - 3;
  }

  return cleanText.substring(0, truncateAt) + '...';
}

/**
 * Generate quote text for a comment
 * @param {Object} quotedComment - The comment being quoted
 * @param {Object} quotedUser - The user who wrote the quoted comment
 * @returns {Object} - Quote data object
 */
function generateQuoteData(quotedComment, quotedUser) {
  if (!quotedComment || !quotedUser) {
    throw new Error('Quoted comment and user are required');
  }

  const originalText = quotedComment.content?.original || '';
  const username = quotedUser.name || quotedUser.username || 'Unknown User';
  
  // Generate truncated quote text
  const quotedText = truncateText(originalText, 50);
  
  return {
    quoted_comment_id: quotedComment._id,
    quoted_username: username,
    quoted_text: quotedText,
    quoted_full_text: originalText,
    is_level_conversion: true
  };
}

/**
 * Format quote text for display in comment content
 * @param {string} username - Username of quoted comment author
 * @param {string} quotedText - Truncated quoted text
 * @param {string} newContent - New comment content
 * @returns {string} - Formatted comment with quote
 */
function formatQuotedComment(username, quotedText, newContent) {
  if (!username || !quotedText) {
    return newContent || '';
  }

  const quotePrefix = `"@${username}: ${quotedText}"`;
  
  if (!newContent || newContent.trim() === '') {
    return quotePrefix;
  }

  return `${quotePrefix}\n\n${newContent.trim()}`;
}

/**
 * Extract quote information from comment content
 * @param {string} content - Comment content that may contain a quote
 * @returns {Object|null} - Extracted quote info or null if no quote found
 */
function extractQuoteFromContent(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  // Pattern to match: "@username: quoted text..."
  const quotePattern = /^"@([^:]+):\s*(.+?)"\s*\n?\n?(.*)$/s;
  const match = content.match(quotePattern);

  if (!match) {
    return null;
  }

  return {
    username: match[1].trim(),
    quotedText: match[2].trim(),
    remainingContent: match[3].trim()
  };
}

/**
 * Validate quote data
 * @param {Object} quoteData - Quote data to validate
 * @returns {boolean} - True if valid
 */
function validateQuoteData(quoteData) {
  if (!quoteData || typeof quoteData !== 'object') {
    return false;
  }

  const required = ['quoted_comment_id', 'quoted_username', 'quoted_text'];
  return required.every(field => quoteData[field] && quoteData[field].toString().trim() !== '');
}

/**
 * Check if a comment should be converted from Level 3 to Level 2 with quote
 * @param {number} targetLevel - The level the comment would be at
 * @param {Object} parentComment - The parent comment
 * @returns {boolean} - True if conversion is needed
 */
function shouldConvertToQuotedReply(targetLevel, parentComment) {
  // Convert Level 3 comments to Level 2 with quote
  if (targetLevel >= 3) {
    return true;
  }

  // Also convert if parent is already at max level
  if (parentComment && parentComment.hierarchy?.level >= 2) {
    return true;
  }

  return false;
}

/**
 * Get the appropriate parent for a quoted reply
 * @param {Object} originalParent - The comment being replied to
 * @param {Object} Comment - Comment model for database queries
 * @returns {Promise<Object>} - The appropriate parent comment (Level 1)
 */
async function getQuotedReplyParent(originalParent, Comment) {
  if (!originalParent) {
    throw new Error('Original parent comment is required');
  }

  // If original parent is Level 1, use it as parent
  if (originalParent.hierarchy?.level === 1) {
    return originalParent;
  }

  // If original parent is Level 2, find its Level 1 parent
  if (originalParent.hierarchy?.level === 2 && originalParent.hierarchy?.parent_id) {
    const level1Parent = await Comment.findById(originalParent.hierarchy.parent_id);
    if (level1Parent && level1Parent.hierarchy?.level === 1) {
      return level1Parent;
    }
  }

  // If original parent is Level 0 (root), it becomes the parent
  if (originalParent.hierarchy?.level === 0) {
    return originalParent;
  }

  // Fallback: find root comment
  if (originalParent.hierarchy?.root_id) {
    const rootComment = await Comment.findById(originalParent.hierarchy.root_id);
    if (rootComment) {
      return rootComment;
    }
  }

  throw new Error('Unable to determine appropriate parent for quoted reply');
}

/**
 * Clean quote text for safe storage
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
function cleanQuoteText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .trim()
    .replace(/[\r\n\t]+/g, ' ') // Replace line breaks and tabs with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .replace(/[<>]/g, '') // Remove potential HTML brackets
    .substring(0, 2000); // Ensure it doesn't exceed max length
}

module.exports = {
  truncateText,
  generateQuoteData,
  formatQuotedComment,
  extractQuoteFromContent,
  validateQuoteData,
  shouldConvertToQuotedReply,
  getQuotedReplyParent,
  cleanQuoteText
};
