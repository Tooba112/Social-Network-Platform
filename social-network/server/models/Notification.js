const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['friend_request', 'friend_accepted', 'like', 'comment'], required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
  read: { type: Boolean, default: false },
  message: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
