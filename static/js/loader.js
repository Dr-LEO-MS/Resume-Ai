/**
 * loader.js
 * ---------------------------------------------------------------------------
 * Controller for the boot loading screen. The splash markup lives in
 * templates/_loader.html (included as the first element of <body> on every
 * page) and its styles live in static/css/styles.css under "BOOT LOADING
 * SCREEN".
 *
 * Default behaviour: the splash is on screen from the very first paint and
 * dismisses itself once the page has finished loading, after a short minimum
 * display time so it doesn't just flash. Pages with async boot work keep it up
 * until they are actually ready:
 *
 *     ResumeAILoader.hold('dashboard-boot');
 *     ...
 *     ResumeAILoader.release('dashboard-boot');
 *
 * Public API (window.ResumeAILoader):
 *   hold(key)       keep the splash up — idempotent, one flag per key
 *   release(key)    drop that hold; hides once the page is loaded and no other
 *                   key still holds it
 *   hide()          dismiss immediately, ignoring holds and the minimum time
 *   show()          bring it back (e.g. before a heavy client-side transition)
 *   setStatus(text) pin the status line to a fixed message
 *   setMessages([]) replace the rotating status copy for this page
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var MIN_VISIBLE_MS = 700;    // avoids a flash-and-vanish on cache-hot loads
  var MAX_VISIBLE_MS = 15000;  // safety net: a leaked hold must not trap the user
  var ROTATE_MS = 1800;        // status-line cadence
  var FADE_MS = 500;           // keep in sync with the CSS opacity transition

  var STATUS_MESSAGES = [
    'Formatting your experience…',
    'Polishing your summary…',
    'Checking your layout…',
    'Almost ready…'
  ];

  var el = document.getElementById('resumeai-loader');
  var statusEl = document.getElementById('ra-status-text');

  var startedAt = Date.now();
  var holds = {};
  var rotateTimer = null;
  var hideTimer = null;
  var isHidden = false;
  var statusIndex = 0;
  var pageLoaded = document.readyState === 'complete';

  function hasHolds() {
    for (var key in holds) {
      if (Object.prototype.hasOwnProperty.call(holds, key)) return true;
    }
    return false;
  }

  function startRotating() {
    if (rotateTimer !== null || !statusEl || STATUS_MESSAGES.length < 2) return;
    rotateTimer = setInterval(function () {
      statusIndex = (statusIndex + 1) % STATUS_MESSAGES.length;
      statusEl.textContent = STATUS_MESSAGES[statusIndex];
    }, ROTATE_MS);
  }

  function stopRotating() {
    if (rotateTimer !== null) {
      clearInterval(rotateTimer);
      rotateTimer = null;
    }
  }

  function lockScroll(lock) {
    document.documentElement.classList.toggle('ra-is-loading', lock);
  }

  function paintVisible() {
    if (!el) return;
    isHidden = false;
    el.style.display = '';
    el.removeAttribute('aria-hidden');
    void el.offsetWidth; // force a reflow so the fade-in transition runs
    el.classList.remove('is-hidden');
    lockScroll(true);
    startRotating();
  }

  function paintHidden() {
    if (!el) return;
    isHidden = true;
    stopRotating();
    lockScroll(false);
    el.classList.add('is-hidden');
    el.setAttribute('aria-hidden', 'true');
    hideTimer = setTimeout(function () {
      if (isHidden) el.style.display = 'none';
    }, FADE_MS);
  }

  function maybeHide() {
    if (!el || isHidden) return;
    if (!pageLoaded || hasHolds()) return;
    var remaining = MIN_VISIBLE_MS - (Date.now() - startedAt);
    if (remaining > 0) {
      setTimeout(maybeHide, remaining + 20);
      return;
    }
    paintHidden();
  }

  function hideNow() {
    if (!el || isHidden) return;
    paintHidden();
  }

  function show() {
    if (!el) return;
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    startedAt = Date.now();
    paintVisible();
  }

  function hold(key) {
    holds[key || 'default'] = true;
  }

  function release(key) {
    delete holds[key || 'default'];
    maybeHide();
  }

  function setStatus(text) {
    if (!statusEl) return;
    stopRotating();
    statusEl.textContent = text;
  }

  function setMessages(messages) {
    if (Object.prototype.toString.call(messages) !== '[object Array]' || !messages.length) return;
    STATUS_MESSAGES = messages;
    statusIndex = 0;
    if (statusEl) statusEl.textContent = STATUS_MESSAGES[0];
    stopRotating();
    startRotating();
  }

  window.ResumeAILoader = {
    hold: hold,
    release: release,
    show: show,
    hide: hideNow,
    setStatus: setStatus,
    setMessages: setMessages,
    isVisible: function () { return !isHidden; }
  };

  // Pages that opt out of the splash (no markup) still get a harmless no-op API.
  if (!el) return;

  // The markup ships visible, so the script applies what paintVisible() would
  // have done on a later show(): lock scrolling behind the splash and make sure
  // the status line has copy even if the template's text was swapped out.
  if (!isHidden) {
    if (statusEl && !statusEl.textContent) statusEl.textContent = STATUS_MESSAGES[0];
    lockScroll(true);
  }

  if (pageLoaded) {
    maybeHide();
  } else {
    window.addEventListener('load', function () {
      pageLoaded = true;
      maybeHide();
    });
    // Back/forward-cache restores never re-fire "load"; if the page comes back
    // already rendered, don't cover it.
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        pageLoaded = true;
        hideNow();
      }
    });
  }

  startRotating();

  setTimeout(function () {
    if (isHidden) return;
    if (hasHolds()) {
      console.warn('[loader] force-hiding boot splash after ' + MAX_VISIBLE_MS + 'ms — a hold() was never released');
    }
    hideNow();
  }, MAX_VISIBLE_MS);
})();
