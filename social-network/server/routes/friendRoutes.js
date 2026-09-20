const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { sendRequest, acceptRequest, rejectRequest, removeFriend, getFriends, getPendingRequests, getFriendStatus } = require('../controllers/friendController');

router.get('/', protect, getFriends);
router.get('/requests', protect, getPendingRequests);
router.get('/status/:userId', protect, getFriendStatus);
router.post('/request/:userId', protect, sendRequest);
router.put('/accept/:requestId', protect, acceptRequest);
router.put('/reject/:requestId', protect, rejectRequest);
router.delete('/remove/:userId', protect, removeFriend);

module.exports = router;
