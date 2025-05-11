const transactionService = require('../../services/transaction/transactionService');

/**
 * Controller xử lý các chức năng cơ bản của giao dịch
 */
class TransactionBaseController {
  /**
   * Lấy tất cả giao dịch
   */
  async getAll(req, res) {
    try {
      const userId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.role : null;
      const result = await transactionService.getAll(req.query, userId, userRole);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  /**
   * Lấy thông tin giao dịch theo ID
   */
  async getById(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized. User information is required.'
        });
      }

      const result = await transactionService.getById(
        req.params.id, 
        req.user.id, 
        req.user.role
      );
      
      res.json(result);
    } catch (err) {
      const statusCode = 
        err.message === 'Transaction not found' ? 404 : 
        err.message.includes('permission') ? 403 : 500;
        
      res.status(statusCode).json({
        success: false,
        error: err.message
      });
    }
  }

  /**
   * Tạo mới giao dịch
   */
  async create(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized. User information is required.'
        });
      }

      const result = await transactionService.create(req.body, req.user.id);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({
        success: false,
        error: err.message
      });
    }
  }

  /**
   * Cập nhật thông tin giao dịch
   */
  async update(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized. User information is required.'
        });
      }

      const result = await transactionService.update(
        req.params.id, 
        req.body, 
        req.user.role
      );
      
      res.json(result);
    } catch (err) {
      const statusCode = 
        err.message === 'Transaction not found' ? 404 : 
        err.message.includes('administrators') ? 403 : 400;
        
      res.status(statusCode).json({
        success: false,
        error: err.message
      });
    }
  }

  /**
   * Xóa giao dịch
   */
  async remove(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized. User information is required.'
        });
      }

      const result = await transactionService.remove(
        req.params.id, 
        req.user.role
      );
      
      res.json(result);
    } catch (err) {
      const statusCode = 
        err.message === 'Transaction not found' ? 404 : 
        err.message.includes('administrators') ? 403 : 500;
        
      res.status(statusCode).json({
        success: false,
        error: err.message
      });
    }
  }
}

module.exports = new TransactionBaseController(); 