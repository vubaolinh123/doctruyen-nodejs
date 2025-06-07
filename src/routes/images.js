/**
 * Image Upload Routes
 * Định nghĩa các routes cho image upload API
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
  uploadAvatarController,
  uploadBannerController,
  uploadStoryImageController,
  uploadComicPageController,
  uploadImageController,
  getImageStatsController,
  healthCheckController
} = require('../controllers/image/imageController');

const {
  cropBannerController
} = require('../controllers/image/bannerCropController');

const {
  uploadTempImage,
  serveTempImage,
  deleteTempImage,
  getTempImageInfo
} = require('../controllers/image/tempImageController');

// Import middleware
const { createImageUploadMiddleware } = require('../middleware/upload/uploadMiddleware');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     ImageUploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             primaryUrl:
 *               type: string
 *             variants:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   variant:
 *                     type: string
 *                   url:
 *                     type: string
 *                   size:
 *                     type: string
 */

/**
 * @swagger
 * /api/images/health:
 *   get:
 *     summary: Health check cho image service
 *     tags: [Images]
 *     responses:
 *       200:
 *         description: Service status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 services:
 *                   type: object
 */
router.get('/health', healthCheckController);

/**
 * @swagger
 * /api/images/stats:
 *   get:
 *     summary: Lấy thống kê image processing
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Image processing statistics
 */
router.get('/stats', authenticateToken, getImageStatsController);

/**
 * @swagger
 * /api/images/upload/avatar:
 *   post:
 *     summary: Upload avatar
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               oldImageUrl:
 *                 type: string
 *                 description: URL của ảnh cũ để xóa
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageUploadResponse'
 */
router.post('/upload/avatar', 
  authenticateToken,
  ...createImageUploadMiddleware('avatar'),
  uploadAvatarController
);

/**
 * @swagger
 * /api/images/upload/banner:
 *   post:
 *     summary: Upload banner
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               oldImageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Banner uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageUploadResponse'
 */
router.post('/upload/banner',
  authenticateToken,
  ...createImageUploadMiddleware('banner'),
  uploadBannerController
);

/**
 * @swagger
 * /api/images/crop/banner:
 *   post:
 *     summary: Crop banner based on position
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bannerUrl:
 *                 type: string
 *                 description: URL of the banner to crop
 *                 required: true
 *               yOffset:
 *                 type: number
 *                 description: Y offset in pixels for cropping
 *                 required: true
 *               containerHeight:
 *                 type: number
 *                 description: Height of the banner container
 *                 default: 450
 *               outputWidth:
 *                 type: number
 *                 description: Target width for cropped image
 *                 default: 1200
 *               outputHeight:
 *                 type: number
 *                 description: Target height for cropped image
 *                 default: 675
 *     responses:
 *       200:
 *         description: Banner cropped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     primaryUrl:
 *                       type: string
 *                     variants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           variant:
 *                             type: string
 *                           url:
 *                             type: string
 *                           size:
 *                             type: string
 *                     metadata:
 *                       type: object
 */
router.post('/crop/banner',
  authenticateToken,
  cropBannerController
);

/**
 * @swagger
 * /api/images/upload/story:
 *   post:
 *     summary: Upload story image
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               storyId:
 *                 type: string
 *                 required: true
 *               oldImageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Story image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageUploadResponse'
 */
router.post('/upload/story',
  authenticateToken,
  ...createImageUploadMiddleware('story'),
  uploadStoryImageController
);

/**
 * @swagger
 * /api/images/upload/comic:
 *   post:
 *     summary: Upload comic page
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               chapterId:
 *                 type: string
 *                 required: true
 *               oldImageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Comic page uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageUploadResponse'
 */
router.post('/upload/comic',
  authenticateToken,
  ...createImageUploadMiddleware('comic'),
  uploadComicPageController
);

/**
 * @swagger
 * /api/images/upload:
 *   post:
 *     summary: Generic image upload endpoint
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               imageType:
 *                 type: string
 *                 enum: [avatar, banner, story, comic]
 *                 required: true
 *               entityId:
 *                 type: string
 *                 description: ID của entity (storyId cho story, chapterId cho comic)
 *               oldImageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageUploadResponse'
 */
router.post('/upload',
  authenticateToken,
  // Sử dụng multer generic với size lớn nhất
  require('../middleware/upload/uploadMiddleware').uploadGeneric,
  require('../middleware/upload/uploadMiddleware').handleMulterError,
  // Sau đó validate và xử lý imageType
  (req, res, next) => {
    // Lấy imageType từ body sau khi multer đã parse
    const imageType = req.body.imageType;
    if (!imageType) {
      return res.status(400).json({
        success: false,
        error: 'imageType is required'
      });
    }

    // Validate imageType
    const allowedImageTypes = ['avatar', 'banner', 'story', 'comic'];
    if (!allowedImageTypes.includes(imageType)) {
      return res.status(400).json({
        success: false,
        error: 'Loại ảnh không hợp lệ. Chỉ chấp nhận: avatar, banner, story, comic'
      });
    }

    // Thêm imageType vào request
    req.imageType = imageType;

    // Log thông tin file để debug
    console.log('Generic upload - File info:', {
      originalname: req.file?.originalname,
      mimetype: req.file?.mimetype,
      size: req.file?.size,
      imageType: imageType,
      bodyKeys: Object.keys(req.body)
    });

    next();
  },
  uploadImageController
);

/**
 * @swagger
 * /api/images/upload/temp:
 *   post:
 *     summary: Upload image to temporary storage
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload temporarily
 *     responses:
 *       200:
 *         description: Image uploaded to temporary storage successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     tempId:
 *                       type: string
 *                     tempUrl:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     size:
 *                       type: number
 *                     mimetype:
 *                       type: string
 */
router.post('/upload/temp',
  authenticateToken,
  require('../middleware/upload/uploadMiddleware').uploadGeneric,
  require('../middleware/upload/uploadMiddleware').handleMulterError,
  uploadTempImage
);

/**
 * @swagger
 * /api/images/temp/{tempId}:
 *   get:
 *     summary: Serve temporary image
 *     tags: [Images]
 *     parameters:
 *       - in: path
 *         name: tempId
 *         required: true
 *         schema:
 *           type: string
 *         description: Temporary image ID
 *     responses:
 *       200:
 *         description: Temporary image file
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Temporary image not found or expired
 */
router.get('/temp/:tempId', serveTempImage);

/**
 * @swagger
 * /api/images/temp/{tempId}:
 *   delete:
 *     summary: Delete temporary image
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tempId
 *         required: true
 *         schema:
 *           type: string
 *         description: Temporary image ID
 *     responses:
 *       200:
 *         description: Temporary image deleted successfully
 *       404:
 *         description: Temporary image not found
 */
router.delete('/temp/:tempId', authenticateToken, deleteTempImage);

/**
 * @swagger
 * /api/images/temp/{tempId}/info:
 *   get:
 *     summary: Get temporary image information
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tempId
 *         required: true
 *         schema:
 *           type: string
 *         description: Temporary image ID
 *     responses:
 *       200:
 *         description: Temporary image information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     tempId:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     size:
 *                       type: number
 *                     mimetype:
 *                       type: string
 *                     uploadedAt:
 *                       type: string
 *                       format: date-time
 *                     userId:
 *                       type: string
 */
router.get('/temp/:tempId/info', authenticateToken, getTempImageInfo);

module.exports = router;
