// settings.js — Account settings and privacy controls

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  renderNavbar('settings');
  renderBottomNav('settings');
  initSocket();

  const spl = document.getElementById('sidebar-profile-link');
  if (spl) spl.href = `profile.html?id=${getStoredUser()._id}`;

  // Set preview avatar
  const user = getStoredUser();
  const preview = document.getElementById('settings-preview');
  if (preview && user) preview.src = avatarSrc(user.profilePicture, user.name);

  await loadCurrentSettings();
});

/* ─────────────────────────────────────────────
   LOAD CURRENT SETTINGS
───────────────────────────────────────────── */
async function loadCurrentSettings() {
  try {
    const user = await apiFetch('/api/auth/me');

    const nameEl  = document.getElementById('settings-name');
    const bioEl   = document.getElementById('settings-bio');
    const emailEl = document.getElementById('settings-email');
    const profEl  = document.getElementById('profile-privacy');
    const postEl  = document.getElementById('posts-privacy');

    if (nameEl)  nameEl.value  = user.name  || '';
    if (bioEl)   bioEl.value   = user.bio   || '';
    if (emailEl) emailEl.value = user.email || '';
    if (profEl)  profEl.value  = user.privacy?.profile || 'public';
    if (postEl)  postEl.value  = user.privacy?.posts   || 'public';
  } catch (e) { showToast('Failed to load settings', 'error'); }
}

/* ─────────────────────────────────────────────
   SAVE PROFILE INFO
───────────────────────────────────────────── */
async function saveProfileInfo() {
  const name = document.getElementById('settings-name')?.value.trim();
  const bio  = document.getElementById('settings-bio')?.value.trim();
  if (!name) { showToast('Name cannot be empty', 'error'); return; }
  try {
    const updated = await apiFetch('/api/users/profile', {
      method: 'PUT', body: JSON.stringify({ name, bio })
    });
    const stored = getStoredUser();
    stored.name = updated.name;
    localStorage.setItem('user', JSON.stringify(stored));
    showToast('Profile saved!', 'success');
  } catch (e) { showToast('Failed to save profile', 'error'); }
}

/* ─────────────────────────────────────────────
   SAVE PRIVACY SETTINGS
───────────────────────────────────────────── */
async function savePrivacySettings() {
  const profilePrivacy = document.getElementById('profile-privacy')?.value;
  const postsPrivacy   = document.getElementById('posts-privacy')?.value;
  try {
    await apiFetch('/api/users/privacy', {
      method: 'PUT', body: JSON.stringify({ profilePrivacy, postsPrivacy })
    });
    showToast('Privacy settings saved!', 'success');
  } catch (e) { showToast('Failed to save privacy settings', 'error'); }
}

/* ─────────────────────────────────────────────
   UPLOAD PROFILE PICTURE FROM SETTINGS
───────────────────────────────────────────── */
async function uploadPicFromSettings(input) {
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('profilePicture', file);
  try {
    const updated = await apiFetch('/api/users/profile', { method: 'PUT', body: formData, headers: {} });
    const stored  = getStoredUser();
    stored.profilePicture = updated.profilePicture;
    localStorage.setItem('user', JSON.stringify(stored));
    const preview = document.getElementById('settings-preview');
    if (preview) preview.src = avatarSrc(updated.profilePicture, updated.name || stored.name);
    showToast('Profile picture updated!', 'success');
  } catch (e) { showToast('Failed to upload picture', 'error'); }
}

/* ─────────────────────────────────────────────
   LOGOUT
───────────────────────────────────────────── */
function handleLogout() {
  if (confirm('Are you sure you want to logout?')) logout();
}
