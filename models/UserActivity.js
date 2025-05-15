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