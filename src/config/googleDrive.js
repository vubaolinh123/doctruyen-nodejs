/**
 * Google Drive Configuration
 * Cấu hình kết nối với Google Drive API
 */

const { google } = require('googleapis');

/**
 * Tạo Google Drive client
 */
const createDriveClient = () => {
  try {
    // Kiểm tra các biến môi trường cần thiết
    const requiredEnvVars = [
      'GOOGLE_CLIENT_EMAIL',
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_PROJECT_ID'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Tạo JWT client
    const jwtClient = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive']
    );

    // Tạo Drive client
    const drive = google.drive({
      version: 'v3',
      auth: jwtClient
    });

    return { drive, jwtClient };
  } catch (error) {
    console.error('Error creating Google Drive client:', error);
    throw error;
  }
};

/**
 * Kiểm tra xem có thể kết nối với Google Drive không
 */
const testDriveConnection = async () => {
  try {
    const { drive } = createDriveClient();
    
    // Test bằng cách list files (giới hạn 1 file)
    const response = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)'
    });

    console.log('✅ Google Drive connection successful');
    return true;
  } catch (error) {
    console.error('❌ Google Drive connection failed:', error.message);
    return false;
  }
};

/**
 * Lấy thông tin folder IDs từ environment variables
 */
const getFolderIds = () => {
  return {
    avatar: process.env.GOOGLE_DRIVE_AVATAR_FOLDER_ID || '',
    banner: process.env.GOOGLE_DRIVE_BANNER_FOLDER_ID || '',
    story: process.env.GOOGLE_DRIVE_STORY_FOLDER_ID || '',
    comic: process.env.GOOGLE_DRIVE_COMIC_FOLDER_ID || ''
  };
};

/**
 * Kiểm tra xem có cấu hình Google Drive hợp lệ không
 */
const hasValidGoogleCredentials = () => {
  const requiredEnvVars = [
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_PROJECT_ID'
  ];

  return requiredEnvVars.every(envVar => !!process.env[envVar]);
};

module.exports = {
  createDriveClient,
  testDriveConnection,
  getFolderIds,
  hasValidGoogleCredentials
};
