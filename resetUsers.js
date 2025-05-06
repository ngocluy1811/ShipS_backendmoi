const mongoose = require('mongoose');

async function resetUsers() {
  try {
    // Kết nối MongoDB
    await mongoose.connect('mongodb://localhost:27017/ships_db');
    console.log('Connected to MongoDB');

    // Xóa tất cả index của collection users
    try {
      await mongoose.connection.db.collection('users').dropIndexes();
      console.log('Dropped all indexes from users collection');
    } catch (err) {
      console.log('No indexes to drop or collection does not exist');
    }

    // Xóa collection users
    try {
      await mongoose.connection.db.dropCollection('users');
      console.log('Dropped users collection');
    } catch (err) {
      console.log('Collection does not exist');
    }

    // Tạo lại collection với schema mới
    const userSchema = new mongoose.Schema({
      user_id: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      role: { type: String, enum: ['customer', 'shipper', 'admin', 'staff'], required: true },
      active: { type: Boolean, default: false },
      active_code: { type: String },
      salary: { type: Number },
      warehouse_id: { type: String }
    }, { 
      // Tắt strict mode để tránh lỗi với các field không được định nghĩa
      strict: false
    });

    // Tạo model mới
    mongoose.deleteModel('User'); // Xóa model cũ nếu có
    const User = mongoose.model('User', userSchema);
    console.log('Created new users collection with correct schema');

    // Đóng kết nối
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetUsers(); 