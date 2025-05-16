const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userId: { type: String, ref: 'User', required: true },
  action: { type: String, required: true },
  details: { type: String },
  createdAt: { type: Date, default: Date.now },
  timestamp: { type: Date, default: Date.now }
});

userActivitySchema.index({ user: 1 });
userActivitySchema.index({ userId: 1 });

module.exports = mongoose.models.UserActivity || mongoose.model('UserActivity', userActivitySchema); 

