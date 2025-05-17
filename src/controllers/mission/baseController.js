/**
 * Controller cơ bản cho Mission
 * Xử lý các thao tác CRUD cơ bản
 */
const Mission = require('../../models/mission');
const { handleError } = require('../../utils/errorHandler');
const { validateMission } = require('../../validators/missionValidator');

/**
 * Lấy danh sách tất cả nhiệm vụ với phân trang và lọc
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getAll = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      rarity, 
      status, 
      sort = 'order', 
      order = 'asc',
      search
    } = req.query;

    // Xây dựng query
    const query = {};
    
    // Lọc theo loại
    if (type) {
      query.type = type;
    }
    
    // Lọc theo độ hiếm
    if (rarity) {
      query.rarity = rarity;
    }
    
    // Lọc theo trạng thái
    if (status !== undefined) {
      query.status = status === 'true';
    }
    
    // Tìm kiếm theo tên
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    // Tính toán skip cho phân trang
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Xây dựng sort
    const sortOptions = {};
    sortOptions[sort] = order === 'desc' ? -1 : 1;
    
    // Thực hiện query
    const missions = await Mission.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Đếm tổng số nhiệm vụ
    const total = await Mission.countDocuments(query);
    
    // Tính tổng số trang
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.json({
      success: true,
      items: missions,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages
    });
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Lấy thông tin một nhiệm vụ theo ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const mission = await Mission.findById(id);
    
    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhiệm vụ'
      });
    }
    
    res.json({
      success: true,
      mission
    });
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Tạo nhiệm vụ mới
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const create = async (req, res) => {
  try {
    // Validate dữ liệu đầu vào
    const { error, value } = validateMission(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }
    
    // Tạo nhiệm vụ mới
    const mission = new Mission(value);
    
    // Lưu vào database
    await mission.save();
    
    res.status(201).json({
      success: true,
      message: 'Tạo nhiệm vụ thành công',
      mission
    });
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Cập nhật thông tin nhiệm vụ
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate dữ liệu đầu vào
    const { error, value } = validateMission(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }
    
    // Cập nhật nhiệm vụ
    const mission = await Mission.findByIdAndUpdate(
      id,
      { $set: value },
      { new: true, runValidators: true }
    );
    
    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhiệm vụ'
      });
    }
    
    res.json({
      success: true,
      message: 'Cập nhật nhiệm vụ thành công',
      mission
    });
  } catch (error) {
    handleError(res, error);
  }
};

/**
 * Xóa nhiệm vụ
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    
    const mission = await Mission.findByIdAndDelete(id);
    
    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhiệm vụ'
      });
    }
    
    res.json({
      success: true,
      message: 'Xóa nhiệm vụ thành công'
    });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};
