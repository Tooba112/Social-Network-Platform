const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getNotifications, getUnreadCount, markAsRead, markAllAsRead } = require('../controllers/notificationController');

router.get('/', protect, getNotifications);
router.get('/count', protect, getUnreadCount);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);

module.exports = router;
