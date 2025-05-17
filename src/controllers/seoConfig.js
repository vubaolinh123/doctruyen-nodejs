const SeoConfig = require('../models/seoConfig');

/**
 * Lấy cấu hình SEO
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getSeoConfig = async (req, res) => {
  try {
    console.log('[NodeJS API] Getting SEO config');

    // Đếm số lượng bản ghi SEO config
    const count = await SeoConfig.countDocuments();
    console.log('[NodeJS API] Found', count, 'SEO config records');

    // Lấy cấu hình SEO mới nhất từ database
    let seoConfig = await SeoConfig.findOne().sort({ updatedAt: -1 });

    if (seoConfig) {
      console.log('[NodeJS API] Found SEO config with ID:', seoConfig._id);
      console.log('[NodeJS API] SEO config title:', seoConfig.title);
      console.log('[NodeJS API] SEO config updatedAt:', seoConfig.updatedAt);
    }

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
    console.log('[NodeJS API] Received SEO update request');
    const { body } = req;
    console.log('[NodeJS API] Request body:', JSON.stringify(body).substring(0, 200) + '...');

    // Lấy cấu hình SEO từ database
    console.log('[NodeJS API] SeoConfig model:', SeoConfig.modelName);
    console.log('[NodeJS API] SeoConfig collection:', SeoConfig.collection.name);

    let seoConfig = await SeoConfig.findOne();
    console.log('[NodeJS API] Existing SEO config found:', !!seoConfig);

    // Nếu không có cấu hình, tạo mới
    if (!seoConfig) {
      try {
        console.log('[NodeJS API] Creating new SEO config');
        // Kiểm tra body có đầy đủ các trường bắt buộc không
        console.log('[NodeJS API] Body has required fields:',
          body.title ? 'title: Yes' : 'title: No',
          body.titleTemplate ? 'titleTemplate: Yes' : 'titleTemplate: No',
          body.defaultTitle ? 'defaultTitle: Yes' : 'defaultTitle: No',
          body.description ? 'description: Yes' : 'description: No',
          body.canonical ? 'canonical: Yes' : 'canonical: No'
        );

        // Tạo đối tượng mới với các trường bắt buộc
        const newConfig = {
          title: body.title || 'Đọc Truyện',
          titleTemplate: body.titleTemplate || '%s | Đọc Truyện',
          defaultTitle: body.defaultTitle || 'Đọc Truyện',
          description: body.description || 'Website đọc truyện tranh online miễn phí',
          canonical: body.canonical || 'https://comic.linkcualinh.com',
          openGraph: body.openGraph || {
            type: 'website',
            locale: 'vi_VN',
            url: 'https://comic.linkcualinh.com',
            siteName: 'Đọc Truyện',
            title: 'Đọc Truyện',
            description: 'Website đọc truyện tranh online miễn phí',
            images: [
              {
                url: 'https://comic.linkcualinh.com/images/og-image.jpg',
                width: 1200,
                height: 630,
                alt: 'Đọc Truyện',
              },
            ],
          },
          twitter: body.twitter || {
            handle: '@doctruyen',
            site: '@doctruyen',
            cardType: 'summary_large_image',
          },
          additionalLinkTags: body.additionalLinkTags || [
            {
              rel: 'icon',
              href: '/favicon.ico',
            }
          ],
          additionalMetaTags: body.additionalMetaTags || [
            {
              name: 'viewport',
              content: 'width=device-width, initial-scale=1',
            }
          ],
          robotsProps: body.robotsProps || {
            noindex: false,
            nofollow: false,
            nosnippet: false,
            noarchive: false,
            maxSnippet: -1,
            maxImagePreview: 'large',
            maxVideoPreview: -1,
          }
        };

        console.log('[NodeJS API] Creating with data:', JSON.stringify(newConfig).substring(0, 200) + '...');
        seoConfig = await SeoConfig.create(newConfig);
        console.log('[NodeJS API] New SEO config created with ID:', seoConfig._id);
      } catch (createError) {
        console.error('[NodeJS API] Error creating SEO config:', createError);
        throw createError;
      }
    } else {
      // Cập nhật cấu hình
      try {
        console.log('[NodeJS API] Updating existing SEO config with ID:', seoConfig._id);

        // Cập nhật từng trường một để tránh lỗi
        if (body.title) seoConfig.title = body.title;
        if (body.titleTemplate) seoConfig.titleTemplate = body.titleTemplate;
        if (body.defaultTitle) seoConfig.defaultTitle = body.defaultTitle;
        if (body.description) seoConfig.description = body.description;
        if (body.canonical) seoConfig.canonical = body.canonical;

        // Cập nhật openGraph
        if (body.openGraph) {
          if (!seoConfig.openGraph) seoConfig.openGraph = {};
          if (body.openGraph.type) seoConfig.openGraph.type = body.openGraph.type;
          if (body.openGraph.locale) seoConfig.openGraph.locale = body.openGraph.locale;
          if (body.openGraph.url) seoConfig.openGraph.url = body.openGraph.url;
          if (body.openGraph.siteName) seoConfig.openGraph.siteName = body.openGraph.siteName;
          if (body.openGraph.title) seoConfig.openGraph.title = body.openGraph.title;
          if (body.openGraph.description) seoConfig.openGraph.description = body.openGraph.description;
          if (body.openGraph.images) seoConfig.openGraph.images = body.openGraph.images;
        }

        // Cập nhật twitter
        if (body.twitter) {
          if (!seoConfig.twitter) seoConfig.twitter = {};
          if (body.twitter.handle) seoConfig.twitter.handle = body.twitter.handle;
          if (body.twitter.site) seoConfig.twitter.site = body.twitter.site;
          if (body.twitter.cardType) seoConfig.twitter.cardType = body.twitter.cardType;
        }

        // Cập nhật additionalLinkTags
        if (body.additionalLinkTags) {
          seoConfig.additionalLinkTags = body.additionalLinkTags;
        }

        // Cập nhật additionalMetaTags
        if (body.additionalMetaTags) {
          seoConfig.additionalMetaTags = body.additionalMetaTags;
        }

        // Cập nhật robotsProps
        if (body.robotsProps) {
          if (!seoConfig.robotsProps) seoConfig.robotsProps = {};
          if (body.robotsProps.noindex !== undefined) seoConfig.robotsProps.noindex = body.robotsProps.noindex;
          if (body.robotsProps.nofollow !== undefined) seoConfig.robotsProps.nofollow = body.robotsProps.nofollow;
          if (body.robotsProps.nosnippet !== undefined) seoConfig.robotsProps.nosnippet = body.robotsProps.nosnippet;
          if (body.robotsProps.noarchive !== undefined) seoConfig.robotsProps.noarchive = body.robotsProps.noarchive;
          if (body.robotsProps.maxSnippet !== undefined) seoConfig.robotsProps.maxSnippet = body.robotsProps.maxSnippet;
          if (body.robotsProps.maxImagePreview) seoConfig.robotsProps.maxImagePreview = body.robotsProps.maxImagePreview;
          if (body.robotsProps.maxVideoPreview !== undefined) seoConfig.robotsProps.maxVideoPreview = body.robotsProps.maxVideoPreview;
        }

        // Lưu cấu hình
        await seoConfig.save();
        console.log('[NodeJS API] SEO config updated successfully');
      } catch (updateError) {
        console.error('[NodeJS API] Error updating SEO config:', updateError);
        throw updateError;
      }
    }

    res.json({
      success: true,
      data: seoConfig,
      message: 'Cập nhật cấu hình SEO thành công'
    });
  } catch (err) {
    console.error('[NodeJS API] Error updating SEO config:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
