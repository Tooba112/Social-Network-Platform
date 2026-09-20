const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const { getUserProfile, updateProfile, getUserPosts, searchUsers, updatePrivacy } = require('../controllers/userController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../client/assets/uploads')),
  filename: (req, file, cb) => {
    cb(null, 'profile-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  }
});
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/search', protect, searchUsers);
router.put('/profile', protect, upload.single('profilePicture'), updateProfile);
router.put('/privacy', protect, updatePrivacy);
router.get('/:id', protect, getUserProfile);
router.get('/:id/posts', protect, getUserPosts);

module.exports = router;
