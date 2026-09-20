// socket.js — Socket.IO client setup and real-time event handling
let socket = null;

function initSocket() {
  const user = getStoredUser();
  if (!user || typeof io === 'undefined') return;

  socket = io('http://localhost:5000');

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    socket.emit('join', user._id);
  });

  // New notification from server
  socket.on('new_notification', (notification) => {
    incrementNotifBadge();
    showToast(notification.message, 'info');
  });

  // Friend request received
  socket.on('friend_request_received', (data) => {
    showToast(`${data.sender.name} sent you a friend request!`, 'info');
  });

  // Friend request accepted
  socket.on('friend_request_accepted', (data) => {
    showToast(`${data.acceptedBy.name} accepted your friend request!`, 'success');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
}

function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
