/**
 * auth.js
 * ---------------------------------------------------------------------------
 * Client-side authentication module. Manages JWT tokens in localStorage,
 * provides login/register/logout helpers, and updates the UI header to
 * reflect the current auth state (signed-in user vs guest).
 * ---------------------------------------------------------------------------
 */

const Auth = (() => {
  const TOKEN_KEY = 'resumeai:token';
  const USER_KEY  = 'resumeai:user';
  // Per-account resume cache keys (localStorage). Cleared on logout / new login
  // so one account's draft and saved list never bleed into another's session.
  const CACHE_KEYS = ['resumeai:current', 'resumeai:saved'];

  // ---- Token helpers -------------------------------------------------------
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function setSession(token, user) {
    // A fresh session means a fresh user — clear the previous account's
    // locally-cached resume data so accounts never share the same content.
    clearResumeData();
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function updateUser(userData) {
    const current = getUser() || {};
    const updated = { ...current, ...userData };
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    updateHeader();
    return updated;
  }

  // Clears the resume draft + saved-list cache stored on this device. Called
  // on sign-out and whenever a new session starts, so switching accounts never
  // shows one user's data to another.
  function clearResumeData() {
    CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
  }

  function isLoggedIn() {
    return !!getToken();
  }

  const ADMIN_ROLES = ['super_admin', 'content_manager', 'moderator', 'viewer', 'admin'];

  function isAdmin() {
    const user = getUser();
    return user && ADMIN_ROLES.includes(user.role);
  }

  function getRole() {
    const user = getUser();
    return (user && user.role) || 'user';
  }

  // ---- API calls -----------------------------------------------------------
  async function register(email, password, fullName) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Registration failed');
    setSession(data.access_token, data.user);
    return data;
  }

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Login failed');
    setSession(data.access_token, data.user);
    return data;
  }

  function logout() {
    clearResumeData();
    clearSession();
    window.location.href = '/';
  }

  // Signs the user in with a Google ID token (from the GIS button) — POSTs it
  // to the backend, which verifies it and returns this app's JWT + profile.
  async function googleLogin(credential) {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Google sign-in failed');
    setSession(data.access_token, data.user);
    return data;
  }

  async function forgotPassword(email) {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Could not send reset email');
    return data;
  }

  async function resetPassword(token, newPassword) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Could not reset password');
    return data;
  }

  // ---- Authenticated fetch wrapper -----------------------------------------
  async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = JSON.stringify(body);
    }
    const res = await fetch(url, { ...options, headers, body });
    if (res.status === 401) {
      clearSession();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    return res;
  }

  // ---- UI header update ----------------------------------------------------
  function updateHeader() {
    const actionsEl = document.querySelector('.site-header .nav-actions, .marketing-header .nav-actions');
    if (!actionsEl) return;

    let authSlot = actionsEl.querySelector('#header-auth-slot');
    if (!authSlot) {
      authSlot = document.createElement('div');
      authSlot.id = 'header-auth-slot';
      authSlot.style.display = 'inline-flex';
      authSlot.style.alignItems = 'center';
      authSlot.style.gap = 'var(--space-2)';

      const guestLogin = actionsEl.querySelector('a[href="/login"]');
      const guestReg = actionsEl.querySelector('a[href="/login?tab=register"]');
      if (guestLogin) guestLogin.remove();
      if (guestReg) guestReg.remove();
      actionsEl.appendChild(authSlot);
    }

    const user = getUser();
    if (user) {
      const adminDropdownLink = isAdmin()
        ? '<a href="/admin">⚡ Admin Panel</a>'
        : '';
      // Small round avatar (uploaded profile pic from the Account page), with
      // an initial-letter fallback when no photo has been uploaded yet.
      const displayName = user.full_name || user.email.split('@')[0];
      const initial = (user.full_name || user.email || 'U').trim().charAt(0).toUpperCase();
      const avatarHtml = user.profile_picture_url
        ? `<img class="user-menu-avatar" src="${user.profile_picture_url}" alt="" referrerpolicy="no-referrer">`
        : `<span class="user-menu-avatar user-menu-avatar-fallback" aria-hidden="true">${initial}</span>`;
      authSlot.innerHTML = `
        <div class="user-menu" style="position:relative;display:inline-block">
          <button class="btn btn-primary btn-sm user-menu-trigger" aria-expanded="false" aria-label="Open user menu">
            ${avatarHtml}
            <span class="user-menu-name">${displayName}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="user-menu-dropdown">
            <div class="user-menu-info">
              <strong>${user.full_name || 'User'}</strong>
              <span class="text-muted" style="font-size:var(--text-xs)">${user.email}</span>
              <span class="user-plan-badge">${user.plan || 'free'}</span>
            </div>
            <a href="/dashboard#account">👤 Account</a>
            <a href="/dashboard">📊 Dashboard</a>
            ${adminDropdownLink}
            <button id="logout-btn" class="user-menu-logout">Sign out</button>
          </div>
        </div>
      `;
      // User menu toggle
      const trigger = authSlot.querySelector('.user-menu-trigger');
      const dropdown = authSlot.querySelector('.user-menu-dropdown');
      if (trigger && dropdown) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const open = dropdown.classList.toggle('is-open');
          trigger.setAttribute('aria-expanded', open);
        });
        document.addEventListener('click', () => {
          dropdown.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        });
      }
      // Logout
      const logoutBtn = authSlot.querySelector('#logout-btn');
      if (logoutBtn) logoutBtn.addEventListener('click', logout);
    } else {
      authSlot.innerHTML = `
        <a href="/login" class="btn btn-ghost btn-sm">Sign in</a>
        <a href="/login?tab=register" class="btn btn-primary btn-sm">Get started</a>
      `;
    }

  }

  // ---- Auth guard (redirect if not logged in) ------------------------------
  function requireAuth() {
    if (!isLoggedIn()) {
      const nextPath = window.location.pathname + window.location.search + window.location.hash;
      window.location.href = '/login?next=' + encodeURIComponent(nextPath);
      return false;
    }
    return true;
  }

  function requireAdmin() {
    if (!isAdmin()) {
      window.location.href = '/';
      return false;
    }
    return true;
  }

  // Auto-update header on page load
  document.addEventListener('DOMContentLoaded', updateHeader);

  return {
    getToken,
    getUser,
    setSession,
    updateUser,
    clearSession,
    clearResumeData,
    isLoggedIn,
    isAdmin,
    getRole,
    register,
    login,
    googleLogin,
    logout,
    forgotPassword,
    resetPassword,
    apiFetch,
    updateHeader,
    requireAuth,
    requireAdmin,
  };
})();
