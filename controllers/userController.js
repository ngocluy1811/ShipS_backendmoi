const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const UserActivity = require('../models/UserActivity');

// Middleware để xác thực token (copy từ index.js để sử dụng cục bộ)
const authenticateToken = (roles) => (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Không có token.' });
  }
  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token không hợp lệ.' });
    }
    if (roles && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }
    req.user = user;
    next();
  });
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Lấy danh sách users
router.get('/', authenticateToken(['admin', 'staff']), async (req, res) => {
  try {
    let query = {};
    
    // Admin và staff xem được tất cả
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Không có quyền truy cập.' });
    }

    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Đăng ký user mới
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, phoneNumber, address, role, vehicleType, vehicleNumber, citizenId } = req.body;
    if (!email || !password || !fullName || !phoneNumber || !address || !role) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email đã được sử dụng.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (role === 'customer') {
      // Đăng ký customer: gửi OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const user = new User({
        user_id: `user_${Date.now()}`,
        email,
        password: hashedPassword,
        fullName,
        phoneNumber,
        address,
        role: 'customer',
        isVerified: false
      });
      await user.save();

      // Gửi OTP qua email
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Xác thực tài khoản ShipS',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF6B00;">Xác thực tài khoản ShipS</h2>
            <p>Xin chào <strong>${fullName}</strong>,</p>
            <p>Cảm ơn bạn đã đăng ký tài khoản tại ShipS.</p>
            <p>Mã xác thực (OTP) của bạn là:</p>
            <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
              <strong>${otp}</strong>
            </div>
            <p>Mã này có hiệu lực trong 15 phút.</p>
            <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
            <p>Trân trọng,<br/>Đội ngũ ShipS</p>
          </div>
        `
      });

      global._otpMap = global._otpMap || {};
      global._otpMap[email] = { otp, expiry: Date.now() + 15 * 60 * 1000 };

      await UserActivity.create({
        userId: user.user_id,
        action: 'Register',
        details: `Tạo tài khoản với vai trò ${user.role}`
      });

      return res.json({
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
        email
      });
    } else if (role === 'shipper') {
      // Đăng ký shipper: active luôn, không cần OTP, lưu thêm thông tin xe và căn cước
      const user = new User({
        user_id: `user_${Date.now()}`,
        email,
        password: hashedPassword,
        fullName,
        phoneNumber,
        address,
        role,
        isVerified: true,
        active: true,
        vehicleType: vehicleType || '',
        vehicleNumber: vehicleNumber || '',
        citizenId: citizenId || ''
      });
      await user.save();
      await UserActivity.create({
        userId: user.user_id,
        action: 'Register',
        details: `Tạo tài khoản với vai trò ${user.role}`
      });
      return res.json({
        message: 'Đăng ký shipper thành công. Tài khoản đã được kích hoạt.',
        email
      });
    } else {
      // Đăng ký admin, staff: không cần các trường xe/cccd
      const user = new User({
        user_id: `user_${Date.now()}`,
        email,
        password: hashedPassword,
        fullName,
        phoneNumber,
        address,
        role,
        isVerified: true,
        active: true
      });
      await user.save();
      await UserActivity.create({
        userId: user.user_id,
        action: 'Register',
        details: `Tạo tài khoản với vai trò ${user.role}`
      });
      return res.json({
        message: 'Đăng ký thành công. Tài khoản đã được kích hoạt.',
        email
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Đăng ký thất bại. Vui lòng thử lại sau.' });
  }
});

// Xác thực OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email và mã OTP.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Tài khoản đã được xác thực.' });
    }

    // Lấy OTP từ memory
    global._otpMap = global._otpMap || {};
    const otpObj = global._otpMap[email];
    if (!otpObj) {
      return res.status(400).json({ error: 'OTP không tồn tại hoặc đã hết hạn.' });
    }
    if (otpObj.otp !== otp) {
      return res.status(400).json({ error: 'Mã OTP không đúng.' });
    }
    if (otpObj.expiry < Date.now()) {
      return res.status(400).json({ error: 'Mã OTP đã hết hạn.' });
    }

    // Update user status
    user.isVerified = true;
    user.active = true;
    await user.save();
    // Xóa OTP khỏi memory
    delete global._otpMap[email];

    await UserActivity.create({
      userId: user.user_id,
      action: 'VerifyOTP',
      details: 'Xác thực tài khoản thành công'
    });

    res.json({ message: 'Xác thực tài khoản thành công.' });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'Xác thực thất bại. Vui lòng thử lại sau.' });
  }
});

// Gửi lại OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Tài khoản đã được xác thực.' });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Gửi OTP qua email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Mã xác thực mới - ShipS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B00;">Mã xác thực mới</h2>
          <p>Xin chào <strong>${user.fullName}</strong>,</p>
          <p>Mã xác thực mới của bạn là:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
            <strong>${otp}</strong>
          </div>
          <p>Mã này có hiệu lực trong 15 phút.</p>
          <p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
          <p>Trân trọng,<br/>Đội ngũ ShipS</p>
        </div>
      `
    });
    // Lưu OTP tạm thời vào memory
    global._otpMap = global._otpMap || {};
    global._otpMap[email] = { otp, expiry: Date.now() + 15 * 60 * 1000 };

    await UserActivity.create({
      userId: user.user_id,
      action: 'ResendOTP',
      details: 'Gửi lại mã xác thực'
    });

    res.json({ message: 'Đã gửi lại mã xác thực.' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Gửi lại mã thất bại. Vui lòng thử lại sau.' });
  }
});

// Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu.' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }
    // Kiểm tra tài khoản bị khoá
    if (user.isLocked) {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa, vui lòng liên hệ admin để mở khóa.' });
    }
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }
    // Check if account is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        error: 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email để xác thực tài khoản.',
        email: user.email
      });
    }
    // Cập nhật lastLogin
    user.lastLogin = new Date();
    await user.save();
    // Ghi log hoạt động
    await UserActivity.create({
      userId: user.user_id,
      action: 'Login',
      details: 'Đăng nhập hệ thống'
    });
    // Generate JWT token
    const token = jwt.sign(
      { 
        user_id: user.user_id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );
    // Return user info (excluding sensitive data)
    const userInfo = {
      user_id: user.user_id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      address: user.address,
      role: user.role
    };
    res.json({
      token,
      user: userInfo,
      message: 'Đăng nhập thành công.'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Đăng nhập thất bại. Vui lòng thử lại sau.' });
  }
});

// Gán shipper vào kho
router.post('/assign-shipper', authenticateToken(['admin']), async (req, res) => {
  try {
    const { shipper_id, warehouse_id } = req.body;

    // Kiểm tra quyền admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới được gán shipper vào kho.' });
    }

    // Kiểm tra shipper tồn tại
    const shipper = await User.findOne({ user_id: shipper_id, role: 'shipper' });
    if (!shipper) {
      return res.status(404).json({ error: 'Shipper không tồn tại.' });
    }

    // Cập nhật warehouse_id cho shipper
    shipper.warehouse_id = warehouse_id;
    await shipper.save();

    await UserActivity.create({
      userId: shipper.user_id,
      action: 'AssignShipper',
      details: `Gán shipper vào kho với warehouse_id ${warehouse_id}`
    });

    res.json({ message: 'Gán shipper vào kho thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lấy thông tin user hiện tại
router.get('/me', authenticateToken(['customer', 'admin', 'staff', 'shipper']), async (req, res) => {
  try {
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }
    if (user.isLocked) {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa, vui lòng liên hệ admin để mở khóa.' });
    }
    // Return user info (excluding sensitive data)
    const userInfo = {
      user_id: user.user_id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      address: user.address,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json(userInfo);
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'Không thể lấy thông tin người dùng.' });
  }
});

// Cập nhật thông tin user
router.put('/me', authenticateToken(['customer', 'admin', 'staff', 'shipper']), async (req, res) => {
  try {
    const { fullName, phoneNumber, address } = req.body;
    
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }

    // Update allowed fields
    if (fullName) user.fullName = fullName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (address) user.address = address;

    await user.save();

    await UserActivity.create({
      userId: user.user_id,
      action: 'Update',
      details: 'Cập nhật thông tin người dùng'
    });

    // Return updated user info
    const userInfo = {
      user_id: user.user_id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      address: user.address,
      role: user.role,
      isVerified: user.isVerified,
      updatedAt: user.updatedAt
    };

    res.json({
      message: 'Cập nhật thông tin thành công.',
      user: userInfo
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Cập nhật thông tin thất bại. Vui lòng thử lại sau.' });
  }
});

// Đổi mật khẩu
router.put('/change-password', authenticateToken(['customer', 'admin', 'staff', 'shipper']), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới.' });
    }

    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await UserActivity.create({
      userId: user.user_id,
      action: 'ChangePassword',
      details: 'Đổi mật khẩu'
    });

    res.json({ message: 'Đổi mật khẩu thành công.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Đổi mật khẩu thất bại. Vui lòng thử lại sau.' });
  }
});

// Lấy thông tin public của user theo user_id (không giới hạn quyền)
router.get('/public/:user_id', async (req, res) => {
  try {
    const user = await User.findOne({ user_id: req.params.user_id }).select('user_id fullName phoneNumber vehicleType vehicleNumber citizenId');
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lấy danh sách user (có phân trang, tìm kiếm, lọc)
router.get('/list', async (req, res) => {
  try {
    const { search = '', role, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { user_id: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) query.role = role;
    if (status === 'active') query.active = true;
    if (status === 'inactive') query.active = false;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query).select('-password').skip(skip).limit(parseInt(limit));
    const total = await User.countDocuments(query);
    res.json({ users, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lấy chi tiết user
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cập nhật user
router.put('/:id', async (req, res) => {
  try {
    const { fullName, phoneNumber, address, role, active } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { fullName, phoneNumber, address, role, active },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user.' });
    await UserActivity.create({
      userId: user.user_id,
      action: 'Update',
      details: 'Cập nhật thông tin người dùng'
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa user
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user.' });
    await UserActivity.create({
      userId: user.user_id,
      action: 'Delete',
      details: 'Xóa người dùng'
    });
    res.json({ message: 'Xóa user thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Đổi trạng thái active/inactive
router.patch('/:id/active', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user.' });
    user.active = !user.active;
    await user.save();
    await UserActivity.create({
      userId: user.user_id,
      action: 'ToggleActive',
      details: `Chuyển trạng thái ${user.active ? 'Hoạt động' : 'Không hoạt động'}`
    });
    res.json({ active: user.active });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lịch sử hoạt động user
router.get('/:id/activity', async (req, res) => {
  try {
    const activities = await UserActivity.find({ userId: req.params.id }).sort({ timestamp: -1 }).limit(50);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Khóa tài khoản
router.patch('/:id/lock', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isLocked: true }, { new: true });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mở khóa tài khoản
router.patch('/:id/unlock', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isLocked: false }, { new: true });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user.' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// controllers/user.controller.js
router.patch('/:id/verify', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isVerified: true }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User verified', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/unverify', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isVerified: false }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User unverified', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;