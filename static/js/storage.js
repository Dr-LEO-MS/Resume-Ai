/**
 * storage.js
 * ---------------------------------------------------------------------------
 * Handles persistence of resume data.
 *   - While signed out / offline: falls back to localStorage so nothing
 *     is lost.
 *   - When signed in: syncs to the backend via /api/resumes (see
 *     api/routers/resumes_router.py).
 *   - Encrypted Token Isolation: supports direct retrieval and updates
 *     via encrypted token endpoints (/api/resumes/secure/{token}).
 * ---------------------------------------------------------------------------
 */

const ResumeStorage = (() => {
  const LOCAL_KEY = 'resumeai:current';
  const LOCAL_LIST_KEY = 'resumeai:saved';
  let SYNC_MODE = 'local'; // 'local' | 'server' | 'token'
  let ACTIVE_SECURE_TOKEN = null;

  function setSyncMode(mode) {
    SYNC_MODE = mode;
  }

  function setSecureToken(token) {
    ACTIVE_SECURE_TOKEN = token;
    if (token) SYNC_MODE = 'token';
  }

  function getSecureToken() {
    return ACTIVE_SECURE_TOKEN;
  }

  // ---- Local (offline) persistence ---------------------------------------
  function saveLocal(resume) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(resume));
  }

  function loadLocal() {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function saveToList(resume, meta = {}) {
    const list = getList();
    const id = meta.id || resume.id || ResumeState.uid();
    const entry = {
      id,
      name: meta.name || resume.personal?.fullName || 'Untitled resume',
      template: resume.template,
      updatedAt: new Date().toISOString(),
      data: resume,
    };
    const idx = list.findIndex((r) => r.id === id);
    if (idx > -1) list[idx] = entry;
    else list.push(entry);
    localStorage.setItem(LOCAL_LIST_KEY, JSON.stringify(list));
    return entry;
  }

  function getList() {
    const raw = localStorage.getItem(LOCAL_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  function deleteFromList(id) {
    const list = getList().filter((r) => r.id !== id);
    localStorage.setItem(LOCAL_LIST_KEY, JSON.stringify(list));
  }

  // ---- Server persistence (authenticated session) -------------------------
  async function saveServer(resume, token) {
    const url = resume.id ? `/api/resumes/${resume.id}` : '/api/resumes';
    const payload = {
      id: resume.id || null,
      name: resume.personal?.fullName || 'Untitled resume',
      template: resume.template,
      doc_type: resume.docType || 'resume',
      content: resume,
    };
    const res = await fetch(url, {
      method: resume.id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save resume to server');
    return res.json();
  }

  async function loadOneFromServer(id, token) {
    const res = await fetch(`/api/resumes/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      return res.json();
    }
    // Fallback search in user's resumes
    const listRes = await fetch('/api/resumes', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) throw new Error('Failed to load resumes');
    const list = await listRes.json();
    return list.find((r) => r.id === id) || null;
  }

  async function loadServerList(token) {
    const res = await fetch('/api/resumes', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to load resumes');
    return res.json();
  }

  // ---- Encrypted Token Isolated Persistence -------------------------------
  async function loadBySecureToken(token) {
    const res = await fetch(`/api/resumes/secure/${encodeURIComponent(token)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Failed to load resume with secure token');
    }
    const data = await res.json();
    setSecureToken(token);
    return data.resume;
  }

  async function saveBySecureToken(token, resume) {
    const payload = {
      name: resume.personal?.fullName || 'Untitled resume',
      template: resume.template,
      doc_type: resume.docType || 'resume',
      content: resume,
    };
    const res = await fetch(`/api/resumes/secure/${encodeURIComponent(token)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Failed to update resume via secure token');
    }
    return res.json();
  }

  async function generateResumeToken(resumeId, token, permissions = 'read,write,export', days = 30) {
    const res = await fetch(`/api/resumes/${resumeId}/token?permissions=${encodeURIComponent(permissions)}&expires_in_days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to generate resume access token');
    return res.json();
  }

  // ---- Unified autosave with debounce -------------------------------------
  let debounceTimer = null;
  function autosave(resume, { token = null, secureToken = null, delay = 800, onSaved = () => {}, onError = () => {} } = {}) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      saveLocal(resume);
      let success = true;
      const activeToken = secureToken || ACTIVE_SECURE_TOKEN;

      if (activeToken) {
        try {
          await saveBySecureToken(activeToken, resume);
        } catch (err) {
          console.warn('Secure token autosave failed, kept local copy:', err);
          success = false;
          onError(err);
        }
      } else if (SYNC_MODE === 'server' && token) {
        try {
          const saved = await saveServer(resume, token);
          if (!resume.id && saved?.id) resume.id = saved.id;
        } catch (err) {
          console.error('Server autosave failed, kept local copy:', err);
          success = false;
          onError(err);
        }
      }

      if (success) onSaved();
    }, delay);
  }

  return {
    setSyncMode,
    setSecureToken,
    getSecureToken,
    saveLocal,
    loadLocal,
    saveToList,
    getList,
    deleteFromList,
    saveServer,
    loadServerList,
    loadOneFromServer,
    loadBySecureToken,
    saveBySecureToken,
    generateResumeToken,
    autosave,
  };
})();
