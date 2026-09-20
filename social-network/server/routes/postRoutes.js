const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const { createPost, getFeed, getPost, editPost, deletePost, likePost, addComment, getComments, deleteComment } = require('../controllers/postController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../client/assets/uploads')),
  filename: (req, file, cb) => {
    cb(null, 'post-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  }
});
const fileFilter = (req, file, cb) => {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const videoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
  const extension = path.extname(file.originalname).toLowerCase();
  const imageExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];
  const videoExtensions = ['.mp4', '.webm', '.ogv', '.ogg'];
  if (imageTypes.includes(file.mimetype) && imageExtensions.includes(extension)) return cb(null, true);
  if (videoTypes.includes(file.mimetype) && videoExtensions.includes(extension)) return cb(null, true);
  cb(new Error('Only JPEG, PNG, GIF, WEBP images or MP4, WEBM, OGG videos are allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });
const uploadPostMedia = (req, res, next) => {
  upload.single('media')(req, res, error => {
    if (error) return res.status(400).json({ message: error.message || 'Media upload failed' });
    next();
  });
};

router.get('/feed', protect, getFeed);
router.post('/', protect, uploadPostMedia, createPost);
router.get('/:id', protect, getPost);
router.put('/:id', protect, editPost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, likePost);
router.post('/:id/comments', protect, addComment);
router.get('/:id/comments', protect, getComments);
router.delete('/:postId/comments/:commentId', protect, deleteComment);

module.exports = router;
