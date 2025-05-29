/**
 * Avatar constants for the backend application
 * Centralized management of default avatars
 */

// Avatar mặc định cho tài khoản đăng ký bằng email
const DEFAULT_EMAIL_AVATAR = '/images/default-avatar.png.webp';

// Avatar fallback khi có lỗi load ảnh
const FALLBACK_AVATAR = 'https://scontent.fhan14-1.fna.fbcdn.net/v/t1.30497-1/453178253_471506465671661_2781666950760530985_n.png?stp=dst-png_s200x200&_nc_cat=1&ccb=1-7&_nc_sid=136b72&_nc_eui2=AeEVh0QX00TsNbI_haYB6RkWWt9TLzuBU1Ba31MvO4FTUF6Wlqf82r4BlCRAvh76aT3XsemaZbZv1fSB6o0CuFyz&_nc_ohc=Py8_nbWK5EEQ7kNvwGsqdUg&_nc_oc=AdnI1l-iLBtmCS_HEGsSqRjBSwsEa7c2UqgE5xPauCK2NBbd3kafOH_SABtbbISIdl6NeB79axebfe0e8MZgqmPe&_nc_zt=24&_nc_ht=scontent.fhan14-1.fna&oh=00_AfEDQng6NcDapZJFJ_Rjx-l97NT-NKumwkUgVLnP-cH5Fg&oe=683150FA';

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
