const SeoConfig = require('../models/seoConfig');

/**
 * Lấy cấu hình SEO
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getSeoConfig = async (req, res) => {
  try {
    // Lấy cấu hình SEO từ database
    let seoConfig = await SeoConfig.findOne();
    
    // Nếu không có cấu hình, tạo cấu hình mặc định
    if (!seoConfig) {
      const defaultConfig = {
        title: 'Đọc Truyện',
        titleTemplate: '%s | Đọc Truyện',
        defaultTitle: 'Đọc Truyện',
        description: 'Website đọc truyện tranh online miễn phí, cập nhật nhanh nhất',
        canonical: process.env.APP_URL || 'https://comic.linkcualinh.com',
        openGraph: {
          type: 'website',
          locale: 'vi_VN',
          url: process.env.APP_URL || 'https://comic.linkcualinh.com',
          siteName: 'Đọc Truyện',
          title: 'Đọc Truyện',
          description: 'Website đọc truyện tranh online miễn phí, cập nhật nhanh nhất',
          images: [
            {
              url: `${process.env.APP_URL || 'https://comic.linkcualinh.com'}/images/og-image.jpg`,
              width: 1200,
              height: 630,
              alt: 'Đọc Truyện',
            },
          ],
        },
        twitter: {
          handle: '@doctruyen',
          site: '@doctruyen',
          cardType: 'summary_large_image',
        },
        additionalLinkTags: [
          {
            rel: 'icon',
            href: '/favicon.ico',
          },
          {
            rel: 'apple-touch-icon',
            href: '/apple-touch-icon.png',
            sizes: '180x180',
          },
          {
            rel: 'manifest',
            href: '/manifest.json',
          },
        ],
        additionalMetaTags: [
          {
            name: 'viewport',
            content: 'width=device-width, initial-scale=1',
          },
          {
            name: 'theme-color',
            content: '#32aaff',
          },
          {
            name: 'mobile-web-app-capable',
            content: 'yes',
          },
          {
            name: 'apple-mobile-web-app-status-bar-style',
            content: 'black-translucent',
          },
        ],
        robotsProps: {
          noindex: false,
          nofollow: false,
          nosnippet: false,
          noarchive: false,
          maxSnippet: -1,
          maxImagePreview: 'large',
          maxVideoPreview: -1,
        }
      };
      
      seoConfig = await SeoConfig.create(defaultConfig);
    }
    
    res.json({
      success: true,
      data: seoConfig
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * Cập nhật cấu hình SEO
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateSeoConfig = async (req, res) => {
  try {
    const { body } = req;
    
    // Lấy cấu hình SEO từ database
    let seoConfig = await SeoConfig.findOne();
    
    // Nếu không có cấu hình, tạo mới
    if (!seoConfig) {
      seoConfig = await SeoConfig.create(body);
    } else {
      // Cập nhật cấu hình
      Object.assign(seoConfig, body);
      await seoConfig.save();
    }
    
    res.json({
      success: true,
      data: seoConfig,
      message: 'Cập nhật cấu hình SEO thành công'
    });
  } catch (err) {
    console.error('[API] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
