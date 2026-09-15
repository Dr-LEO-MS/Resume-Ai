/**
 * ai-enhance.js
 * ---------------------------------------------------------------------------
 * Two use cases:
 *   1. Whole-resume enhance ("AI Enhance" button in the top toolbar) — sends
 *      the full resume to POST /api/ai/enhance and gets back a full rewritten
 *      copy the user can preview and accept/reject as a whole.
 *   2. Single-field enhance (the little sparkle icon next to a bullet or the
 *      summary textarea) — sends just that text to POST /api/ai/enhance-text
 *      with a "kind" hint (bullet | summary) for a targeted rewrite.
 * ---------------------------------------------------------------------------
 */

const AIEnhance = (() => {
  function fetcher() {
    return (typeof Auth !== 'undefined' && Auth.apiFetch) ? Auth.apiFetch : fetch;
  }

  async function enhanceResume(resume) {
    const res = await fetcher()('/api/ai/enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'AI enhance request failed');
    return data; // { resume: <full rewritten resume object> }
  }

  async function enhanceText(text, kind, context = {}) {
    const res = await fetcher()('/api/ai/enhance-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, kind, context }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'AI text enhance request failed');
    return data; // { original, suggested }
  }

  /**
   * Small inline UI: turns an icon button into a spinner while the request
   * runs, then replaces the target textarea's value with the suggestion,
   * offering an Undo toast rather than silently overwriting.
   */
  async function enhanceFieldInPlace({ button, textarea, kind, context, onApplied }) {
    const original = textarea.value;
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = '<span class="spinner"></span>';
    try {
      const { suggested } = await enhanceText(original, kind, context);
      textarea.value = suggested;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      onApplied && onApplied(suggested, original);
      showUndoToast(() => {
        textarea.value = original;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        onApplied && onApplied(original, suggested);
      });
    } catch (err) {
      console.error(err);
    } finally {
      button.disabled = false;
      button.innerHTML = originalHTML;
    }
  }

  function showUndoToast(onUndo) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `Enhanced with AI · <button class="btn-ghost" style="text-decoration:underline;padding:0" id="undo-enhance-btn">Undo</button>`;
    toast.classList.add('is-visible');
    toast.querySelector('#undo-enhance-btn').onclick = () => {
      onUndo();
      toast.classList.remove('is-visible');
    };
    setTimeout(() => toast.classList.remove('is-visible'), 6000);
  }

  return { enhanceResume, enhanceText, enhanceFieldInPlace };
})();
