/**
 * Avatar Migration Utilities
 * Handles migration from legacy string avatar data to proper object format
 */

/**
 * Migrate legacy avatar data to new object format
 * @param {string|object|null} avatarData - Legacy avatar data
 * @returns {object|null} - Migrated avatar object or null
 */
function migrateAvatarData(avatarData) {
  if (!avatarData) {
    return null;
  }

  // If it's already an object with proper structure, return as-is
  if (typeof avatarData === 'object' && avatarData.primaryUrl !== undefined) {
    return {
      primaryUrl: avatarData.primaryUrl || '',
      variants: avatarData.variants || [],
      googleDriveId: avatarData.googleDriveId || '',
      lastUpdated: avatarData.lastUpdated ? new Date(avatarData.lastUpdated) : new Date(),
      metadata: avatarData.metadata || {}
    };
  }

  // If it's a string, handle different formats
  if (typeof avatarData === 'string') {
    // If it's a direct URL, create object structure
    if (avatarData.startsWith('http') || avatarData.startsWith('/') || avatarData.startsWith('data:')) {
      return {
        primaryUrl: avatarData,
        variants: [],
        googleDriveId: '',
        lastUpdated: new Date(),
        metadata: {}
      };
    }

    // Try to parse as JSON string (legacy format)
    try {
      const parsed = JSON.parse(avatarData);
      if (parsed && typeof parsed === 'object') {
        return {
          primaryUrl: parsed.primaryUrl || parsed.avatarUrl || '',
          variants: parsed.variants || parsed.sizes || [],
          googleDriveId: parsed.googleDriveId || '',
          lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated) : new Date(),
          metadata: parsed.metadata || {
            originalFilename: parsed.originalFilename,
            processedVariants: parsed.processedVariants,
            uploadedFiles: parsed.uploadedFiles
          }
        };
      }
    } catch (e) {
      console.warn('[migrateAvatarData] Failed to parse avatar JSON:', e.message);
      // If parsing fails but it looks like a URL, treat as URL
      if (avatarData.includes('http')) {
        return {
          primaryUrl: avatarData,
          variants: [],
          googleDriveId: '',
          lastUpdated: new Date(),
          metadata: {}
        };
      }
    }
  }

  // If we can't migrate, return null
  console.warn('[migrateAvatarData] Unable to migrate avatar data:', avatarData);
  return null;
}

/**
 * Migrate user document avatar data in-place
 * @param {object} userDoc - User document from MongoDB
 * @returns {object} - User document with migrated avatar data
 */
function migrateUserAvatarData(userDoc) {
  if (!userDoc) return userDoc;

  // Create a copy to avoid modifying original
  const migratedUser = { ...userDoc };

  // Migrate avatar data if it exists
  if (userDoc.avatar) {
    const migratedAvatar = migrateAvatarData(userDoc.avatar);
    migratedUser.avatar = migratedAvatar;
  }

  return migratedUser;
}

/**
 * Check if avatar data needs migration
 * @param {string|object|null} avatarData - Avatar data to check
 * @returns {boolean} - True if migration is needed
 */
function needsAvatarMigration(avatarData) {
  if (!avatarData) return false;

  // If it's a string, it needs migration
  if (typeof avatarData === 'string') {
    return true;
  }

  // If it's an object but missing required fields, it needs migration
  if (typeof avatarData === 'object') {
    return avatarData.primaryUrl === undefined;
  }

  return false;
}

/**
 * Batch migrate avatar data for multiple users
 * @param {array} users - Array of user documents
 * @returns {array} - Array of users with migrated avatar data
 */
function batchMigrateUserAvatars(users) {
  if (!Array.isArray(users)) return users;

  return users.map(user => migrateUserAvatarData(user));
}

/**
 * Extract avatar URL from various avatar data formats (for backward compatibility)
 * @param {string|object|null} avatarData - Avatar data
 * @returns {string} - Avatar URL
 */
function extractAvatarUrl(avatarData) {
  if (!avatarData) return '';

  // If it's an object with primaryUrl (new format)
  if (typeof avatarData === 'object' && avatarData.primaryUrl) {
    return avatarData.primaryUrl;
  }

  // If it's a string, handle legacy formats
  if (typeof avatarData === 'string') {
    // If it's a direct URL, return it
    if (avatarData.startsWith('http') || avatarData.startsWith('/') || avatarData.startsWith('data:')) {
      return avatarData;
    }

    // Try to parse as JSON string (legacy format)
    try {
      const parsed = JSON.parse(avatarData);
      if (parsed && typeof parsed === 'object') {
        return parsed.primaryUrl || parsed.avatarUrl || '';
      }
    } catch (e) {
      // If parsing fails, treat as URL anyway
      return avatarData;
    }

    return avatarData;
  }

  return '';
}

module.exports = {
  migrateAvatarData,
  migrateUserAvatarData,
  needsAvatarMigration,
  batchMigrateUserAvatars,
  extractAvatarUrl
};
