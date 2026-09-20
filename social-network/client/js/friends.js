// friends.js — Friends list and friend requests page

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  renderNavbar('friends');
  renderBottomNav('friends');
  initSocket();

  const spl = document.getElementById('sidebar-profile-link');
  if (spl) spl.href = `profile.html?id=${getStoredUser()._id}`;

  setupTabs();
  await Promise.all([loadPendingRequests(), loadFriends()]);
});

/* ─────────────────────────────────────────────
   TABS
───────────────────────────────────────────── */
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => { p.style.display = 'none'; });
      btn.classList.add('active');
      const panel = document.getElementById(btn.dataset.tab);
      if (panel) panel.style.display = 'block';
    });
  });
}

/* ─────────────────────────────────────────────
   PENDING REQUESTS
───────────────────────────────────────────── */
async function loadPendingRequests() {
  const container = document.getElementById('pending-requests');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  try {
    const requests = await apiFetch('/api/friends/requests');

    // Update badge on the tab button
    const badge = document.getElementById('requests-badge');
    if (badge) {
      badge.textContent = requests.length;
      badge.style.display = requests.length > 0 ? 'inline' : 'none';
    }

    if (!requests.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No pending friend requests.</p></div>';
      return;
    }

    container.innerHTML = requests.map(req => `
      <div class="friend-card" id="req-${req._id}">
        <img class="friend-avatar" src="${avatarSrc(req.sender.profilePicture, req.sender.name)}" alt="${escapeHtml(req.sender.name)} avatar" />
        <div class="friend-info">
          <strong>${escapeHtml(req.sender.name)}</strong>
          <span>${escapeHtml(req.sender.bio || 'No bio')}</span>
        </div>
        <div class="friend-actions">
          <button class="btn btn-success btn-sm" onclick="acceptRequest('${req._id}')">✓ Accept</button>
          <button class="btn btn-secondary btn-sm" onclick="rejectRequest('${req._id}')">✕ Reject</button>
          <a href="profile.html?id=${req.sender._id}" class="btn btn-ghost btn-sm">Profile</a>
        </div>
      </div>`).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><p class="error-msg">Failed to load requests</p></div>';
  }
}

/* ─────────────────────────────────────────────
   FRIENDS LIST
───────────────────────────────────────────── */
async function loadFriends() {
  const container = document.getElementById('friends-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  try {
    const friends = await apiFetch('/api/friends');
    if (!friends.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No friends yet. Search for people to add!</p></div>';
      return;
    }
    container.innerHTML = friends.map(f => `
      <div class="friend-card" id="friend-${f._id}">
        <img class="friend-avatar" src="${avatarSrc(f.profilePicture, f.name)}" alt="${escapeHtml(f.name)} avatar" />
        <div class="friend-info">
          <strong>${escapeHtml(f.name)}</strong>
          <span>${escapeHtml(f.bio || 'No bio')}</span>
        </div>
        <div class="friend-actions">
          <a href="profile.html?id=${f._id}" class="btn btn-primary btn-sm">View Profile</a>
          <button class="btn btn-secondary btn-sm" onclick="removeFriend('${f._id}')">Remove</button>
        </div>
      </div>`).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><p class="error-msg">Failed to load friends</p></div>';
  }
}

/* ─────────────────────────────────────────────
   ACCEPT / REJECT / REMOVE
───────────────────────────────────────────── */
async function acceptRequest(requestId) {
  try {
    await apiFetch(`/api/friends/accept/${requestId}`, { method: 'PUT' });
    showToast('Friend request accepted!', 'success');
    document.getElementById(`req-${requestId}`)?.remove();
    await loadFriends();
    // Update badge count
    const badge = document.getElementById('requests-badge');
    if (badge) {
      const n = Math.max(0, (parseInt(badge.textContent) || 0) - 1);
      badge.textContent = n; badge.style.display = n > 0 ? 'inline' : 'none';
    }
  } catch (e) { showToast(e.message, 'error'); }
}

async function rejectRequest(requestId) {
  try {
    await apiFetch(`/api/friends/reject/${requestId}`, { method: 'PUT' });
    showToast('Request rejected', 'info');
    document.getElementById(`req-${requestId}`)?.remove();
  } catch (e) { showToast(e.message, 'error'); }
}

async function removeFriend(friendId) {
  if (!confirm('Remove this friend?')) return;
  try {
    await apiFetch(`/api/friends/remove/${friendId}`, { method: 'DELETE' });
    showToast('Friend removed', 'info');
    document.getElementById(`friend-${friendId}`)?.remove();
  } catch (e) { showToast(e.message, 'error'); }
}
