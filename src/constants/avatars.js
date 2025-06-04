/**
 * Avatar constants for the backend application
 * Centralized management of default avatars
 */

// Avatar mặc định cho tài khoản đăng ký bằng email
const DEFAULT_EMAIL_AVATAR = '/images/default-avatar.png.webp';

// Avatar fallback khi có lỗi load ảnh - sử dụng avatar mặc định local
const FALLBACK_AVATAR = '/images/default-avatar.png.webp';

/**
 * Lấy avatar phù hợp dựa trên loại tài khoản và avatar hiện tại
 * @param {string|null} avatar - Avatar hiện tại của user
 * @param {string} accountType - Loại tài khoản ('email' | 'google')
 * @returns {string} URL avatar phù hợp
 */
const getAvatarUrl = (avatar, accountType) => {
  // Nếu có avatar, sử dụng avatar đó
  if (avatar) {
    return avatar;
  }

  // Nếu không có avatar:
  // - Tài khoản email: sử dụng avatar mặc định mới
  // - Tài khoản Google: sử dụng fallback avatar (trường hợp hiếm khi Google không cung cấp avatar)
  if (accountType === 'email') {
    return DEFAULT_EMAIL_AVATAR;
  }

  return FALLBACK_AVATAR;
};

/**
 * Kiểm tra xem avatar có phải là avatar mặc định không
 * @param {string|null} avatar - URL avatar cần kiểm tra
 * @returns {boolean} true nếu là avatar mặc định
 */
const isDefaultAvatar = (avatar) => {
  return avatar === DEFAULT_EMAIL_AVATAR || avatar === FALLBACK_AVATAR;
};

module.exports = {
  DEFAULT_EMAIL_AVATAR,
  FALLBACK_AVATAR,
  getAvatarUrl,
  isDefaultAvatar
};
