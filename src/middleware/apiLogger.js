const apiLogger = (req, res, next) => {
  // Lưu thời gian bắt đầu
  const start = Date.now();

  // Ghi log khi request đến
  console.log(`🌐 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);

  // Lưu hàm gốc của res.json
  const originalJson = res.json;

  // Ghi đè hàm res.json để bắt response
  res.json = function (body) {
    // Tính thời gian xử lý
    const duration = Date.now() - start;

    // Xác định icon dựa trên status code
    let icon = '⚠️';
    if (res.statusCode >= 200 && res.statusCode < 300) {
      icon = '✅';
    } else if (res.statusCode >= 400) {
      icon = '❌';
    }

    // Log response với status code và icon
    console.log(`${icon} [${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    
    // Nếu là lỗi, log thêm thông tin lỗi
    if (res.statusCode >= 400) {
      console.log(`❌ Error details:`, body);
    }

    // Gọi hàm gốc
    return originalJson.call(this, body);
  };

  next();
};

module.exports = apiLogger; 