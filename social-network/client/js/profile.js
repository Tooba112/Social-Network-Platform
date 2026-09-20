// profile.js — Profile page logic

let profileUser    = null;
let currentUser    = null;
let friendStatus   = { status: 'none' };

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  currentUser = getStoredUser();

  renderNavbar('profile');
  renderBottomNav('profile');
  initSocket();

  // Fix sidebar profile link
  const spl = document.getElementById('sidebar-profile-link');
  if (spl) spl.href = `profile.html?id=${currentUser._id}`;

  const params = new URLSearchParams(window.location.search);
  const userId = params.get('id') || currentUser._id;

  await loadProfile(userId);
  await loadUserPosts(userId);
});

/* ─────────────────────────────────────────────
   LOAD PROFILE
───────────────────────────────────────────── */
async function loadProfile(userId) {
  const container = document.getElementById('profile-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  try {
    profileUser = await apiFetch(`/api/users/${userId}`);
    const isSelf = userId === currentUser._id;
    if (!isSelf) {
      friendStatus = await apiFetch(`/api/friends/status/${userId}`);
    } else {
      friendStatus = { status: 'self' };
    }
    container.innerHTML = renderProfileHeader(profileUser, isSelf, friendStatus);

    // Pre-fill edit form if self
    if (isSelf) {
      const nameEl = document.getElementById('edit-name');
      const bioEl  = document.getElementById('edit-bio');
      if (nameEl) nameEl.value = profileUser.name || '';
      if (bioEl)  bioEl.value  = profileUser.bio  || '';
    }
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><p>${escapeHtml(e.message)}</p></div>`;
  }
}

/* ─────────────────────────────────────────────
   RENDER PROFILE HEADER
───────────────────────────────────────────── */
function renderProfileHeader(user, isSelf, status) {
  const friendsCount = user.friends ? user.friends.length : 0;
  let actionButtons = '';

  if (isSelf) {
    actionButtons = `<button class="btn btn-secondary btn-sm" onclick="toggleEditForm()">✏️ Edit Profile</button>`;
  } else if (status.status === 'friends') {
    actionButtons = `
      <button class="btn btn-secondary btn-sm" onclick="unfriend('${user._id}')">✅ Friends</button>`;
  } else if (status.status === 'request_sent') {
    actionButtons = `<button class="btn btn-secondary btn-sm" disabled>📨 Request Sent</button>`;
  } else if (status.status === 'request_received') {
    actionButtons = `
      <button class="btn btn-success btn-sm" onclick="acceptFriendRequest('${status.requestId}')">✓ Accept</button>
      <button class="btn btn-secondary btn-sm" onclick="rejectFriendRequest('${status.requestId}')">✕ Reject</button>`;
  } else {
    actionButtons = `<button class="btn btn-primary btn-sm" onclick="sendFriendReq('${user._id}')">+ Add Friend</button>`;
  }

  return `
  <div class="profile-header-card">
    <div class="profile-cover"></div>
    <div class="profile-info">
      <div class="profile-pic-wrapper">
        <img class="profile-pic" id="profile-pic-img" src="${avatarSrc(user.profilePicture, user.name)}" alt="${escapeHtml(user.name)} avatar" />
        ${isSelf ? `
          <button class="profile-pic-edit" title="Change photo" onclick="document.getElementById('pic-upload-input').click()">📷</button>
          <input type="file" id="pic-upload-input" accept="image/*" style="display:none" onchange="uploadProfilePic(this)" />` : ''}
      </div>
      <div class="profile-details">
        <h1>${escapeHtml(user.name)}</h1>
        <p class="bio">${escapeHtml(user.bio || 'No bio yet.')}</p>
        <div class="profile-stats">
          <div class="stat"><strong id="friends-count">${friendsCount}</strong><span>Friends</span></div>
          <div class="stat"><strong id="posts-count">—</strong><span>Posts</span></div>
        </div>
        <div class="profile-actions">${actionButtons}</div>
      </div>
    </div>
  </div>

  ${isSelf ? `
  <div class="card" id="edit-form-card" style="display:none;">
    <div class="card-header"><h3>Edit Profile</h3></div>
    <div class="card-body">
      <div class="form-group">
        <label>Display Name</label>
        <input type="text" id="edit-name" maxlength="50" />
      </div>
      <div class="form-group">
        <label>Bio</label>
        <textarea id="edit-bio" rows="3" maxlength="200" placeholder="Tell us about yourself…"></textarea>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="toggleEditForm()">Cancel</button>
        <button class="btn btn-primary" onclick="saveProfile()">Save Changes</button>
      </div>
    </div>
  </div>` : ''}`;
}

/* ─────────────────────────────────────────────
   EDIT PROFILE
───────────────────────────────────────────── */
function toggleEditForm() {
  const card = document.getElementById('edit-form-card');
  if (card) card.style.display = card.style.display === 'none' ? 'block' : 'none';
}

async function saveProfile() {
  const name = document.getElementById('edit-name').value.trim();
  const bio  = document.getElementById('edit-bio').value.trim();
  if (!name) { showToast('Name cannot be empty', 'error'); return; }
  try {
    const updated = await apiFetch('/api/users/profile', {
      method: 'PUT', body: JSON.stringify({ name, bio })
    });
    // Update stored user
    const stored = getStoredUser();
    stored.name = updated.name;
    stored.profilePicture = updated.profilePicture;
    localStorage.setItem('user', JSON.stringify(stored));
    showToast('Profile updated!', 'success');
    toggleEditForm();
    await loadProfile(currentUser._id);
  } catch (e) { showToast('Failed to update profile', 'error'); }
}

async function uploadProfilePic(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('profilePicture', file);
  try {
    const updated = await apiFetch('/api/users/profile', { method: 'PUT', body: formData, headers: {} });
    const stored  = getStoredUser();
    stored.profilePicture = updated.profilePicture;
    localStorage.setItem('user', JSON.stringify(stored));
    const img = document.getElementById('profile-pic-img');
    if (img) img.src = avatarSrc(updated.profilePicture, updated.name || profileUser.name);
    showToast('Profile picture updated!', 'success');
  } catch (e) { showToast('Failed to upload picture', 'error'); }
}

/* ─────────────────────────────────────────────
   USER POSTS
───────────────────────────────────────────── */
async function loadUserPosts(userId) {
  const container = document.getElementById('user-posts');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  try {
    const posts = await apiFetch(`/api/users/${userId}/posts`);
    const countEl = document.getElementById('posts-count');
    if (countEl) countEl.textContent = posts.length;
    if (!posts.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No posts yet.</p></div>';
      return;
    }
    container.innerHTML = posts.map(p => renderProfilePost(p)).join('');
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p class="error-msg">${escapeHtml(e.message)}</p></div>`;
  }
}

function renderProfilePost(post) {
  const isOwner   = post.author._id === currentUser._id;
  const liked     = post.likes.includes(currentUser._id);
  const likeCount = post.likes.length;
  return `
  <div class="post-card" id="post-${post._id}">
    <div class="post-header">
      <img class="post-avatar" src="${avatarSrc(post.author.profilePicture, post.author.name)}" alt="${escapeHtml(post.author.name)} avatar" />
      <div class="post-author-info">
        <strong>${escapeHtml(post.author.name)}</strong>
        <span>${timeAgo(post.createdAt)} · ${post.visibility}</span>
      </div>
      ${isOwner ? `
        <div class="post-menu">
          <button class="post-menu-btn" onclick="togglePMenu('pmenu-${post._id}')">⋯</button>
          <div class="dropdown-menu" id="pmenu-${post._id}">
            <div class="dropdown-item danger" onclick="deleteProfilePost('${post._id}')">🗑️ Delete</div>
          </div>
        </div>` : ''}
    </div>
    <div class="post-content">${escapeHtml(post.content)}</div>
    ${post.video ? `<video class="post-video" controls preload="metadata" aria-label="Video post"><source src="${API_URL}${post.video}" type="video/${post.video.split('.').pop().toLowerCase()}">Your browser does not support video playback.</video>` : post.image ? `<img class="post-image" src="${API_URL}${post.image}" alt="post" loading="lazy" />` : ''}
    <div class="post-actions">
      <button class="action-btn ${liked ? 'liked' : ''}" onclick="likeProfilePost('${post._id}',this)">
        ${liked ? '❤️' : '🤍'} <span>${likeCount}</span>
      </button>
    </div>
  </div>`;
}

function togglePMenu(menuId) {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => { if (m.id !== menuId) m.classList.remove('open'); });
  document.getElementById(menuId)?.classList.toggle('open');
}

async function deleteProfilePost(postId) {
  if (!confirm('Delete this post?')) return;
  try {
    await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
    document.getElementById(`post-${postId}`)?.remove();
    showToast('Post deleted', 'success');
    const c = document.getElementById('posts-count');
    if (c) c.textContent = Math.max(0, parseInt(c.textContent) - 1);
  } catch (e) { showToast('Failed to delete post', 'error'); }
}

async function likeProfilePost(postId, btn) {
  try {
    const data = await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
    btn.className = `action-btn ${data.liked ? 'liked' : ''}`;
    btn.innerHTML = `${data.liked ? '❤️' : '🤍'} <span>${data.likes.length}</span>`;
  } catch (e) { showToast('Failed to like post', 'error'); }
}

/* ─────────────────────────────────────────────
   FRIEND ACTIONS FROM PROFILE
───────────────────────────────────────────── */
async function sendFriendReq(userId) {
  try {
    await apiFetch(`/api/friends/request/${userId}`, { method: 'POST' });
    showToast('Friend request sent!', 'success');
    await loadProfile(userId);
  } catch (e) { showToast(e.message, 'error'); }
}

async function acceptFriendRequest(requestId) {
  try {
    await apiFetch(`/api/friends/accept/${requestId}`, { method: 'PUT' });
    showToast('Friend request accepted!', 'success');
    const params = new URLSearchParams(window.location.search);
    await loadProfile(params.get('id'));
  } catch (e) { showToast(e.message, 'error'); }
}

async function rejectFriendRequest(requestId) {
  try {
    await apiFetch(`/api/friends/reject/${requestId}`, { method: 'PUT' });
    showToast('Request rejected', 'info');
    const params = new URLSearchParams(window.location.search);
    await loadProfile(params.get('id'));
  } catch (e) { showToast(e.message, 'error'); }
}

async function unfriend(userId) {
  if (!confirm('Remove this friend?')) return;
  try {
    await apiFetch(`/api/friends/remove/${userId}`, { method: 'DELETE' });
    showToast('Friend removed', 'info');
    await loadProfile(userId);
  } catch (e) { showToast(e.message, 'error'); }
}
