const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');

// POST /api/friends/request/:userId
const sendRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const receiverId = req.params.userId;
    if (senderId.toString() === receiverId) return res.status(400).json({ message: 'Cannot send request to yourself' });
    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ message: 'User not found' });
    const sender = await User.findById(senderId);
    if (sender.friends.map(f => f.toString()).includes(receiverId)) return res.status(400).json({ message: 'Already friends' });
    const existing = await FriendRequest.findOne({
      $or: [{ sender: senderId, receiver: receiverId }, { sender: receiverId, receiver: senderId }]
    });
    if (existing) return res.status(400).json({ message: 'Friend request already exists' });
    const request = await FriendRequest.create({ sender: senderId, receiver: receiverId });
    const notification = await Notification.create({
      recipient: receiverId, sender: senderId, type: 'friend_request',
      message: `${req.user.name} sent you a friend request`
    });
    const io = req.app.get('io');
    if (io) {
      const populated = await notification.populate('sender', 'name profilePicture');
      io.to(`user_${receiverId}`).emit('new_notification', populated);
      io.to(`user_${receiverId}`).emit('friend_request_received', {
        request, sender: { _id: senderId, name: req.user.name, profilePicture: req.user.profilePicture }
      });
    }
    res.status(201).json({ message: 'Friend request sent', request });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/friends/accept/:requestId
const acceptRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.receiver.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    request.status = 'accepted';
    await request.save();
    await User.findByIdAndUpdate(request.sender, { $addToSet: { friends: request.receiver } });
    await User.findByIdAndUpdate(request.receiver, { $addToSet: { friends: request.sender } });
    const notification = await Notification.create({
      recipient: request.sender, sender: req.user._id, type: 'friend_accepted',
      message: `${req.user.name} accepted your friend request`
    });
    const io = req.app.get('io');
    if (io) {
      const populated = await notification.populate('sender', 'name profilePicture');
      io.to(`user_${request.sender}`).emit('new_notification', populated);
      io.to(`user_${request.sender}`).emit('friend_request_accepted', {
        acceptedBy: { _id: req.user._id, name: req.user.name, profilePicture: req.user.profilePicture }
      });
    }
    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/friends/reject/:requestId
const rejectRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.receiver.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    request.status = 'rejected';
    await request.save();
    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/friends/remove/:userId
const removeFriend = async (req, res) => {
  try {
    const userId = req.user._id;
    const friendId = req.params.userId;
    await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });
    await FriendRequest.deleteOne({
      $or: [{ sender: userId, receiver: friendId }, { sender: friendId, receiver: userId }]
    });
    res.json({ message: 'Friend removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/friends
const getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('friends', 'name profilePicture bio');
    res.json(user.friends);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/friends/requests
const getPendingRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({ receiver: req.user._id, status: 'pending' })
      .populate('sender', 'name profilePicture bio');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/friends/status/:userId
const getFriendStatus = async (req, res) => {
  try {
    const currentId = req.user._id;
    const targetId = req.params.userId;
    const currentUser = await User.findById(currentId);
    const isFriend = currentUser.friends.some(f => f.toString() === targetId);
    if (isFriend) return res.json({ status: 'friends' });
    const request = await FriendRequest.findOne({
      $or: [
        { sender: currentId, receiver: targetId, status: 'pending' },
        { sender: targetId, receiver: currentId, status: 'pending' }
      ]
    });
    if (request) {
      if (request.sender.toString() === currentId.toString()) return res.json({ status: 'request_sent', requestId: request._id });
      else return res.json({ status: 'request_received', requestId: request._id });
    }
    res.json({ status: 'none' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { sendRequest, acceptRequest, rejectRequest, removeFriend, getFriends, getPendingRequests, getFriendStatus };
