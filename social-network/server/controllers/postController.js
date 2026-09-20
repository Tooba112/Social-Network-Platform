const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Notification = require('../models/Notification');

// POST /api/posts
const createPost = async (req, res) => {
  try {
    const { content, visibility } = req.body;
    if (!content || content.trim() === '') return res.status(400).json({ message: 'Post content is required' });
    const postData = { author: req.user._id, content: content.trim(), visibility: visibility || 'public' };
    const uploadedFile = req.file;
    if (uploadedFile) {
      const isVideo = uploadedFile.mimetype.startsWith('video/');
      postData.mediaType = isVideo ? 'video' : 'image';
      postData[isVideo ? 'video' : 'image'] = `/uploads/${uploadedFile.filename}`;
    }
    const post = await Post.create(postData);
    await post.populate('author', 'name profilePicture');
    const io = req.app.get('io');
    if (io) io.emit('new_post', post);
    res.status(201).json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/posts/feed
const getFeed = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const friendIds = currentUser.friends;
    const posts = await Post.find({
      $or: [
        { author: req.user._id },
        { author: { $in: friendIds }, visibility: { $in: ['public', 'friends'] } }
      ]
    }).populate('author', 'name profilePicture privacy').sort({ createdAt: -1 }).limit(50);
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/posts/:id
const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name profilePicture privacy');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/posts/:id
const editPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.author.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    const { content, visibility } = req.body;
    if (content) post.content = content.trim();
    if (visibility) post.visibility = visibility;
    await post.save();
    await post.populate('author', 'name profilePicture');
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/posts/:id
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.author.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    await Post.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ post: req.params.id });
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/posts/:id/like
const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const userId = req.user._id.toString();
    const alreadyLiked = post.likes.some(id => id.toString() === userId);
    if (alreadyLiked) {
      post.likes = post.likes.filter(id => id.toString() !== userId);
    } else {
      post.likes.push(req.user._id);
      if (post.author._id.toString() !== userId) {
        const notification = await Notification.create({
          recipient: post.author._id, sender: req.user._id, type: 'like',
          post: post._id, message: `${req.user.name} liked your post`
        });
        const io = req.app.get('io');
        if (io) {
          const populated = await notification.populate('sender', 'name profilePicture');
          io.to(`user_${post.author._id}`).emit('new_notification', populated);
        }
      }
    }
    await post.save();
    res.json({ likes: post.likes, liked: !alreadyLiked });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/posts/:id/comments
const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim() === '') return res.status(400).json({ message: 'Comment content required' });
    const post = await Post.findById(req.params.id).populate('author', 'name');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const comment = await Comment.create({ post: post._id, author: req.user._id, content: content.trim() });
    await comment.populate('author', 'name profilePicture');
    const userId = req.user._id.toString();
    if (post.author._id.toString() !== userId) {
      const notification = await Notification.create({
        recipient: post.author._id, sender: req.user._id, type: 'comment',
        post: post._id, message: `${req.user.name} commented on your post`
      });
      const io = req.app.get('io');
      if (io) {
        const populated = await notification.populate('sender', 'name profilePicture');
        io.to(`user_${post.author._id}`).emit('new_notification', populated);
      }
    }
    res.status(201).json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/posts/:id/comments
const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id })
      .populate('author', 'name profilePicture').sort({ createdAt: 1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/posts/:postId/comments/:commentId
const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.author.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    await Comment.findByIdAndDelete(req.params.commentId);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createPost, getFeed, getPost, editPost, deletePost, likePost, addComment, getComments, deleteComment };
