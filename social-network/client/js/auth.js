// auth.js — shared helpers used on every page
const API_URL = 'http://localhost:5000';

/* ── storage ── */
function getToken() { return localStorage.getItem('token'); }
function getStoredUser() { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; }
function saveAuth(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify({ _id: data._id, name: data.name, email: data.email, profilePicture: data.profilePicture || '' }));
}
function clearAuth() { localStorage.removeItem('token'); localStorage.removeItem('user'); }

/* ── fetch wrapper ── */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  } else {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error(`Backend returned an invalid response (${res.status})`);
  }
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

/* ── guards ── */
function requireAuth() { if (!getToken()) { window.location.href = 'login.html'; return false; } return true; }
function redirectIfLoggedIn() { if (getToken()) window.location.href = 'feed.html'; }

/* ── toast ── */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) { container = document.createElement('div'); container.id = 'toast-container'; container.className = 'toast-container'; document.body.appendChild(container); }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

/* ── helpers ── */
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function initialsFromName(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function avatarSrc(url, name = '') {
  const picture = typeof url === 'string' ? url.trim() : '';
  if (picture) return picture.startsWith('/') ? `${API_URL}${picture}` : picture;

  const initials = initialsFromName(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#263b5e"/><text x="50" y="54" fill="#54e1c1" font-family="Arial,sans-serif" font-size="32" font-weight="700" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── navbar ── */
function renderNavbar(activePage = '') {
  const user = getStoredUser();
  if (!user) return;
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  navbar.innerHTML = `
    <a href="feed.html" class="brand">SocialNet</a>
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" id="navbar-search" placeholder="Search people..." autocomplete="off" />
      <div id="search-dropdown" class="search-dropdown-panel"></div>
    </div>
    <nav class="nav-links">
      <a href="feed.html" class="nav-link ${activePage === 'feed' ? 'active' : ''}">🏠 <span>Feed</span></a>
      <a href="friends.html" class="nav-link ${activePage === 'friends' ? 'active' : ''}">👥 <span>Friends</span></a>
      <a href="notifications.html" class="nav-link ${activePage === 'notifications' ? 'active' : ''}">
        🔔 <span>Alerts</span>
        <span class="notif-badge" id="notif-badge" style="display:none">0</span>
      </a>
      <a href="profile.html?id=${user._id}" class="nav-link ${activePage === 'profile' ? 'active' : ''}">
        <img src="${avatarSrc(user.profilePicture, user.name)}" class="nav-avatar" alt="${escapeHtml(user.name || 'User')} avatar" />
      </a>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Logout</button>
    </nav>`;
  loadNotifCount();
  const searchInput = document.getElementById('navbar-search');
  const dropdown = document.getElementById('search-dropdown');
  let timer;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    const q = searchInput.value.trim();
    if (!q) { dropdown.style.display = 'none'; return; }
    timer = setTimeout(() => doNavSearch(q, dropdown), 300);
  });
  document.addEventListener('click', e => { if (!navbar.contains(e.target)) dropdown.style.display = 'none'; });
}

async function doNavSearch(q, dropdown) {
  try {
    const users = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (!users.length) {
      dropdown.innerHTML = '<div class="search-empty">No users found</div>';
    } else {
      dropdown.innerHTML = users.map(u => `
        <div class="search-result-item" onclick="window.location.href='profile.html?id=${u._id}'">
          <img class="search-result-avatar" src="${avatarSrc(u.profilePicture, u.name)}" alt="${escapeHtml(u.name || 'User')} avatar" />
          <div class="search-result-info"><strong>${escapeHtml(u.name)}</strong><span>${escapeHtml(u.bio || '')}</span></div>
        </div>`).join('');
    }
    dropdown.style.display = 'block';
  } catch (e) { dropdown.style.display = 'none'; }
}

async function loadNotifCount() {
  try {
    const data = await apiFetch('/api/notifications/count');
    const badge = document.getElementById('notif-badge');
    if (badge) { badge.textContent = data.count; badge.style.display = data.count > 0 ? 'inline' : 'none'; }
    document.querySelectorAll('.bottom-notif-badge').forEach(b => {
      b.textContent = data.count; b.style.display = data.count > 0 ? 'inline' : 'none';
    });
  } catch (e) { /* silent */ }
}

function setNotifBadge(count) {
  document.querySelectorAll('.notif-badge, .bottom-notif-badge').forEach(b => {
    b.textContent = count > 0 ? count : ''; b.style.display = count > 0 ? 'inline' : 'none';
  });
}

function incrementNotifBadge() {
  document.querySelectorAll('.notif-badge, .bottom-notif-badge').forEach(b => {
    const n = (parseInt(b.textContent) || 0) + 1;
    b.textContent = n; b.style.display = 'inline';
  });
}

/* ── bottom nav ── */
function renderBottomNav(activePage = '') {
  const user = getStoredUser();
  if (!user) return;
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  nav.innerHTML = `
    <a href="feed.html" class="bottom-nav-item ${activePage === 'feed' ? 'active' : ''}"><span class="icon">🏠</span><span>Feed</span></a>
    <a href="friends.html" class="bottom-nav-item ${activePage === 'friends' ? 'active' : ''}"><span class="icon">👥</span><span>Friends</span></a>
    <a href="notifications.html" class="bottom-nav-item ${activePage === 'notifications' ? 'active' : ''}">
      <span class="icon">🔔</span><span class="bottom-notif-badge" style="display:none">0</span><span>Alerts</span>
    </a>
    <a href="profile.html?id=${user._id}" class="bottom-nav-item ${activePage === 'profile' ? 'active' : ''}"><span class="icon">👤</span><span>Profile</span></a>
    <a href="settings.html" class="bottom-nav-item ${activePage === 'settings' ? 'active' : ''}"><span class="icon">⚙️</span><span>Settings</span></a>`;
}

/* ── logout ── */
function logout() {
  if (typeof disconnectSocket === 'function') disconnectSocket();
  clearAuth();
  window.location.href = 'login.html';
}
