const mongoose = require('mongoose');
const { Schema } = mongoose;
const coinLogger = require('../utils/coinLogger');
const vietnamTimezonePlugin = require('../plugins/vietnamTimezone');

// Thêm phương thức getWeek cho Date để tính số tuần trong năm
Date.prototype.getWeek = function() {
  const date = new Date(this.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

/**
 * Schema cho giao dịch
 * Lưu thông tin các giao dịch xu/tiền của người dùng
 */
const transactionSchema = new Schema({
  // ID của người dùng
  customer_id: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },

  // Mã giao dịch
  transaction_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Mô tả giao dịch
  description: {
    type: String,
    default: ''
  },

  // Ngày giao dịch
  transaction_date: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Số xu tăng/giảm
  coin_change: {
    type: Number,
    default: 0
  },

  // Loại giao dịch
  type: {
    type: String,
    enum: ['attendance', 'purchase', 'reward', 'admin', 'refund', 'other', 'add', 'subtract', 'update'],
    default: 'other',
    index: true
  },

  // Hướng giao dịch (tăng/giảm)
  direction: {
    type: String,
    enum: ['in', 'out'],
    default: function() {
      return this.coin_change >= 0 ? 'in' : 'out';
    },
    index: true
  },

  // Số dư sau giao dịch
  balance_after: {
    type: Number,
    default: 0
  },

  // Trạng thái giao dịch
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed',
    index: true
  },

  // Tham chiếu đến đối tượng liên quan (nếu có)
  reference_type: {
    type: String,
    enum: ['story', 'chapter', 'attendance', 'other', ''],
    default: ''
  },

  reference_id: {
    type: Schema.Types.ObjectId,
    default: null
  },

  // Metadata bổ sung
  metadata: {
    type: Object,
    default: {}
  },

  // Trường tương thích ngược - sẽ loại bỏ trong tương lai
  customers_id: {
    type: Schema.Types.ObjectId,
    ref: 'Customer'
  },
  up_point: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tạo các index để tối ưu truy vấn
transactionSchema.index({ transaction_date: -1 });
transactionSchema.index({ customer_id: 1, transaction_date: -1 });
transactionSchema.index({ type: 1, transaction_date: -1 });

// Virtuals
transactionSchema.virtual('customer', {
  ref: 'Customer',
  localField: 'customer_id',
  foreignField: '_id',
  justOne: true
});

// Middleware pre-save để đảm bảo tương thích ngược
transactionSchema.pre('save', function(next) {
  // Đảm bảo customers_id luôn đồng bộ với customer_id
  if (this.customer_id && !this.customers_id) {
    this.customers_id = this.customer_id;
  } else if (this.customers_id && !this.customer_id) {
    this.customer_id = this.customers_id;
  }

  // Đảm bảo up_point luôn đồng bộ với coin_change
  if (this.coin_change !== undefined && this.up_point === undefined) {
    this.up_point = this.coin_change;
  } else if (this.up_point !== undefined && this.coin_change === undefined) {
    this.coin_change = this.up_point;
  }

  next();
});

// Phương thức tĩnh để tạo giao dịch mới
transactionSchema.statics.createTransaction = async function(data) {
  const {
    customer_id,
    description,
    type,
    coin_change,
    reference_type,
    reference_id,
    metadata,
    balance_after
  } = data;

  // Tạo mã giao dịch duy nhất với timestamp theo múi giờ Việt Nam
  const now = new Date();
  const transaction_id = `${type.toUpperCase()}_${now.getTime()}_${Math.floor(Math.random() * 1000)}`;

  // Xác định hướng giao dịch
  const direction = coin_change >= 0 ? 'in' : 'out';

  // Lấy số dư hiện tại nếu không được cung cấp
  let finalBalance = balance_after;
  if (finalBalance === undefined) {
    try {
      const Customer = mongoose.model('Customer');
      const customer = await Customer.findById(customer_id);
      if (customer) {
        finalBalance = customer.coin;
      }
    } catch (error) {
      console.error('Không thể lấy số dư hiện tại:', error);
    }
  }

  return this.create({
    customer_id,
    transaction_id,
    description,
    transaction_date: now, // Sử dụng biến now đã tạo ở trên với timezone Việt Nam
    coin_change,
    type,
    direction,
    balance_after: finalBalance || 0,
    status: 'completed',
    reference_type: reference_type || '',
    reference_id: reference_id || null,
    metadata: metadata || {},
    // Trường tương thích ngược
    customers_id: customer_id,
    up_point: coin_change
  });
};

// Phương thức tĩnh để lấy thống kê giao dịch xu
transactionSchema.statics.getCoinStats = async function(timeRange = 'all') {
  const now = new Date();
  let startDate;
  let query = {};

  // Xác định khoảng thời gian
  if (timeRange === 'day') {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    query = { transaction_date: { $gte: startDate } };
  } else if (timeRange === 'week') {
    // Lấy ngày đầu tuần (thứ 2)
    startDate = new Date(now);
    const day = startDate.getDay(); // 0 = CN, 1 = T2, ...
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);
    startDate.setHours(0, 0, 0, 0);
    query = { transaction_date: { $gte: startDate } };
  } else if (timeRange === 'month') {
    // Lấy ngày đầu tháng
    startDate = new Date(now);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    query = { transaction_date: { $gte: startDate } };

    // Chia tháng thành 4 tuần
    categories = ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'];
  } else if (timeRange === 'year') {
    startDate = new Date(now);
    startDate.setMonth(0, 1); // Ngày 1/1 năm hiện tại
    startDate.setHours(0, 0, 0, 0);
    query = { transaction_date: { $gte: startDate } };
  } else if (timeRange === 'all') {
    // Khi chọn 'all', không áp dụng bộ lọc thời gian
    query = {}; // Sẽ lấy tất cả giao dịch
    console.log("Lấy thống kê xu cho tất cả thời gian");
  }

  // Log thông tin khoảng thời gian
  if (timeRange !== 'all') {
    console.log(`Thống kê xu theo khoảng thời gian: ${timeRange}, từ ngày ${startDate.toISOString()}`);
  } else {
    console.log("Thống kê xu cho tất cả thời gian");
  }

  // Lấy tổng xu hiện tại từ tất cả khách hàng trong bảng Customer
  const Customer = mongoose.model('Customer');
  const totalCoinsAgg = await Customer.aggregate([
    {
      $group: {
        _id: null,
        totalCoins: { $sum: '$coin' },
        totalCoinTotal: { $sum: '$coin_total' },
        totalCoinSpent: { $sum: '$coin_spent' }
      }
    }
  ]);

  const totalCoins = totalCoinsAgg.length > 0 ? totalCoinsAgg[0].totalCoins : 0;
  const totalCoinTotal = totalCoinsAgg.length > 0 ? totalCoinsAgg[0].totalCoinTotal : 0;
  const totalCoinSpent = totalCoinsAgg.length > 0 ? totalCoinsAgg[0].totalCoinSpent : 0;

  // Kiểm tra xem có giao dịch nào trong cơ sở dữ liệu không
  const transactionCount = await this.countDocuments();
  console.log(`Tổng số giao dịch trong cơ sở dữ liệu: ${transactionCount}`);

  if (transactionCount === 0) {
    // Không có giao dịch nào, trả về dữ liệu mẫu
    return createSampleStats(timeRange, totalCoins);
  }

  // Debug: hiển thị một số giao dịch mẫu để kiểm tra
  const sampleTransactions = await this.find().limit(5).sort({ transaction_date: -1 });
  coinLogger.logTransactionDetails(sampleTransactions, "Mẫu giao dịch gần đây cho thống kê xu");

  // Tính tổng xu đã nhận và đã tiêu trong khoảng thời gian đã chọn dựa vào coin_change
  const receivedAgg = await this.aggregate([
    {
      $match: { ...query, coin_change: { $gt: 0 } }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$coin_change' }
      }
    }
  ]);

  const spentAgg = await this.aggregate([
    {
      $match: { ...query, coin_change: { $lt: 0 } }
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $abs: '$coin_change' } }
      }
    }
  ]);

  const totalReceivedInRange = receivedAgg.length > 0 ? receivedAgg[0].total : 0;
  const totalSpentInRange = spentAgg.length > 0 ? spentAgg[0].total : 0;

  console.log(`Kết quả truy vấn trong khoảng thời gian: totalReceivedInRange = ${totalReceivedInRange}, totalSpentInRange = ${totalSpentInRange}`);
  console.log(`Tổng dữ liệu từ Customer: totalCoinTotal = ${totalCoinTotal}, totalCoinSpent = ${totalCoinSpent}`);

  // Nếu không có dữ liệu giao dịch trong khoảng thời gian được chọn
  if (totalReceivedInRange === 0 && totalSpentInRange === 0) {
    return createSampleStats(timeRange, totalCoins);
  }

  // Tính trung bình hàng ngày
  let dailyAverage, dayDiff;

  if (timeRange === 'all') {
    // Nếu là all, tìm giao dịch đầu tiên để tính số ngày
    const firstTransaction = await this.findOne().sort({ transaction_date: 1 });
    if (firstTransaction) {
      dayDiff = Math.max(1, Math.ceil((now - new Date(firstTransaction.transaction_date)) / (1000 * 60 * 60 * 24)));
      console.log(`Từ giao dịch đầu tiên ${firstTransaction.transaction_date} đến hiện tại: ${dayDiff} ngày`);
    } else {
      dayDiff = 1;
    }
  } else {
    dayDiff = Math.max(1, Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)));
  }

  dailyAverage = Math.round((totalReceivedInRange + totalSpentInRange) / dayDiff);
  const weeklyAverage = Math.round(dailyAverage * 7);
  const monthlyAverage = Math.round(dailyAverage * 30);

  const result = {
    totalCoins,
    totalCoinTotal,  // Thêm tổng xu đã nhận từ bảng Customer
    totalCoinSpent,  // Thêm tổng xu đã tiêu từ bảng Customer
    totalReceived: totalReceivedInRange,  // Đổi tên biến để rõ ràng hơn
    totalSpent: totalSpentInRange,        // Đổi tên biến để rõ ràng hơn
    averageDaily: dailyAverage,
    averageWeekly: weeklyAverage,
    averageMonthly: monthlyAverage
  };

  console.log("Kết quả thống kê xu:", result);
  return result;
};

// Hàm hỗ trợ tạo dữ liệu mẫu
function createSampleStats(timeRange, totalCoins) {
  console.log(`Cảnh báo: Không có dữ liệu giao dịch nào trong khoảng thời gian ${timeRange}, trả về dữ liệu mẫu`);

  let sampleStats;

  if (timeRange === 'day') {
    sampleStats = {
      totalCoins,
      totalReceived: 1000,
      totalSpent: 500,
      averageDaily: 1500,
      averageWeekly: 10500,
      averageMonthly: 45000,
      warning: 'Dữ liệu mẫu - không có giao dịch thực tế trong khoảng thời gian được chọn'
    };
  } else if (timeRange === 'week') {
    sampleStats = {
      totalCoins,
      totalReceived: 5000,
      totalSpent: 2000,
      averageDaily: 1000,
      averageWeekly: 7000,
      averageMonthly: 30000,
      warning: 'Dữ liệu mẫu - không có giao dịch thực tế trong khoảng thời gian được chọn'
    };
  } else if (timeRange === 'month') {
    sampleStats = {
      totalCoins,
      totalReceived: 15000,
      totalSpent: 5000,
      averageDaily: 700,
      averageWeekly: 4900,
      averageMonthly: 21000,
      warning: 'Dữ liệu mẫu - không có giao dịch thực tế trong khoảng thời gian được chọn'
    };
  } else if (timeRange === 'year') {
    sampleStats = {
      totalCoins,
      totalReceived: 120000,
      totalSpent: 80000,
      averageDaily: 800,
      averageWeekly: 5600,
      averageMonthly: 24000,
      warning: 'Dữ liệu mẫu - không có giao dịch thực tế trong khoảng thời gian được chọn'
    };
  } else {
    sampleStats = {
      totalCoins,
      totalReceived: 500000,
      totalSpent: 300000,
      averageDaily: 1000,
      averageWeekly: 7000,
      averageMonthly: 30000,
      warning: 'Dữ liệu mẫu - không có giao dịch thực tế trong khoảng thời gian được chọn'
    };
  }

  console.log("Kết quả thống kê xu (dữ liệu mẫu):", sampleStats);
  return sampleStats;
}

// Phương thức tĩnh để lấy dữ liệu biểu đồ
transactionSchema.statics.getChartData = async function(timeRange = 'month') {
  const now = new Date();
  let startDate, categories = [];
  let query = {};

  // Xác định khoảng thời gian và định dạng nhóm
  if (timeRange === 'day') {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    query = { transaction_date: { $gte: startDate } };

    // Tạo danh sách giờ trong ngày (6 khoảng thời gian)
    for (let i = 0; i < 24; i += 4) {
      categories.push(`${i.toString().padStart(2, '0')}:00`);
    }
  } else if (timeRange === 'week') {
    // Lấy ngày đầu tuần (thứ 2)
    startDate = new Date(now);
    const day = startDate.getDay(); // 0 = CN, 1 = T2, ...
    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate.setDate(diff);
    startDate.setHours(0, 0, 0, 0);
    query = { transaction_date: { $gte: startDate } };

    // Tạo danh sách các ngày trong tuần
    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    categories = days;
  } else if (timeRange === 'month') {
    // Lấy ngày đầu tháng
    startDate = new Date(now);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    query = { transaction_date: { $gte: startDate } };

    // Chia tháng thành 4 tuần
    categories = ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'];

    // Log thêm thông tin chi tiết để debug dữ liệu theo tuần trong tháng
    console.log(`Chi tiết giao dịch cho tháng hiện tại (bắt đầu từ ${startDate.toISOString()})`);

    // Tìm tất cả giao dịch trong tháng và hiển thị theo tuần
    const monthTransactions = await this.find(query).limit(100).sort({ transaction_date: 1 });

    // Phân loại giao dịch theo tuần và hiển thị chi tiết
    const transactionsByWeek = [[], [], [], []];

    monthTransactions.forEach(tx => {
      const date = new Date(tx.transaction_date);
      const dayOfMonth = date.getDate();
      let weekIndex;

      // Chia tuần theo logic đã thiết lập
      if (dayOfMonth <= 7) {
        weekIndex = 0; // Tuần 1
      } else if (dayOfMonth <= 14) {
        weekIndex = 1; // Tuần 2
      } else if (dayOfMonth <= 21) {
        weekIndex = 2; // Tuần 3
      } else {
        weekIndex = 3; // Tuần 4
      }

      transactionsByWeek[weekIndex].push({
        id: tx._id,
        date: date.toISOString(),
        day_of_month: dayOfMonth,
        coin_change: tx.coin_change,
        week_index: weekIndex,
        week_name: `Tuần ${weekIndex + 1}`
      });
    });

    // Log chi tiết từng tuần
    console.log("===== CHI TIẾT GIAO DỊCH THEO TUẦN =====");
    for (let i = 0; i < 4; i++) {
      console.log(`--- TUẦN ${i + 1} (${transactionsByWeek[i].length} giao dịch) ---`);
      if (transactionsByWeek[i].length > 0) {
        console.log(transactionsByWeek[i]);
      }
    }
  } else if (timeRange === 'year') {
    // Lấy ngày đầu năm
    startDate = new Date(now);
    startDate.setMonth(0, 1);
    startDate.setHours(0, 0, 0, 0);
    query = { transaction_date: { $gte: startDate } };

    // Tạo danh sách các tháng trong năm
    categories = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
  } else if (timeRange === 'all') {
    // Khi chọn 'all', không áp dụng bộ lọc thời gian
    console.log("Lấy dữ liệu biểu đồ cho tất cả thời gian");

    // Log chi tiết giao dịch all để debug
    console.log("Debugging 'all' timeRange - Lấy dữ liệu biểu đồ với các tham số:", {
      hasQuery: Object.keys(query).length > 0,
      timeRange,
      startDate: startDate ? startDate.toISOString() : null,
    });

    // Debug: hiển thị một số giao dịch mẫu để kiểm tra
    const sampleTransactions = await this.find().limit(10).sort({ transaction_date: -1 });
    coinLogger.logTransactionDetails(sampleTransactions, "Mẫu giao dịch gần đây (biểu đồ all)");

    // Lấy tổng số giao dịch để kiểm tra
    const totalDocs = await this.countDocuments();
    console.log(`Tổng số giao dịch trong cơ sở dữ liệu: ${totalDocs}`);

    if (totalDocs === 0) {
      // Không có giao dịch nào trong cơ sở dữ liệu, trả về dữ liệu mẫu
      console.log("Không có giao dịch nào trong cơ sở dữ liệu, trả về dữ liệu mẫu");

      const currentYear = now.getFullYear();
      const sampleYears = Array.from({ length: 5 }, (_, i) => (currentYear - 4 + i).toString());

      return {
        categories: sampleYears,
        series: [
          {
            name: 'Xu đã nhận',
            data: sampleYears.map(() => Math.floor(Math.random() * 20000) + 10000)
          },
          {
            name: 'Xu đã tiêu',
            data: sampleYears.map(() => Math.floor(Math.random() * 15000) + 5000)
          }
        ],
        warning: 'Dữ liệu mẫu - không có giao dịch thực tế'
      };
    }

    // Lấy các năm có giao dịch
    const years = await this.aggregate([
      {
        $group: {
          _id: { $year: "$transaction_date" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log("Các năm có giao dịch:", years.map(y => ({năm: y._id, số_giao_dịch: y.count})));

    if (years.length === 0) {
      // Xử lý trường hợp không có năm (trường hợp hiếm gặp)
      console.log("Không tìm thấy giao dịch nào (không có năm), trả về dữ liệu mẫu");

      const currentYear = now.getFullYear();
      const sampleYears = Array.from({ length: 5 }, (_, i) => (currentYear - 4 + i).toString());

      return {
        categories: sampleYears,
        series: [
          {
            name: 'Xu đã nhận',
            data: sampleYears.map(() => Math.floor(Math.random() * 20000) + 10000)
          },
          {
            name: 'Xu đã tiêu',
            data: sampleYears.map(() => Math.floor(Math.random() * 15000) + 5000)
          }
        ],
        warning: 'Dữ liệu mẫu - không có giao dịch thực tế'
      };
    }

    // Lấy tất cả các năm từ năm đầu tiên đến năm hiện tại
    const firstYear = years[0]._id;
    const currentYear = now.getFullYear();

    // Tạo danh sách các năm
    for (let year = firstYear; year <= currentYear; year++) {
      categories.push(year.toString());
    }

    // Debug: kiểm tra các năm trong categories
    console.log("Danh sách các năm cho biểu đồ:", categories);

    // Tính tổng xu đã nhận và đã tiêu cho từng năm dựa vào coin_change
    const receivedByYear = await this.aggregate([
      {
        $match: { coin_change: { $gt: 0 } }
      },
      {
        $group: {
          _id: { $year: "$transaction_date" },
          total: { $sum: "$coin_change" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const spentByYear = await this.aggregate([
      {
        $match: { coin_change: { $lt: 0 } }
      },
      {
        $group: {
          _id: { $year: "$transaction_date" },
          total: { $sum: { $abs: "$coin_change" } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log("Xu đã nhận theo năm:", receivedByYear);
    console.log("Xu đã tiêu theo năm:", spentByYear);

    // Kiểm tra xem có dữ liệu không
    if (receivedByYear.length === 0 && spentByYear.length === 0) {
      console.log("Không có dữ liệu giao dịch xu nào, trả về dữ liệu mẫu");
      return getChartSampleData(timeRange, categories);
    }

    // Khởi tạo mảng dữ liệu với giá trị 0
    const receivedSeries = Array(categories.length).fill(0);
    const spentSeries = Array(categories.length).fill(0);

    // Điền dữ liệu vào mảng
    receivedByYear.forEach(item => {
      const yearIndex = categories.indexOf(item._id.toString());
      if (yearIndex !== -1) {
        receivedSeries[yearIndex] = item.total;
      }
    });

    spentByYear.forEach(item => {
      const yearIndex = categories.indexOf(item._id.toString());
      if (yearIndex !== -1) {
        spentSeries[yearIndex] = item.total;
      }
    });

    // Kiểm tra xem có dữ liệu thực không sau khi đã áp dụng
    const hasData = receivedSeries.some(val => val > 0) || spentSeries.some(val => val > 0);
    if (!hasData) {
      console.log("Không có dữ liệu giao dịch xu nào sau khi áp dụng bộ lọc, trả về dữ liệu mẫu");
      return getChartSampleData(timeRange, categories);
    }

    // Trả về kết quả
    const result = {
      categories,
      series: [
        {
          name: 'Xu đã nhận',
          data: receivedSeries
        },
        {
          name: 'Xu đã tiêu',
          data: spentSeries
        }
      ]
    };

    console.log("Kết quả dữ liệu biểu đồ 'all':", result);
    return result;
  }

  console.log(`Lấy dữ liệu biểu đồ theo khoảng thời gian: ${timeRange}, từ ngày ${startDate.toISOString()}`);

  // Kiểm tra xem có giao dịch nào trong khoảng thời gian được chọn không
  const transactionCount = await this.countDocuments(query);
  console.log(`Tổng số giao dịch trong khoảng thời gian ${timeRange}: ${transactionCount}`);

  if (transactionCount === 0) {
    // Không có giao dịch nào trong khoảng thời gian, trả về dữ liệu mẫu
    console.log(`Không có giao dịch nào trong khoảng thời gian ${timeRange}, trả về dữ liệu mẫu`);
    return getChartSampleData(timeRange, categories);
  }

  // Debug: hiển thị một số giao dịch mẫu trong khoảng thời gian được chọn
  const sampleTimeRangeTransactions = await this.find(query).limit(10).sort({ transaction_date: -1 });
  coinLogger.logTransactionDetails(sampleTimeRangeTransactions, `Mẫu giao dịch trong khoảng thời gian ${timeRange}`);

  // Sử dụng aggregation framework thay vì xử lý thủ công
  let receivedData, spentData;

  // Chuẩn bị trường group tùy theo loại thời gian
  let groupField;

  if (timeRange === 'day') {
    // Nhóm theo giờ trong ngày
    groupField = {
      $floor: {
        $divide: [{ $hour: "$transaction_date" }, 4]
      }
    };
  } else if (timeRange === 'week') {
    // Nhóm theo ngày trong tuần
    groupField = {
      $cond: {
        if: { $eq: [{ $dayOfWeek: "$transaction_date" }, 1] }, // CN = 1 trong MongoDB
        then: 6, // Chuyển thành vị trí thứ 7 trong mảng (index 6)
        else: { $subtract: [{ $dayOfWeek: "$transaction_date" }, 2] } // T2 = 2 -> index 0
      }
    };
  } else if (timeRange === 'month') {
    // Log thêm thông tin chi tiết để debug dữ liệu theo tuần trong tháng
    console.log(`Chi tiết giao dịch cho tháng hiện tại (bắt đầu từ ${startDate.toISOString()})`);

    // Tìm tất cả giao dịch trong tháng và hiển thị theo tuần
    const monthTransactions = await this.find(query).limit(100).sort({ transaction_date: 1 });

    // Phân loại giao dịch theo tuần và hiển thị chi tiết
    const transactionsByWeek = [[], [], [], []];

    monthTransactions.forEach(tx => {
      const date = new Date(tx.transaction_date);
      const dayOfMonth = date.getDate();
      let weekIndex;

      // Chia tuần theo logic đã thiết lập
      if (dayOfMonth <= 7) {
        weekIndex = 0; // Tuần 1
      } else if (dayOfMonth <= 14) {
        weekIndex = 1; // Tuần 2
      } else if (dayOfMonth <= 21) {
        weekIndex = 2; // Tuần 3
      } else {
        weekIndex = 3; // Tuần 4
      }

      transactionsByWeek[weekIndex].push({
        id: tx._id,
        date: date.toISOString(),
        day_of_month: dayOfMonth,
        coin_change: tx.coin_change,
        week_index: weekIndex,
        week_name: `Tuần ${weekIndex + 1}`
      });
    });

    // Log chi tiết từng tuần
    console.log("===== CHI TIẾT GIAO DỊCH THEO TUẦN =====");
    for (let i = 0; i < 4; i++) {
      console.log(`--- TUẦN ${i + 1} (${transactionsByWeek[i].length} giao dịch) ---`);
      if (transactionsByWeek[i].length > 0) {
        console.log(transactionsByWeek[i]);
      }
    }

    // Nhóm theo tuần trong tháng (dựa vào ngày)
    // 1-7: tuần 1, 8-14: tuần 2, 15-21: tuần 3, 22-31: tuần 4
    groupField = {
      $switch: {
        branches: [
          { case: { $lte: [{ $dayOfMonth: "$transaction_date" }, 7] }, then: 0 },
          { case: { $lte: [{ $dayOfMonth: "$transaction_date" }, 14] }, then: 1 },
          { case: { $lte: [{ $dayOfMonth: "$transaction_date" }, 21] }, then: 2 }
        ],
        default: 3
      }
    };
  } else if (timeRange === 'year') {
    // Nhóm theo tháng
    groupField = { $month: "$transaction_date" };

    // Trừ 1 vì tháng bắt đầu từ 1 nhưng chúng ta cần index bắt đầu từ 0
    groupField = { $subtract: [groupField, 1] };
  } else { // timeRange === 'all'
    // Nhóm theo năm cho timeRange 'all'
    groupField = { $year: "$transaction_date" };
  }

  // Đảm bảo groupField đã được khởi tạo
  if (!groupField) {
    console.error("Lỗi: Biến groupField chưa được khởi tạo cho timeRange:", timeRange);
    return getChartSampleData(timeRange, categories);
  }

  // Tính tổng xu đã nhận theo nhóm thời gian
  receivedData = await this.aggregate([
    {
      $match: { ...query, coin_change: { $gt: 0 } }
    },
    {
      $group: {
        _id: groupField,
        total: { $sum: "$coin_change" }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Tính tổng xu đã tiêu theo nhóm thời gian
  spentData = await this.aggregate([
    {
      $match: { ...query, coin_change: { $lt: 0 } }
    },
    {
      $group: {
        _id: groupField,
        total: { $sum: { $abs: "$coin_change" } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  console.log("Dữ liệu xu đã nhận:", receivedData);
  console.log("Dữ liệu xu đã tiêu:", spentData);

  // Khởi tạo mảng với giá trị 0
  const receivedSeries = Array(categories.length).fill(0);
  const spentSeries = Array(categories.length).fill(0);

  // Thêm debug chi tiết cho mapping dữ liệu
  console.log("Ánh xạ dữ liệu vào biểu đồ:");

  // Điền dữ liệu vào mảng
  receivedData.forEach(item => {
    console.log(`- Dữ liệu đã nhận: _id=${item._id}, total=${item.total}`);

    if (item._id !== null && item._id >= 0 && item._id < categories.length) {
      console.log(`  Ánh xạ vào ${categories[item._id]}: ${item.total}`);
      receivedSeries[item._id] = item.total;
    } else {
      console.log(`  Không thể ánh xạ _id=${item._id} (ngoài phạm vi categories)`);
    }
  });

  spentData.forEach(item => {
    console.log(`- Dữ liệu đã tiêu: _id=${item._id}, total=${item.total}`);

    if (item._id !== null && item._id >= 0 && item._id < categories.length) {
      console.log(`  Ánh xạ vào ${categories[item._id]}: ${item.total}`);
      spentSeries[item._id] = item.total;
    } else {
      console.log(`  Không thể ánh xạ _id=${item._id} (ngoài phạm vi categories)`);
    }
  });

  // Hiển thị kết quả cuối cùng
  console.log("Kết quả receivedSeries:", receivedSeries);
  console.log("Kết quả spentSeries:", spentSeries);

  // Kiểm tra xem có dữ liệu thực không
  const hasData = receivedSeries.some(val => val > 0) || spentSeries.some(val => val > 0);

  if (!hasData) {
    console.log(`Cảnh báo: Không có dữ liệu giao dịch nào trong khoảng thời gian ${timeRange}, trả về dữ liệu mẫu`);
    return getChartSampleData(timeRange, categories);
  }

  const result = {
    categories,
    series: [
      {
        name: 'Xu đã nhận',
        data: receivedSeries
      },
      {
        name: 'Xu đã tiêu',
        data: spentSeries
      }
    ]
  };

  console.log("Kết quả dữ liệu biểu đồ:", result);
  return result;
};

// Hàm hỗ trợ tạo dữ liệu mẫu cho biểu đồ
function getChartSampleData(timeRange, categories) {
  console.log(`Tạo dữ liệu mẫu cho biểu đồ với timeRange = ${timeRange}`);

  let sampleReceivedSeries, sampleSpentSeries;

  if (timeRange === 'day') {
    sampleReceivedSeries = [200, 350, 500, 400, 300, 250];
    sampleSpentSeries = [150, 250, 400, 300, 200, 100];
  } else if (timeRange === 'week') {
    sampleReceivedSeries = [300, 400, 350, 500, 450, 380, 420];
    sampleSpentSeries = [200, 350, 300, 400, 350, 250, 300];
  } else if (timeRange === 'month') {
    sampleReceivedSeries = [1500, 2300, 1800, 2100];
    sampleSpentSeries = [1200, 1900, 1500, 1700];
  } else if (timeRange === 'year') {
    sampleReceivedSeries = [1200, 1500, 1800, 2000, 2200, 2400, 2100, 1900, 2300, 2500, 2700, 3000];
    sampleSpentSeries = [1000, 1300, 1500, 1800, 1900, 2100, 1800, 1700, 2000, 2200, 2400, 2600];
  } else {
    // Đối với 'all', tạo dữ liệu mẫu dựa trên số lượng danh mục
    sampleReceivedSeries = Array(categories.length).fill(0).map(() => Math.floor(Math.random() * 20000) + 10000);
    sampleSpentSeries = Array(categories.length).fill(0).map(() => Math.floor(Math.random() * 15000) + 5000);
  }

  return {
    categories,
    series: [
      {
        name: 'Xu đã nhận',
        data: sampleReceivedSeries
      },
      {
        name: 'Xu đã tiêu',
        data: sampleSpentSeries
      }
    ],
    warning: 'Dữ liệu mẫu - không có giao dịch thực tế trong khoảng thời gian được chọn'
  };
}

// Áp dụng plugin timezone Việt Nam
transactionSchema.plugin(vietnamTimezonePlugin);

module.exports = mongoose.model('Transaction', transactionSchema);