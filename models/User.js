const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  vehicleType: { type: String, default: '' },      // Loại xe
  vehicleNumber: { type: String, default: '' },    // Biển số xe
  citizenId: { type: String, default: '' },        // Căn cước công dân
  address: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['customer', 'admin', 'staff', 'shipper'],
    default: 'customer'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String,
    default: null
  },
  otpExpiry: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  active: { type: Boolean, default: false },
  active_code: { type: String },
  expired_code: { type: Date },
  active_datetime: { type: Date },
  warehouse_id: { type: String }
}, {
  strict: false,  // Tắt strict mode để tránh lỗi với các field không được định nghĩa
  timestamps: true // Tự động thêm createdAt và updatedAt
});

// Update updatedAt timestamp before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Xóa tất cả index hiện tại
mongoose.connection.on('connected', async () => {
  try {
    await mongoose.connection.db.collection('users').dropIndexes();
    console.log('Dropped all indexes from users collection');
  } catch (err) {
    console.log('No indexes to drop or collection does not exist');
  }
});

// Tạo lại các index cần thiết
userSchema.index({ user_id: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);