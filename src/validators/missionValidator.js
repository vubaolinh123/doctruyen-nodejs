/**
 * Validator cho Mission
 * Kiểm tra tính hợp lệ của dữ liệu đầu vào
 */
const Joi = require('joi');

/**
 * Validate dữ liệu nhiệm vụ
 * @param {Object} data - Dữ liệu cần validate
 * @returns {Object} - Kết quả validate
 */
const validateMission = (data) => {
  const schema = Joi.object({
    title: Joi.string().required().trim().min(3).max(100)
      .messages({
        'string.base': 'Tiêu đề phải là chuỗi',
        'string.empty': 'Tiêu đề không được để trống',
        'string.min': 'Tiêu đề phải có ít nhất {#limit} ký tự',
        'string.max': 'Tiêu đề không được vượt quá {#limit} ký tự',
        'any.required': 'Tiêu đề là bắt buộc'
      }),
    
    description: Joi.string().allow('').default('')
      .messages({
        'string.base': 'Mô tả phải là chuỗi'
      }),
    
    type: Joi.string().valid('daily', 'weekly').required()
      .messages({
        'string.base': 'Loại nhiệm vụ phải là chuỗi',
        'string.empty': 'Loại nhiệm vụ không được để trống',
        'any.only': 'Loại nhiệm vụ phải là "daily" hoặc "weekly"',
        'any.required': 'Loại nhiệm vụ là bắt buộc'
      }),
    
    rarity: Joi.string().valid('common', 'uncommon', 'rare', 'epic').default('common')
      .messages({
        'string.base': 'Độ hiếm phải là chuỗi',
        'any.only': 'Độ hiếm phải là "common", "uncommon", "rare" hoặc "epic"'
      }),
    
    requirement: Joi.object({
      type: Joi.string().valid('read_chapter', 'comment', 'attendance', 'view_story', 'rate_story', 'other').default('other')
        .messages({
          'string.base': 'Loại yêu cầu phải là chuỗi',
          'any.only': 'Loại yêu cầu không hợp lệ'
        }),
      
      count: Joi.number().integer().min(1).default(1)
        .messages({
          'number.base': 'Số lượng phải là số',
          'number.integer': 'Số lượng phải là số nguyên',
          'number.min': 'Số lượng phải lớn hơn hoặc bằng {#limit}'
        }),
      
      conditions: Joi.object().default({})
    }).default({
      type: 'other',
      count: 1,
      conditions: {}
    }),
    
    reward: Joi.object({
      coins: Joi.number().integer().min(0).default(0)
        .messages({
          'number.base': 'Số xu phải là số',
          'number.integer': 'Số xu phải là số nguyên',
          'number.min': 'Số xu không được âm'
        }),
      
      exp: Joi.number().integer().min(0).default(0)
        .messages({
          'number.base': 'Số điểm kinh nghiệm phải là số',
          'number.integer': 'Số điểm kinh nghiệm phải là số nguyên',
          'number.min': 'Số điểm kinh nghiệm không được âm'
        }),
      
      other: Joi.object().default({})
    }).default({
      coins: 0,
      exp: 0,
      other: {}
    }),
    
    subMissions: Joi.array().items(
      Joi.object({
        title: Joi.string().required().trim().min(3).max(100)
          .messages({
            'string.base': 'Tiêu đề nhiệm vụ con phải là chuỗi',
            'string.empty': 'Tiêu đề nhiệm vụ con không được để trống',
            'string.min': 'Tiêu đề nhiệm vụ con phải có ít nhất {#limit} ký tự',
            'string.max': 'Tiêu đề nhiệm vụ con không được vượt quá {#limit} ký tự',
            'any.required': 'Tiêu đề nhiệm vụ con là bắt buộc'
          }),
        
        description: Joi.string().allow('').default('')
          .messages({
            'string.base': 'Mô tả nhiệm vụ con phải là chuỗi'
          }),
        
        requirement: Joi.object({
          type: Joi.string().valid('read_chapter', 'comment', 'attendance', 'view_story', 'rate_story', 'other').default('other')
            .messages({
              'string.base': 'Loại yêu cầu nhiệm vụ con phải là chuỗi',
              'any.only': 'Loại yêu cầu nhiệm vụ con không hợp lệ'
            }),
          
          count: Joi.number().integer().min(1).default(1)
            .messages({
              'number.base': 'Số lượng nhiệm vụ con phải là số',
              'number.integer': 'Số lượng nhiệm vụ con phải là số nguyên',
              'number.min': 'Số lượng nhiệm vụ con phải lớn hơn hoặc bằng {#limit}'
            }),
          
          conditions: Joi.object().default({})
        }).default({
          type: 'other',
          count: 1,
          conditions: {}
        })
      })
    ).default([]),
    
    status: Joi.boolean().default(true)
      .messages({
        'boolean.base': 'Trạng thái phải là boolean'
      }),
    
    order: Joi.number().integer().default(0)
      .messages({
        'number.base': 'Thứ tự phải là số',
        'number.integer': 'Thứ tự phải là số nguyên'
      }),
    
    resetTime: Joi.object({
      hour: Joi.number().integer().min(0).max(23).default(0)
        .messages({
          'number.base': 'Giờ làm mới phải là số',
          'number.integer': 'Giờ làm mới phải là số nguyên',
          'number.min': 'Giờ làm mới phải từ 0 đến 23',
          'number.max': 'Giờ làm mới phải từ 0 đến 23'
        }),
      
      minute: Joi.number().integer().min(0).max(59).default(0)
        .messages({
          'number.base': 'Phút làm mới phải là số',
          'number.integer': 'Phút làm mới phải là số nguyên',
          'number.min': 'Phút làm mới phải từ 0 đến 59',
          'number.max': 'Phút làm mới phải từ 0 đến 59'
        }),
      
      dayOfWeek: Joi.number().integer().min(0).max(6).default(0)
        .messages({
          'number.base': 'Ngày trong tuần làm mới phải là số',
          'number.integer': 'Ngày trong tuần làm mới phải là số nguyên',
          'number.min': 'Ngày trong tuần làm mới phải từ 0 đến 6',
          'number.max': 'Ngày trong tuần làm mới phải từ 0 đến 6'
        })
    }).default({
      hour: 0,
      minute: 0,
      dayOfWeek: 0
    })
  });

  return schema.validate(data, { abortEarly: false, stripUnknown: true });
};

module.exports = {
  validateMission
};
