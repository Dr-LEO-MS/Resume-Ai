/**
 * main.js
 * ---------------------------------------------------------------------------
 * Site-wide behaviors shared by every page: dark/light theme toggle (persisted
 * to localStorage), mobile nav open/close, and the score-ring/animation
 * kick-off for elements already in the DOM on load. Page-specific logic lives
 * in builder.js / templates.js (loaded only on those pages).
 * ---------------------------------------------------------------------------
 */

function applySystemTheme(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

(function initTheme() {
  const saved = localStorage.getItem('resumeai:theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (!saved || saved === 'system') {
    applySystemTheme(prefersDark);
  } else {
    document.documentElement.setAttribute('data-theme', saved);
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const current = localStorage.getItem('resumeai:theme');
    if (!current || current === 'system') {
      applySystemTheme(e.matches);
      if (typeof updateThemeButtons === 'function') updateThemeButtons();
    }
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle && !themeToggle.dataset.bound) {
    themeToggle.dataset.bound = 'true';
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('resumeai:theme', next);
      if (typeof updateThemeButtons === 'function') updateThemeButtons();
    });
  }

  initPasswordToggles();
});

/**
 * Site-wide password visibility toggle: every <input type="password"> gets a
 * little eye button that switches it to type="text" and back. Runs
 * automatically on every page — no markup changes needed on individual forms.
 */
function initPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.dataset.toggleWired) return; // avoid double-wiring on re-run
    input.dataset.toggleWired = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'password-field-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'password-toggle-btn';
    btn.setAttribute('aria-label', 'Show password');
    btn.innerHTML = eyeIconSVG(false);
    wrapper.appendChild(btn);

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // prevent losing input focus
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = eyeIconSVG(!showing);
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });
}

function eyeIconSVG(open) {
  return open
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

/**
 * Site-wide confirmation popup modal window matching the current theme.
 * Replaces standard browser confirm() dialogs with a sleek, themed popup.
 *
 * @param {Object|string} options - Configuration object or message string
 * @param {string} [options.title='Confirm Action'] - Header title
 * @param {string} [options.message='Are you sure you want to proceed?'] - Detail message
 * @param {string} [options.confirmText='Delete'] - Confirm button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @param {boolean} [options.danger=true] - Whether this is a destructive/danger action
 * @returns {Promise<boolean>} Resolves to true on confirm, false on cancel/dismiss
 */
window.showConfirmModal = function(options = {}) {
  const opts = typeof options === 'string' ? { message: options } : options;
  const {
    title = 'Confirm',
    message = 'Are you sure want to permanently delete this item?',
    confirmText = (opts.danger === false) ? 'Confirm' : 'Yes, Delete!',
    cancelText = 'Cancel',
    danger = true
  } = opts;

  return new Promise((resolve) => {
    // Remove any stale confirm modals
    document.querySelectorAll('.confirm-modal-backdrop').forEach((el) => el.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'confirm-modal-title');

    const iconSvg = danger
      ? `<svg class="confirm-modal-svg-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="28" stroke="#eb4d3d" stroke-width="3" />
          <path d="M32 18V36" stroke="#eb4d3d" stroke-width="3.5" stroke-linecap="round" />
          <circle cx="32" cy="45" r="2.6" fill="#eb4d3d" />
        </svg>`
      : `<svg class="confirm-modal-svg-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="28" stroke="#2563eb" stroke-width="3" />
          <circle cx="32" cy="21" r="2.6" fill="#2563eb" />
          <path d="M32 28V46" stroke="#2563eb" stroke-width="3.5" stroke-linecap="round" />
        </svg>`;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    backdrop.innerHTML = `
      <div class="confirm-modal-card">
        <div class="confirm-modal-icon-wrap">
          <div class="confirm-modal-icon-circle ${danger ? 'danger' : 'info'}">
            ${iconSvg}
          </div>
        </div>
        <h3 class="confirm-modal-title" id="confirm-modal-title">${escapeHtml(title)}</h3>
        <p class="confirm-modal-message">${escapeHtml(message)}</p>
        <div class="confirm-modal-actions">
          <button type="button" class="confirm-modal-btn confirm-modal-btn-confirm ${danger ? 'danger' : 'primary'}">${escapeHtml(confirmText)}</button>
          <button type="button" class="confirm-modal-btn confirm-modal-btn-cancel ${danger ? 'danger-cancel' : 'default-cancel'}">${escapeHtml(cancelText)}</button>
        </div>
      </div>
    `;

    let isCleanedUp = false;
    function cleanup(result) {
      if (isCleanedUp) return;
      isCleanedUp = true;
      document.removeEventListener('keydown', onKeyDown);
      backdrop.classList.remove('is-visible', 'is-open');
      setTimeout(() => {
        backdrop.remove();
        resolve(result);
      }, 160);
    }

    const cancelBtn = backdrop.querySelector('.confirm-modal-btn-cancel');
    const confirmBtn = backdrop.querySelector('.confirm-modal-btn-confirm');

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(false);
      } else if (e.key === 'Enter') {
        if (document.activeElement === cancelBtn) {
          e.preventDefault();
          cleanup(false);
        } else {
          e.preventDefault();
          cleanup(true);
        }
      }
    }

    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cleanup(false);
      }
    });

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.classList.add('is-visible', 'is-open');
      confirmBtn.focus();
    });
  });
};

/**
 * Site-wide toast notification system.
 * Shows a message in a floating card at the bottom right.
 *
 * @param {string} msg - Message to display
 * @param {string} [type='default'] - 'default' | 'success' | 'error'
 */
window.showToast = function(msg, type = 'default') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast is-visible' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 3200);
};

