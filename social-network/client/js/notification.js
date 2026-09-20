// notification.js — Notifications page

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  renderNavbar('notifications');
  renderBottomNav('notifications');
  initSocket();

  const spl = document.getElementById('sidebar-profile-link');
  if (spl) spl.href = `profile.html?id=${getStoredUser()._id}`;

  await loadNotifications();
});

/* ─────────────────────────────────────────────
   LOAD NOTIFICATIONS
───────────────────────────────────────────── */
async function loadNotifications() {
  const container = document.getElementById('notifications-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  try {
    const notifications = await apiFetch('/api/notifications');
    if (!notifications.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔔</div>
          <p>No notifications yet.</p>
        </div>`;
      return;
    }
    container.innerHTML = notifications.map(n => renderNotification(n)).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><p class="error-msg">Failed to load notifications</p></div>';
  }
}

/* ─────────────────────────────────────────────
   RENDER NOTIFICATION ITEM
───────────────────────────────────────────── */
function renderNotification(n) {
  const icon = { friend_request: '👤', friend_accepted: '🤝', like: '❤️', comment: '💬' }[n.type] || '🔔';
  const postId = n.post ? (n.post._id || n.post) : '';
  return `
  <div class="notif-item ${n.read ? '' : 'unread'}" id="notif-${n._id}"
       onclick="handleNotifClick('${n._id}','${n.type}','${postId}')">
    <img class="notif-avatar" src="${avatarSrc(n.sender?.profilePicture, n.sender?.name)}" alt="${escapeHtml(n.sender?.name || 'User')} avatar" />
    <div class="notif-body">
      <p>${icon} ${escapeHtml(n.message)}</p>
      <div class="notif-time">${timeAgo(n.createdAt)}</div>
    </div>
    ${!n.read ? '<div class="notif-dot"></div>' : ''}
  </div>`;
}

/* ─────────────────────────────────────────────
   MARK READ + NAVIGATE
───────────────────────────────────────────── */
async function handleNotifClick(notifId, type, postId) {
  try {
    await apiFetch(`/api/notifications/${notifId}/read`, { method: 'PUT' });
    const el = document.getElementById(`notif-${notifId}`);
    if (el) { el.classList.remove('unread'); el.querySelector('.notif-dot')?.remove(); }
    await loadNotifCount(); // refresh badge in navbar
    if (type === 'friend_request' || type === 'friend_accepted') {
      window.location.href = 'friends.html';
    } else if ((type === 'like' || type === 'comment') && postId) {
      window.location.href = 'feed.html';
    }
  } catch (e) { /* silent */ }
}

/* ─────────────────────────────────────────────
   MARK ALL READ
───────────────────────────────────────────── */
async function markAllRead() {
  try {
    await apiFetch('/api/notifications/read-all', { method: 'PUT' });
    document.querySelectorAll('.notif-item.unread').forEach(el => {
      el.classList.remove('unread');
      el.querySelector('.notif-dot')?.remove();
    });
    setNotifBadge(0);
    showToast('All notifications marked as read', 'success');
  } catch (e) { showToast('Failed to mark as read', 'error'); }
}
