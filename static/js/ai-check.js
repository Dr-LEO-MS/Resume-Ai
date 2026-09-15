/**
 * ai-check.js
 * ---------------------------------------------------------------------------
 * Sends the current resume to POST /api/ai/check (see api/routers/ai.py)
 * and renders the result into the AI review panel: an overall score ring
 * plus a list of specific suggestion cards (grammar, clarity, keywords,
 * ATS formatting, quantification).
 *
 * Expected backend response shape:
 * {
 *   "score": 78,                         // 0-100 overall
 *   "subscores": { "ats": 82, "clarity": 74, "keywords": 65, "impact": 80 },
 *   "suggestions": [
 *     {
 *       "id": "exp-0-bullet-1",
 *       "section": "experience",
 *       "type": "weak_verb" | "grammar" | "keyword_gap" | "quantify" | "ats_format",
 *       "severity": "high" | "medium" | "low",
 *       "message": "This bullet opens with a weak verb and has no metric.",
 *       "original": "Responsible for managing a team of developers",
 *       "suggested": "Led a team of 6 developers, shipping 3 releases per quarter"
 *     }
 *   ]
 * }
 * ---------------------------------------------------------------------------
 */

const AICheck = (() => {
  async function run(resume, targetRole, jobDescription) {
    // Auth.apiFetch attaches the signed-in user's token when present, so a
    // logged-in Pro/Teams user gets their unlimited quota instead of being
    // counted against the anonymous daily cap.
    const fetcher = (typeof Auth !== 'undefined' && Auth.apiFetch) ? Auth.apiFetch : fetch;
    const res = await fetcher('/api/ai/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume, target_role: targetRole || null, job_description: jobDescription || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'AI check request failed');
    return data;
  }

  function scoreRingSVG(score) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const offset = c - (score / 100) * c;
    return `
      <div class="score-ring">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle class="track" cx="32" cy="32" r="${r}"></circle>
          <circle class="value" cx="32" cy="32" r="${r}"
            stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
        </svg>
        <div class="score-num">${score}</div>
      </div>`;
  }

  function suggestionCard(s) {
    const sevClass = s.severity === 'high' ? 'severity-high' : s.severity === 'low' ? 'severity-low' : '';
    const diff = s.original
      ? `<div class="diff-before">${s.original}</div><div class="diff-after">${s.suggested || ''}</div>`
      : '';
    return `
      <div class="suggestion-card ${sevClass}" data-suggestion-id="${s.id}">
        <div class="suggestion-type">${(s.type || '').replace(/_/g, ' ')} · ${s.section}</div>
        <p>${s.message}</p>
        ${diff}
        <textarea class="suggestion-edit d-none" rows="3">${s.suggested != null ? s.suggested : (s.original || '')}</textarea>
        <div class="suggestion-actions">
          <button class="btn btn-sm btn-accent accept-suggestion" data-id="${s.id}">Accept</button>
          <button class="btn btn-sm btn-ghost edit-suggestion" data-id="${s.id}">Edit</button>
          <button class="btn btn-sm btn-ghost dismiss-suggestion" data-id="${s.id}">Reject</button>
        </div>
      </div>`;
  }

  const SUBSCORE_LABELS = [
    ['completeness', 'Completeness'],
    ['keyword_match', 'Keyword Match'],
    ['skills_match', 'Skills Match'],
    ['experience_relevance', 'Experience'],
    ['formatting', 'Formatting'],
    ['readability', 'Readability'],
  ];

  function subscoreBar(key, label, value) {
    return `
      <div class="subscore-row">
        <span class="subscore-label">${label}</span>
        <span class="subscore-track"><span class="subscore-fill" style="width:${Math.max(0, Math.min(100, value))}%"></span></span>
        <span class="subscore-value mono">${value}%</span>
      </div>`;
  }

  function renderInto(panelEl, result) {
    const score = result.score || 0;
    const ratingLabel = score >= 80 ? '★ Good' : (score >= 50 ? 'Needs Work' : 'Requires Rewrite');
    const badgeClass = score >= 80 ? 'badge-good' : (score >= 50 ? 'badge-amber' : 'badge-warn');
    
    // Naively extract "strengths" from positive subscores or generate text
    const strengths = [];
    if (result.subscores?.completeness >= 80) strengths.push('You provided a comprehensive background with relevant details.');
    if (result.subscores?.formatting >= 80) strengths.push('Formatting and structure are strong and easily readable.');
    if (result.subscores?.keyword_match >= 75) strengths.push('Your content aligns well with required keywords.');
    if (strengths.length === 0) strengths.push('A solid foundation, but ready for improvement.');

    // Suggestions map to the Make these changes card
    const changesHtml = result.suggestions.map(s => {
       const diffSnippet = s.suggested ? ` <a href="#" class="inline-fix-link" data-id="${s.id}">Apply AI Suggestion: "${s.suggested}"</a>` : '';
       return `<li><strong>${s.section.toUpperCase()}:</strong> ${s.message}${diffSnippet}</li>`;
    }).join('') || '<li class="text-muted">No major changes needed!</li>';

    panelEl.innerHTML = `
      <div class="dashboard-header row justify-between align-center mb-4">
        <h3 class="dashboard-title">AI Review & Analysis</h3>
        <button class="btn btn-ghost btn-sm" id="ai-dashboard-refresh-btn">🔄 Refresh</button>
      </div>

      <!-- Summary Assessment Card -->
      <div class="dashboard-card summary-card mb-4" id="ai-dash-summary-card">
        <div class="card-head row align-center gap-2 mb-2">
          <span class="dash-badge ${badgeClass}" id="ai-dash-score-badge">${ratingLabel} (Score: ${score})</span>
          <h4 class="m-0">Summary</h4>
        </div>
        <p class="dash-text text-sm text-muted" id="ai-dash-summary-text">
          ${score >= 80 ? 'Your resume showcases a solid foundation with relevant skills and experiences.' : 'The resume requires some tweaks for clarity and better organization.'}
        </p>
      </div>

      <!-- Strengths Card -->
      <div class="dashboard-card strengths-card mb-4" id="ai-dash-strengths-card">
        <h4 class="mb-2">Strengths</h4>
        <ul class="dash-list list-good text-sm" id="ai-dash-strengths-list">
          ${strengths.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>

      <!-- Make These Changes Card -->
      <div class="dashboard-card changes-card" id="ai-dash-changes-card">
        <h4 class="mb-2">Make these changes</h4>
        <ul class="dash-list list-changes text-sm" id="ai-dash-changes-list">
          ${changesHtml}
        </ul>
      </div>`;
      
      // Wire inline fix links
      panelEl.querySelectorAll('.inline-fix-link').forEach(link => {
          link.addEventListener('click', (e) => {
              e.preventDefault();
              const s = result.suggestions.find(x => x.id === link.dataset.id);
              if (!s || !s.suggested) return;
              if (s.section === 'summary') {
                 window.ResumeState.update('summary', s.suggested);
              } else if (s.section === 'experience' && s.entryId != null && s.bulletIndex != null) {
                 window.ResumeState.updateBullet(s.entryId, s.bulletIndex, s.suggested);
              }
              link.innerHTML = '✓ Applied';
              link.classList.add('text-muted');
              link.style.pointerEvents = 'none';
          });
      });
      
      const refreshBtn = panelEl.querySelector('#ai-dashboard-refresh-btn');
      if (refreshBtn) {
          refreshBtn.addEventListener('click', () => {
             if (typeof window.runAICheck === 'function') {
                window.runAICheck();
             }
          });
      }
  }

  function renderLoading(panelEl) {
    panelEl.innerHTML = `
      <div class="row gap-2" style="justify-content:center;padding:var(--space-6) 0;color:var(--text-muted)">
        <span class="spinner"></span> Analyzing your resume…
      </div>`;
  }

  function renderError(panelEl, message) {
    panelEl.innerHTML = `<p style="color:var(--warn);font-size:var(--text-sm)">${message}</p>`;
  }

  return { run, renderInto, renderLoading, renderError };
})();
