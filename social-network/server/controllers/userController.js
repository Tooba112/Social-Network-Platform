const User = require('../models/User');
const Post = require('../models/Post');

// GET /api/users/:id
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').populate('friends', 'name profilePicture');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const currentUserId = req.user._id.toString();
    const isSelf = currentUserId === user._id.toString();
    const isFriend = user.friends.some(f => f._id.toString() === currentUserId);
    if (!isSelf) {
      if (user.privacy.profile === 'private') return res.status(403).json({ message: 'This profile is private' });
      if (user.privacy.profile === 'friends' && !isFriend) return res.status(403).json({ message: 'This profile is visible to friends only' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const { name, bio } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (req.file) updateData.profilePicture = `/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updateData }, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/:id/posts
const getUserPosts = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id).select('-password');
    if (!targetUser) return res.status(404).json({ message: 'User not found' });
    const currentUserId = req.user._id.toString();
    const isSelf = currentUserId === targetUser._id.toString();
    const isFriend = targetUser.friends.some(f => f.toString() === currentUserId);
    if (!isSelf && targetUser.privacy.posts === 'private') return res.json([]);
    if (!isSelf && !isFriend && targetUser.privacy.posts === 'friends') return res.json([]);
    let visibilityFilter = isSelf ? ['public', 'friends', 'private'] : isFriend ? ['public', 'friends'] : ['public'];
    const posts = await Post.find({ author: req.params.id, visibility: { $in: visibilityFilter } })
      .populate('author', 'name profilePicture').sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/search?q=
const searchUsers = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json([]);
    const users = await User.find({ name: { $regex: query, $options: 'i' }, _id: { $ne: req.user._id } })
      .select('name profilePicture bio').limit(20);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/users/privacy
const updatePrivacy = async (req, res) => {
  try {
    const { profilePrivacy, postsPrivacy } = req.body;
    const allowed = ['public', 'friends', 'private'];
    const updateData = {};
    if (profilePrivacy && allowed.includes(profilePrivacy)) updateData['privacy.profile'] = profilePrivacy;
    if (postsPrivacy && allowed.includes(postsPrivacy)) updateData['privacy.posts'] = postsPrivacy;
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updateData }, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getUserProfile, updateProfile, getUserPosts, searchUsers, updatePrivacy };
