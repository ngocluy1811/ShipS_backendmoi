const mongoose = require('mongoose');

const UserActivitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userId: { type: String, ref: 'User' },
  action: { type: String, required: true },
  details: { type: String },
  createdAt: { type: Date, default: Date.now }
});

UserActivitySchema.index({ user: 1 });
UserActivitySchema.index({ userId: 1 });

module.exports = mongoose.model('UserActivity', UserActivitySchema); 

const userActivitySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: String },
  timestamp: { type: Date, default: Date.now }
});
module.exports = mongoose.model('UserActivity', userActivitySchema); 

