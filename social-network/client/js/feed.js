// feed.js — Main news feed page logic

let currentUser = null;
let selectedFile = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  currentUser = getStoredUser();

  renderNavbar('feed');
  renderBottomNav('feed');
  initSocket();

  // Fix sidebar profile link
  const spl = document.getElementById('sidebar-profile-link');
  if (spl) spl.href = `profile.html?id=${currentUser._id}`;

  // Set avatar in create-post box
  const cpAvatar = document.getElementById('create-post-avatar');
  if (cpAvatar) cpAvatar.src = avatarSrc(currentUser.profilePicture, currentUser.name);

  await loadFeed();
  setupPostImagePicker();
  setupRightPanelSearch();
});

/* ─────────────────────────────────────────────
   FEED
───────────────────────────────────────────── */
async function loadFeed() {
  const feed = document.getElementById('feed-posts');
  if (!feed) return;
  feed.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading feed…</p></div>';
  try {
    const posts = await apiFetch('/api/posts/feed');
    if (!posts.length) {
      feed.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div>
        <p>Your feed is empty. Add friends to see their posts!</p>
        <a href="friends.html" class="btn btn-primary" style="margin-top:12px;">Find Friends</a></div>`;
      return;
    }
    feed.innerHTML = posts.map(renderPostCard).join('');
  } catch (e) {
    feed.innerHTML = `<div class="empty-state"><p class="error-msg">Failed to load feed: ${escapeHtml(e.message)}</p></div>`;
  }
}

/* ─────────────────────────────────────────────
   RENDER POST CARD
───────────────────────────────────────────── */
function renderPostCard(post) {
  const isOwner = post.author._id === currentUser._id;
  const liked   = post.likes.includes(currentUser._id);
  const likeCount = post.likes.length;

  return `
  <div class="post-card" id="post-${post._id}">
    <div class="post-header">
      <img class="post-avatar" src="${avatarSrc(post.author.profilePicture, post.author.name)}" alt="${escapeHtml(post.author.name)} avatar" />
      <div class="post-author-info">
        <strong><a href="profile.html?id=${post.author._id}">${escapeHtml(post.author.name)}</a></strong>
        <span>${timeAgo(post.createdAt)} · ${post.visibility}</span>
      </div>
      ${isOwner ? `
        <div class="post-menu">
          <button class="post-menu-btn" onclick="togglePostMenu('menu-${post._id}')">⋯</button>
          <div class="dropdown-menu" id="menu-${post._id}">
            <div class="dropdown-item" onclick="openEditModal('${post._id}','${escapeHtml(post.content).replace(/'/g,"\\'")}','${post.visibility}')">✏️ Edit</div>
            <div class="dropdown-item danger" onclick="deletePost('${post._id}')">🗑️ Delete</div>
          </div>
        </div>` : ''}
    </div>
    <div class="post-content">${escapeHtml(post.content)}</div>
    ${renderPostMedia(post)}
    <div class="post-actions">
      <button class="action-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${post._id}',this)">
        ${liked ? '❤️' : '🤍'} <span>${likeCount} ${likeCount === 1 ? 'Like' : 'Likes'}</span>
      </button>
      <button class="action-btn" onclick="toggleComments('${post._id}')">
        💬 <span>Comment</span>
      </button>
    </div>
    <div class="comments-section" id="comments-${post._id}" style="display:none;">
      <div class="comments-list" id="comments-list-${post._id}"></div>
      <div class="comment-form">
        <img class="comment-avatar" src="${avatarSrc(currentUser.profilePicture, currentUser.name)}" alt="Your avatar" />
        <input type="text" placeholder="Write a comment…" id="comment-input-${post._id}"
          onkeydown="if(event.key==='Enter') submitComment('${post._id}')" />
        <button class="btn btn-primary btn-sm" onclick="submitComment('${post._id}')">Post</button>
      </div>
    </div>
  </div>`;
}

function renderPostMedia(post) {
  if (post.video) {
    return `<video class="post-video" controls preload="metadata" aria-label="Video post">
      <source src="${API_URL}${post.video}" type="video/${post.video.split('.').pop().toLowerCase()}">
      Your browser does not support video playback.
    </video>`;
  }
  return post.image ? `<img class="post-image" src="${API_URL}${post.image}" alt="post image" loading="lazy" />` : '';
}

/* ─────────────────────────────────────────────
   POST MENU
───────────────────────────────────────────── */
function togglePostMenu(menuId) {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => { if (m.id !== menuId) m.classList.remove('open'); });
  const m = document.getElementById(menuId);
  if (m) m.classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.classList.contains('post-menu-btn')) {
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  }
});

/* ─────────────────────────────────────────────
   LIKE / UNLIKE
───────────────────────────────────────────── */
async function toggleLike(postId, btn) {
  try {
    const data = await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
    const count = data.likes.length;
    btn.className = `action-btn ${data.liked ? 'liked' : ''}`;
    btn.innerHTML = `${data.liked ? '❤️' : '🤍'} <span>${count} ${count === 1 ? 'Like' : 'Likes'}</span>`;
  } catch (e) { showToast('Failed to like post', 'error'); }
}

/* ─────────────────────────────────────────────
   COMMENTS
───────────────────────────────────────────── */
async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (section.style.display !== 'none') { section.style.display = 'none'; return; }
  section.style.display = 'block';
  await loadComments(postId);
}

async function loadComments(postId) {
  const list = document.getElementById(`comments-list-${postId}`);
  list.innerHTML = '<div style="padding:8px 0;color:var(--text-secondary);font-size:0.82rem;">Loading…</div>';
  try {
    const comments = await apiFetch(`/api/posts/${postId}/comments`);
    if (!comments.length) { list.innerHTML = '<p style="padding:8px 0;color:var(--text-secondary);font-size:0.82rem;">No comments yet.</p>'; return; }
    list.innerHTML = comments.map(c => renderComment(c, postId)).join('');
  } catch (e) { list.innerHTML = '<p class="error-msg">Failed to load comments</p>'; }
}

function renderComment(c, postId) {
  const isOwner = c.author._id === currentUser._id;
  return `
  <div class="comment-item" id="comment-item-${c._id}">
    <img class="comment-avatar" src="${avatarSrc(c.author.profilePicture, c.author.name)}" alt="${escapeHtml(c.author.name)} avatar" />
    <div>
      <div class="comment-bubble">
        <div class="comment-author">${escapeHtml(c.author.name)}</div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
      </div>
      <div class="comment-meta">
        <span>${timeAgo(c.createdAt)}</span>
        ${isOwner ? `<button class="comment-delete" onclick="deleteComment('${postId}','${c._id}')">Delete</button>` : ''}
      </div>
    </div>
  </div>`;
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;
  try {
    const comment = await apiFetch(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
    input.value = '';
    const list = document.getElementById(`comments-list-${postId}`);
    if (list.innerHTML.includes('No comments yet')) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', renderComment(comment, postId));
  } catch (e) { showToast('Failed to post comment', 'error'); }
}

async function deleteComment(postId, commentId) {
  if (!confirm('Delete this comment?')) return;
  try {
    await apiFetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
    document.getElementById(`comment-item-${commentId}`)?.remove();
  } catch (e) { showToast('Failed to delete comment', 'error'); }
}

/* ─────────────────────────────────────────────
   DELETE POST
───────────────────────────────────────────── */
async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  try {
    await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
    document.getElementById(`post-${postId}`)?.remove();
    showToast('Post deleted', 'success');
  } catch (e) { showToast('Failed to delete post', 'error'); }
}

/* ─────────────────────────────────────────────
   EDIT POST MODAL
───────────────────────────────────────────── */
function openEditModal(postId, content, visibility) {
  document.getElementById('edit-post-id').value = postId;
  document.getElementById('edit-content').value = content;
  document.getElementById('edit-visibility').value = visibility;
  document.getElementById('edit-modal').style.display = 'flex';
}
function closeEditModal() { document.getElementById('edit-modal').style.display = 'none'; }

async function saveEditPost() {
  const postId     = document.getElementById('edit-post-id').value;
  const content    = document.getElementById('edit-content').value.trim();
  const visibility = document.getElementById('edit-visibility').value;
  if (!content) { showToast('Post cannot be empty', 'error'); return; }
  try {
    const updated = await apiFetch(`/api/posts/${postId}`, { method: 'PUT', body: JSON.stringify({ content, visibility }) });
    const card = document.getElementById(`post-${postId}`);
    if (card) {
      card.querySelector('.post-content').textContent = updated.content;
      const meta = card.querySelector('.post-author-info span');
      if (meta) meta.textContent = `${timeAgo(updated.createdAt)} · ${updated.visibility}`;
    }
    closeEditModal();
    showToast('Post updated', 'success');
  } catch (e) { showToast('Failed to update post', 'error'); }
}

/* ─────────────────────────────────────────────
   CREATE POST
───────────────────────────────────────────── */
function setupPostImagePicker() {
  const fileInput = document.getElementById('post-image-input');
  if (!fileInput) return;
  fileInput.addEventListener('change', e => {
    selectedFile = e.target.files[0];
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const preview = document.getElementById('image-preview');
      if (!preview) return;
      const mediaPreview = selectedFile.type.startsWith('video/')
        ? `<video controls preload="metadata" src="${ev.target.result}" aria-label="Video preview"></video>`
        : `<img src="${ev.target.result}" alt="Image preview" />`;
      preview.innerHTML = `<div class="post-image-preview">${mediaPreview}<button class="remove-image-btn" onclick="removeSelectedImage()">✕</button></div>`;
    };
    if (selectedFile.type.startsWith('video/')) {
      reader.readAsDataURL(selectedFile);
    } else {
      reader.readAsDataURL(selectedFile);
    }
  });
}

function removeSelectedImage() {
  selectedFile = null;
  const preview = document.getElementById('image-preview');
  if (preview) preview.innerHTML = '';
  const fileInput = document.getElementById('post-image-input');
  if (fileInput) fileInput.value = '';
}

async function submitPost() {
  const contentEl    = document.getElementById('post-content');
  const visibilityEl = document.getElementById('post-visibility');
  const submitBtn    = document.getElementById('submit-post-btn');
  const content      = contentEl.value.trim();
  const visibility   = visibilityEl ? visibilityEl.value : 'public';

  if (!content) { showToast('Please write something!', 'error'); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Posting…';

  try {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('visibility', visibility);
    if (selectedFile) formData.append('media', selectedFile);

    const post = await apiFetch('/api/posts', { method: 'POST', body: formData, headers: {} });

    contentEl.value = '';
    removeSelectedImage();

    const feedEl = document.getElementById('feed-posts');
    const emptyState = feedEl?.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    if (feedEl) feedEl.insertAdjacentHTML('afterbegin', renderPostCard(post));

    showToast('Post created!', 'success');
  } catch (e) {
    showToast(`Failed: ${escapeHtml(e.message)}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post';
  }
}

/* ─────────────────────────────────────────────
   RIGHT PANEL SEARCH
───────────────────────────────────────────── */
function setupRightPanelSearch() {
  const input     = document.getElementById('sidebar-search');
  const resultsEl = document.getElementById('sidebar-search-results');
  if (!input || !resultsEl) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { resultsEl.innerHTML = ''; return; }
    timer = setTimeout(async () => {
      try {
        const users = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (!users.length) { resultsEl.innerHTML = '<p style="font-size:0.82rem;color:var(--text-secondary);padding:4px 0;">No users found</p>'; return; }
        resultsEl.innerHTML = users.slice(0, 5).map(u => `
          <div class="suggestion-item" style="cursor:pointer;" onclick="window.location.href='profile.html?id=${u._id}'">
            <img class="suggestion-avatar" src="${avatarSrc(u.profilePicture, u.name)}" alt="${escapeHtml(u.name)} avatar" />
            <div class="suggestion-info">
              <strong>${escapeHtml(u.name)}</strong>
              <span>${escapeHtml(u.bio || '')}</span>
            </div>
          </div>`).join('');
      } catch (e) { /* silent */ }
    }, 300);
  });
}
