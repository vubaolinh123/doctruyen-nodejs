const apiLogger = (req, res, next) => {
  // Lưu thời gian bắt đầu
  const start = Date.now();

  // Lưu hàm gốc của res.json
  const originalJson = res.json;

  // Ghi đè hàm res.json để bắt response
  res.json = function (body) {
    // Tính thời gian xử lý
    const duration = Date.now() - start;

    // Xác định màu và icon dựa trên status code
    let statusIcon = '✅';
    let methodColor = '\x1b[32m'; // Xanh lá
    let resetColor = '\x1b[0m';
    
    if (res.statusCode >= 400 && res.statusCode < 500) {
      statusIcon = '⚠️';
      methodColor = '\x1b[33m'; // Vàng
    } else if (res.statusCode >= 500) {
      statusIcon = '❌';
      methodColor = '\x1b[31m'; // Đỏ
    }

    // Format log để hiển thị rõ ràng: METHOD URL STATUS
    console.log(
      `${methodColor}${req.method}${resetColor} ${req.originalUrl} ${statusIcon} [${res.statusCode}] - ${duration}ms`
    );
    
    // Nếu có lỗi, hiển thị thông tin lỗi
    if (res.statusCode >= 400 && body && (body.error || body.message)) {
      console.error(`Error details: ${JSON.stringify(body.error || body.message)}`);
    }

    // Gọi hàm gốc
    return originalJson.call(this, body);
  };

  next();
};

module.exports = apiLogger; 