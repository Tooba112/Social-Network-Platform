const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 1000 },
  image: { type: String, default: '' },
  video: { type: String, default: '' },
  mediaType: { type: String, enum: ['image', 'video', ''], default: '' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  visibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' }
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema);
