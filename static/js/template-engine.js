/**
 * template-engine.js
 * ---------------------------------------------------------------------------
 * Pure function(s) that turn ResumeState data into the HTML markup used both
 * for the live preview panel (builder.html) and for PDF export (pdf-export.js).
 * Implements strict A4 physical dimensions (210mm × 297mm) and dynamic multi-page
 * pagination across standard DPI resolutions.
 * ---------------------------------------------------------------------------
 */

const TemplateEngine = (() => {
  let _templateListCache = null;
  let _templateListFetchedAt = 0;
  // Discovery TTL: re-queries /api/templates this often so a template that's
  // dropped into /resume_templates (or removed) shows up on next load without
  // a server restart. The backend lazily re-scans its folder, and this short
  // TTL makes the browser pick the change up automatically.
  const TEMPLATE_LIST_TTL_MS = 5000;
  // Client-side raw-HTML fetch cache: one request per template id.
  const _rawTemplateCache = new Map();

  /** Fetches [{id, name, tags, desc, style}, ...] from GET /api/templates */
  async function fetchTemplateList(force = false) {
    const now = Date.now();
    if (!force && _templateListCache && (now - _templateListFetchedAt) < TEMPLATE_LIST_TTL_MS) {
      return _templateListCache;
    }
    try {
      const res = await fetch('/api/templates');
      _templateListCache = res.ok ? await res.json() : [];
    } catch {
      _templateListCache = [];
    }
    _templateListFetchedAt = Date.now();
    return _templateListCache;
  }

  /** Clears the in-memory template list cache (forces a fresh discovery). */
  function clearTemplateListCache() {
    _templateListCache = null;
    _templateListFetchedAt = 0;
  }

  /** Clears the raw-HTML fetch cache for a template (or all). */
  function clearRawTemplateCache(templateId = null) {
    if (templateId) _rawTemplateCache.delete(templateId);
    else _rawTemplateCache.clear();
  }

  /** Fetches the raw modular HTML "disk" for a template (cached by id). */
  async function fetchRawTemplate(templateId) {
    if (_rawTemplateCache.has(templateId)) return _rawTemplateCache.get(templateId);
    let html = '';
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(templateId)}/raw`);
      html = res.ok ? await res.text() : '';
    } catch {
      html = '';
    }
    _rawTemplateCache.set(templateId, html);
    return html;
  }

  // Standard A4 Specifications across DPI resolutions
  const A4_DIMENSIONS = {
    300: { dpi: 300, width: 2480, height: 3508, scale: 3.1234257, label: '300 DPI (High-Quality Print)' },
    150: { dpi: 150, width: 1240, height: 1754, scale: 1.5617128, label: '150 DPI (Draft Print / Flyers)' },
    96:  { dpi: 96,  width: 794,  height: 1123, scale: 1.0,       label: '96 DPI (Standard CSS Screen)' },
    72:  { dpi: 72,  width: 595,  height: 842,  scale: 0.7493703, label: '72 DPI (Web / Standard Screen)' }
  };

  function esc(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatMarkdownLite(raw = '') {
    const lines = String(raw).split('\n');
    let html = '';
    let inList = false;
    for (const line of lines) {
      const isBullet = /^\s*-\s+/.test(line);
      if (isBullet && !inList) { html += '<ul class="doc-formatted-list">'; inList = true; }
      if (!isBullet && inList) { html += '</ul>'; inList = false; }

      let content = esc(isBullet ? line.replace(/^\s*-\s+/, '') : line);
      content = content
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<u>$1</u>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" title="$1">$1</a>');

      html += isBullet ? `<li>${content}</li>` : (content ? `<p>${content}</p>` : '');
    }
    if (inList) html += '</ul>';
    return html;
  }

  function normalizeUrl(url) {
    const u = (url || '').trim();
    if (!u) return '';
    return /^https?:\/\//i.test(u) ? u : 'https://' + u;
  }

  function shortLinkLabel(url, maxLen = 40) {
    let u = (url || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
    if (u.length > maxLen) {
      const parts = u.split('/');
      u = parts.slice(0, 2).join('/') + '/…';
    }
    return u;
  }

  function profileHandle(url) {
    let u = String(url || '').trim()
      .replace(/^[a-z][a-z0-9+.\-]*:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/[?#].*$/, '')
      .replace(/\/+$/, '');
    if (!u) return '@';
    const segs = u.split('/').filter(Boolean);
    if (segs.length > 1) return '@' + segs[segs.length - 1];
    const hostParts = segs[0].split('.');
    return hostParts.length >= 2 ? '@' + hostParts[hostParts.length - 2] : '@' + hostParts[0];
  }

  function telHref(phone) {
    const s = String(phone || '').trim();
    if (!s) return '';
    return (s.startsWith('+') ? '+' : '') + s.replace(/\D/g, '');
  }

  const ICON_EMAIL_SVG = `<svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>`;
  const ICON_PHONE_SVG = `<svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
  const ICON_LOCATION_SVG = `<svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
  const ICON_LINKEDIN_SVG = `<svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>`;
  const ICON_GITHUB_SVG = `<svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>`;
  const ICON_WEBSITE_SVG = `<svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;

  const InlineHelpers = {
    handle: (u) => profileHandle(u),
    url: (u) => normalizeUrl(u),
    phone: (p) => telHref(p),
  };

  function renderContact(p) {
    const items = [];
    if (p.email) items.push(`<a href="mailto:${esc(p.email)}" title="Send an email to ${esc(p.email)}" aria-label="Email ${esc(p.email)}">${ICON_EMAIL_SVG}${esc(p.email)}</a>`);
    const phone = (p.phone || '').trim();
    if (phone) {
      const tel = telHref(phone);
      if (tel) items.push(`<a href="tel:${esc(tel)}" title="Call ${esc(phone)}" aria-label="Call phone number ${esc(phone)}">${ICON_PHONE_SVG}${esc(phone)}</a>`);
    }

    const locParts = [];
    if (p.city && p.city.trim()) locParts.push(p.city.trim());
    if (p.postalCode && p.postalCode.trim()) locParts.push(p.postalCode.trim());
    if (p.country && p.country.trim()) locParts.push(p.country.trim());
    const formattedLoc = locParts.length ? locParts.join(', ') : (p.location || '');
    if (formattedLoc) items.push(`<span>${ICON_LOCATION_SVG}${esc(formattedLoc)}</span>`);

    [
      ['linkedin', 'View LinkedIn profile', ICON_LINKEDIN_SVG],
      ['github', 'View GitHub profile', ICON_GITHUB_SVG],
      ['website', 'Visit portfolio website', ICON_WEBSITE_SVG],
    ].forEach(([key, aria, iconSvg]) => {
      const url = (p[key] || '').trim();
      if (url) items.push(`<a href="${esc(normalizeUrl(url))}" target="_blank" rel="noopener noreferrer" title="${aria}" aria-label="${aria}">${iconSvg}${esc(profileHandle(url))}</a>`);
    });
    return items.join('');
  }

  function renderPhoto(customization) {
    const photo = customization && customization.photo;
    if (!photo || !photo.visible || !photo.url) return '';
    const shapeClass = photo.shape === 'square' ? 'doc-photo-square' : 'doc-photo-circle';
    return `<img class="doc-photo ${shapeClass}" src="${esc(photo.url)}" alt="Profile photo">`;
  }

  function renderPageNumber(customization, pageNum = 1, totalPages = 1) {
    const pn = customization && customization.pageNumbers;
    if (!pn || !pn.enabled) return '';
    const label = (pn.format || 'Page {n} of {total}')
      .replace('{n}', String(pageNum))
      .replace('{total}', String(totalPages));
    return `<div class="doc-page-number doc-page-number-${pn.position || 'bottom-center'}">${esc(label)}</div>`;
  }

  function customizationStyleVars(customization) {
    if (!customization) return '';
    const f = customization.fontSizes || {};
    const c = customization.colors || {};
    const fam = customization.fonts || {};
    const s = customization.spacing || {};
    const vars = {
      '--doc-name-size': f.name ? f.name + 'px' : null,
      '--doc-h2-size': f.h2 ? f.h2 + 'px' : null,
      '--doc-body-size': f.body ? f.body + 'px' : null,
      '--doc-contact-size': f.contact ? f.contact + 'px' : null,
      '--doc-heading-color': c.heading || null,
      '--doc-body-color': c.body || null,
      '--doc-link-color': c.link || null,
      '--doc-accent-color': c.accent || null,
      '--doc-heading-font': fam.heading || null,
      '--doc-body-font': fam.body || null,
      '--doc-line-height': s.lineHeight || null,
      '--doc-section-spacing': s.sectionSpacing != null ? s.sectionSpacing + 'px' : null,
      '--doc-page-margin': s.pageMargin != null ? s.pageMargin + 'px' : null,
    };
    return Object.entries(vars)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  }

  function getSecTitle(id, defaultTitle, resume) {
    if (resume && resume.sectionTitles && resume.sectionTitles[id]) {
      return resume.sectionTitles[id];
    }
    if (resume && resume[id] && typeof resume[id] === 'object' && !Array.isArray(resume[id]) && resume[id].title) {
      return resume[id].title;
    }
    return defaultTitle;
  }

  function renderSkillsSection(skills, resume) {
    if (!skills) return '';
    const title = getSecTitle('skills', 'Skills', resume);

    if (Array.isArray(skills)) {
      if (!skills.length) return '';
      return `<section class="doc-section" data-section-id="skills"><div class="doc-section-title">${esc(title)}</div><div class="skills-wrapper">${skills
        .map((s) => `<span class="skill-pill">${esc(s)}</span>`)
        .join('')}</div></section>`;
    }

    const categories = [
      { key: 'technical', label: 'Technical Skills' },
      { key: 'tools', label: 'Tools & Technologies' },
      { key: 'soft', label: 'Soft Skills & Leadership' },
    ];

    const hasAnySkills = categories.some((c) => skills[c.key] && skills[c.key].length > 0);
    if (!hasAnySkills) return '';

    const catHtml = categories
      .filter((c) => skills[c.key] && skills[c.key].length > 0)
      .map(
        (c) => `
        <div class="skills-category-block" style="margin-bottom: 6px;">
          <strong style="font-size: var(--text-xs); color: var(--text-muted); display: block; margin-bottom: 3px;">${c.label}</strong>
          <div class="skills-wrapper">${skills[c.key].map((s) => `<span class="skill-pill">${esc(s)}</span>`).join('')}</div>
        </div>`
      )
      .join('');

    return `<section class="doc-section" data-section-id="skills"><div class="doc-section-title">${esc(title)}</div>${catHtml}</section>`;
  }

  function renderSection(id, resume) {
    if (resume.hiddenSections && resume.hiddenSections.includes(id)) return '';
    switch (id) {
      case 'summary':
        return resume.summary
          ? `<section class="doc-section" data-section-id="summary"><div class="doc-section-title">${esc(getSecTitle('summary', 'Profile Summary', resume))}</div>${formatMarkdownLite(resume.summary)}</section>`
          : '';
      case 'experience':
        if (!resume.experience || !resume.experience.length) return '';
        const bulletClass = 'bullets-' + ((resume.customization && resume.customization.spacing && resume.customization.spacing.bulletStyle) || 'disc');
        return `<section class="doc-section" data-section-id="experience"><div class="doc-section-title">${esc(getSecTitle('experience', 'Experience', resume))}</div>${resume.experience
          .map(
            (e) => `
          <div class="doc-entry">
            <div class="doc-entry-head"><span>${esc(e.role)}${e.company ? ' — ' + esc(e.company) : ''}</span><span>${esc(e.start)}${e.start || e.end ? ' – ' : ''}${e.current ? 'Present' : esc(e.end)}</span></div>
            ${e.location ? `<div class="doc-entry-sub">${esc(e.location)}</div>` : ''}
            <ul class="doc-bullets ${bulletClass}">${(e.bullets || []).filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
          </div>`
          )
          .join('')}</section>`;
      case 'education':
        if (!resume.education || !resume.education.length) return '';
        return `<section class="doc-section" data-section-id="education"><div class="doc-section-title">${esc(getSecTitle('education', 'Education', resume))}</div>${resume.education
          .map(
            (e) => `
          <div class="doc-entry">
            <div class="doc-entry-head"><span>${esc(e.degree)}${e.field ? ', ' + esc(e.field) : ''}</span><span>${esc(e.start)}${e.start || e.end ? ' – ' : ''}${esc(e.end)}</span></div>
            <div class="doc-entry-sub">${esc(e.school)}${e.gpa ? ' · GPA ' + esc(e.gpa) : ''}</div>
            ${e.honors ? `<div class="doc-entry-details"><strong>Honors:</strong> ${esc(e.honors)}</div>` : ''}
            ${e.coursework ? `<div class="doc-entry-details"><strong>Coursework:</strong> ${esc(e.coursework)}</div>` : ''}
          </div>`
          )
          .join('')}</section>`;
      case 'skills':
        return renderSkillsSection(resume.skills, resume);
      case 'projects':
        if (!resume.projects || !resume.projects.length) return '';
        return `<section class="doc-section" data-section-id="projects"><div class="doc-section-title">${esc(getSecTitle('projects', 'Projects', resume))}</div>${resume.projects
          .map(
            (p) => `
          <div class="doc-entry">
            <div class="doc-entry-head"><span>${p.link ? `<a class="project-title-link" href="${esc(normalizeUrl(p.link))}" target="_blank" rel="noopener noreferrer" title="View project: ${esc(p.name)}" aria-label="View project ${esc(p.name)}">${esc(p.name)}</a>` : esc(p.name)}${p.role ? ' (' + esc(p.role) + ')' : ''}</span>${p.link ? `<span><a class="project-link" href="${esc(normalizeUrl(p.link))}" target="_blank" rel="noopener noreferrer" title="Open project: ${esc(p.name)}" aria-label="Open project ${esc(p.name)}">View ↗</a></span>` : ''}</div>
            ${p.description ? `<div class="doc-entry-sub">${esc(p.description)}</div>` : ''}
          </div>`
          )
          .join('')}</section>`;
      case 'certifications':
        if (!resume.certifications || !resume.certifications.length) return '';
        return `<section class="doc-section" data-section-id="certifications"><div class="doc-section-title">${esc(getSecTitle('certifications', 'Certifications', resume))}</div>${resume.certifications
          .map((c) => `<div class="doc-entry-sub"><strong>${esc(c.name)}</strong>${c.issuer ? ' — ' + esc(c.issuer) : ''}${c.date ? ' (' + esc(c.date) + ')' : ''}</div>`)
          .join('')}</section>`;
      case 'languages':
        if (!resume.languages || !resume.languages.length) return '';
        return `<section class="doc-section" data-section-id="languages"><div class="doc-section-title">${esc(getSecTitle('languages', 'Languages', resume))}</div><div class="skills-wrapper">${resume.languages
          .map((l) => `<span class="skill-pill">${esc(l.name)} · ${esc(l.level)}</span>`)
          .join('')}</div></section>`;
      case 'links':
        if (!resume.links || !resume.links.length) return '';
        return `<section class="doc-section" data-section-id="links"><div class="doc-section-title">${esc(getSecTitle('links', 'Links', resume))}</div><div class="skills-wrapper">${resume.links
          .map((l) => {
            const label = l.label || l.name || shortLinkLabel(l.link || l.url || '');
            const url = l.link || l.url || '';
            return url
              ? `<a class="skill-pill" href="${esc(normalizeUrl(url))}" target="_blank" rel="noopener noreferrer" title="${esc(label)}">${esc(label)}</a>`
              : `<span class="skill-pill">${esc(label)}</span>`;
          })
          .join('')}</div></section>`;
      case 'power_statement':
        if (!resume.power_statement) return '';
        return `<section class="doc-section" data-section-id="power_statement"><div class="doc-section-title">${esc(getSecTitle('power_statement', 'Power Statement', resume))}</div><div class="doc-entry-sub" style="font-weight:500; font-size:1.05em;">${formatMarkdownLite(resume.power_statement)}</div></section>`;
      case 'hobbies':
        if (!resume.hobbies || !resume.hobbies.length) return '';
        const hobbiesList = Array.isArray(resume.hobbies) ? resume.hobbies : [resume.hobbies];
        return `<section class="doc-section" data-section-id="hobbies"><div class="doc-section-title">${esc(getSecTitle('hobbies', 'Hobbies & Interests', resume))}</div><div class="skills-wrapper">${hobbiesList
          .map((h) => `<span class="skill-pill">${esc(typeof h === 'object' ? h.name || '' : h)}</span>`)
          .join('')}</div></section>`;
      case 'references':
        if (!resume.references || !resume.references.length) return '';
        return `<section class="doc-section" data-section-id="references"><div class="doc-section-title">${esc(getSecTitle('references', 'References', resume))}</div>${resume.references
          .map((r) => `
            <div class="doc-entry">
              <div class="doc-entry-head"><span>${esc(r.name || '')}${r.title ? ' — ' + esc(r.title) : ''}</span>${r.company ? `<span>${esc(r.company)}</span>` : ''}</div>
              ${r.contact ? `<div class="doc-entry-sub">${esc(r.contact)}</div>` : ''}
            </div>`)
          .join('')}</section>`;
      default: {
        const secData = resume[id];
        if (!secData) return '';
        let defaultLabel = (window.SECTION_LABELS && window.SECTION_LABELS[id]) || id.replace(/^custom_section_?/, 'Custom Section ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        let secLabel = getSecTitle(id, defaultLabel, resume);

        if (typeof secData === 'string') {
          return `<section class="doc-section" data-section-id="${id}"><div class="doc-section-title">${esc(secLabel)}</div>${formatMarkdownLite(secData)}</section>`;
        }
        const items = Array.isArray(secData) ? secData : (Array.isArray(secData.items) ? secData.items : []);
        if (items.length) {
          return `<section class="doc-section" data-section-id="${id}"><div class="doc-section-title">${esc(secLabel)}</div>${items
            .map((item) => {
              const mainTitle = item.title || item.name || item.role || item.activity || '';
              const subTitle = item.city || item.location || item.subtitle || item.organization || item.issuer || item.company || '';
              const dateStr = (item.start || item.date) ? `${item.start || item.date}${item.end ? ' – ' + item.end : ''}` : '';
              return `
              <div class="doc-entry">
                <div class="doc-entry-head">
                  <span><strong>${esc(mainTitle)}</strong>${subTitle ? ' — ' + esc(subTitle) : ''}</span>
                  ${dateStr ? `<span>${esc(dateStr)}</span>` : ''}
                </div>
                ${item.description ? `<div class="doc-entry-sub">${formatMarkdownLite(item.description)}</div>` : ''}
              </div>`;
            })
            .join('')}</section>`;
        }
        return '';
      }
    }
  }

  function renderHeaderHtml(resume) {
    const p = resume.personal || {};
    const displayName = p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Your Name';
    const displayTitle = p.title || p.jobTarget || 'Your professional title';
    const photoPosition = resume.customization?.photo?.position || 'left';
    const photoHtml = renderPhoto(resume.customization);

    return `
      <div class="doc-header doc-header-photo-${photoHtml ? photoPosition : 'none'}">
        ${photoHtml}
        <div class="doc-header-text">
          <h1>${esc(displayName)}</h1>
          <div class="doc-title">${esc(displayTitle)}</div>
          <div class="doc-contact">${renderContact(p)}</div>
        </div>
      </div>`;
  }

  /**
   * Dedicated Cover Letter Rendering Engine with 4 distinct layout styles:
   * 1. Modern Minimal (cl-modern)
   * 2. Traditional Formal (cl-classic)
   * 3. Creative Professional (cl-creative)
   * 4. Executive Classic (cl-executive)
   */
  function renderCoverLetter(resume) {
    const p = resume.personal || {};
    const cl = resume.coverLetter || resume.cover_letter || {};
    const displayName = p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Your Name';
    const displayTitle = p.title || p.jobTarget || 'Applicant';
    const styleAttr = customizationStyleVars(resume.customization);
    const pageMargin = resume.customization?.spacing?.pageMargin != null ? resume.customization.spacing.pageMargin : 36;

    let templateId = resume.template || 'cl-modern';
    if (templateId === 'classic') templateId = 'cl-classic';
    else if (templateId === 'creative') templateId = 'cl-creative';
    else if (templateId === 'executive') templateId = 'cl-executive';
    else if (templateId === 'modern' || !templateId.startsWith('cl-')) templateId = 'cl-modern';

    const contactItems = [];
    if (p.email) contactItems.push(`<a href="mailto:${esc(p.email)}" title="Send an email to ${esc(p.email)}" aria-label="Email ${esc(p.email)}">${ICON_EMAIL_SVG}${esc(p.email)}</a>`);
    if (p.phone) contactItems.push(`<a href="tel:${esc(telHref(p.phone))}" title="Call ${esc(p.phone)}" aria-label="Call phone number ${esc(p.phone)}">${ICON_PHONE_SVG}${esc(p.phone)}</a>`);

    const locParts = [p.address, p.city, p.postalCode, p.country].filter(Boolean);
    const loc = locParts.length ? locParts.join(', ') : (p.location || '');
    if (loc) contactItems.push(`<span>${ICON_LOCATION_SVG}${esc(loc)}</span>`);
    if (p.linkedin) contactItems.push(`<a href="${esc(normalizeUrl(p.linkedin))}" target="_blank" rel="noopener noreferrer" title="View LinkedIn profile" aria-label="View LinkedIn profile">${ICON_LINKEDIN_SVG}${esc(profileHandle(p.linkedin))}</a>`);
    if (p.github) contactItems.push(`<a href="${esc(normalizeUrl(p.github))}" target="_blank" rel="noopener noreferrer" title="View GitHub profile" aria-label="View GitHub profile">${ICON_GITHUB_SVG}${esc(profileHandle(p.github))}</a>`);
    if (p.website) contactItems.push(`<a href="${esc(normalizeUrl(p.website))}" target="_blank" rel="noopener noreferrer" title="Visit portfolio website" aria-label="Visit portfolio website">${ICON_WEBSITE_SVG}${esc(shortLinkLabel(p.website))}</a>`);

    const contactBarHtml = contactItems.join(' &nbsp;·&nbsp; ');
    const contactBarStackedHtml = contactItems.map(item => `<div>${item}</div>`).join('');

    const dateStr = cl.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const salutation = cl.salutation || (cl.hiringManager ? `Dear ${cl.hiringManager},` : 'Dear Hiring Team,');
    const signOff = cl.signOff || 'Sincerely,';
    const signature = cl.signature || displayName;

    const rawBody = cl.body || '';
    const bodyHtml = rawBody ? formatMarkdownLite(rawBody) : '<p style="color:var(--text-muted);font-style:italic;">3–4 paragraphs explaining why you\'re the perfect candidate for a specific job...</p>';

    const qualsHtml = (cl.keyQualifications && cl.keyQualifications.length) ? `
      <div class="cl-doc-qualifications" style="margin: 16px 0;">
        <strong style="display:block; margin-bottom: 8px;">Key Qualifications:</strong>
        <ul class="doc-formatted-list">
          ${cl.keyQualifications.map(q => `<li>${esc(q)}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    let templateInnerHtml = '';

    if (templateId === 'cl-classic') {
      templateInnerHtml = `
        <div class="cl-doc-header">
          <h1 class="cl-doc-name">${esc(displayName)}</h1>
          ${displayTitle ? `<div class="cl-doc-title">${esc(displayTitle)}</div>` : ''}
          <div class="cl-doc-contact-bar">${contactBarHtml}</div>
        </div>
        <div class="cl-doc-recipient-box">
          <div class="cl-doc-date">${esc(dateStr)}</div>
          <div class="cl-doc-recipient">
            ${cl.hiringManager ? `<strong>${esc(cl.hiringManager)}</strong>` : ''}
            ${cl.companyName ? `<div>${esc(cl.companyName)}</div>` : ''}
            ${cl.companyAddress ? `<div>${esc(cl.companyAddress)}</div>` : ''}
          </div>
        </div>
        <div class="cl-doc-salutation">${esc(salutation)}</div>
        <div class="cl-doc-body">
          ${bodyHtml}
          ${qualsHtml}
        </div>
        <div class="cl-doc-signoff">
          <div>${esc(signOff)}</div>
          <div class="cl-doc-signature-name">${esc(signature)}</div>
        </div>
      `;
    } else if (templateId === 'cl-creative') {
      templateInnerHtml = `
        <div class="cl-doc-header">
          <div>
            <h1 class="cl-doc-name">${esc(displayName)}</h1>
            <div class="cl-doc-title">${esc(displayTitle)}</div>
          </div>
          <div class="cl-doc-contact-bar">
            ${contactBarStackedHtml}
          </div>
        </div>
        <div class="cl-doc-recipient-box">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">
            <div class="cl-doc-recipient">
              ${cl.hiringManager ? `<strong>${esc(cl.hiringManager)}</strong>` : ''}
              ${cl.companyName ? `<div>${esc(cl.companyName)}</div>` : ''}
              ${cl.companyAddress ? `<div>${esc(cl.companyAddress)}</div>` : ''}
            </div>
            <div class="cl-doc-date">${esc(dateStr)}</div>
          </div>
        </div>
        <div class="cl-doc-salutation">${esc(salutation)}</div>
        <div class="cl-doc-body">
          ${bodyHtml}
          ${qualsHtml}
        </div>
        <div class="cl-doc-signoff">
          <div>${esc(signOff)}</div>
          <div class="cl-doc-signature-name">${esc(signature)}</div>
        </div>
      `;
    } else if (templateId === 'cl-executive') {
      templateInnerHtml = `
        <div class="cl-doc-header">
          <div>
            <h1 class="cl-doc-name">${esc(displayName)}</h1>
            <div class="cl-doc-title">${esc(displayTitle)}</div>
          </div>
          <div class="cl-doc-contact-bar">
            ${contactBarStackedHtml}
          </div>
        </div>
        <div class="cl-doc-recipient-box">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">
            <div class="cl-doc-recipient">
              ${cl.hiringManager ? `<strong>${esc(cl.hiringManager)}</strong>` : ''}
              ${cl.companyName ? `<div>${esc(cl.companyName)}</div>` : ''}
              ${cl.companyAddress ? `<div>${esc(cl.companyAddress)}</div>` : ''}
            </div>
            <div class="cl-doc-date">${esc(dateStr)}</div>
          </div>
        </div>
        <div class="cl-doc-salutation">${esc(salutation)}</div>
        <div class="cl-doc-body">
          ${bodyHtml}
          ${qualsHtml}
        </div>
        <div class="cl-doc-signoff">
          <div>${esc(signOff)}</div>
          <div class="cl-doc-signature-name">${esc(signature)}</div>
        </div>
      `;
    } else {
      // Default: cl-modern (Modern Minimal)
      templateInnerHtml = `
        <div class="cl-doc-header">
          <div>
            <h1 class="cl-doc-name">${esc(displayName)}</h1>
            <div class="cl-doc-title">${esc(displayTitle)}</div>
            <div class="cl-doc-contact-bar">${contactBarHtml}</div>
          </div>
        </div>
        <div class="cl-doc-recipient-box">
          <div class="cl-doc-recipient">
            ${cl.hiringManager ? `<strong>${esc(cl.hiringManager)}</strong>` : ''}
            ${cl.companyName ? `<div>${esc(cl.companyName)}</div>` : ''}
            ${cl.companyAddress ? `<div>${esc(cl.companyAddress)}</div>` : ''}
          </div>
          <div class="cl-doc-date">${esc(dateStr)}</div>
        </div>
        <div class="cl-doc-salutation">${esc(salutation)}</div>
        <div class="cl-doc-body">
          ${bodyHtml}
          ${qualsHtml}
        </div>
        <div class="cl-doc-signoff">
          <div>${esc(signOff)}</div>
          <div class="cl-doc-signature-name">${esc(signature)}</div>
        </div>
      `;
    }

    return `
      <div class="resume-pages-container" data-total-pages="1">
        <div class="resume-page theme-${templateId} cl-preview-document" data-page="1" style="${styleAttr}; padding:${pageMargin}px;">
          <div class="resume-page-content doc-main-wrapper">
            ${templateInnerHtml}
          </div>
        </div>
      </div>`;
  }

  /**
   * Dynamic DOM-based A4 Multi-Page Pagination Engine.
   * Measures rendered content against physical A4 dimensions (794px × 1123px at 96 DPI)
   * and splits into discrete .resume-page containers with < i / N > pagination badges.
   */
  function paginate(resume, targetEl = null) {
    if (resume && resume.docType === 'cover_letter') {
      const clHtml = renderCoverLetter(resume);
      if (targetEl) {
        targetEl.innerHTML = clHtml;
        window.dispatchEvent(new CustomEvent('resume:paginated', {
          detail: { totalPages: 1, currentPage: 1 }
        }));
      }
      return clHtml;
    }

    const p = resume.personal || {};
    const styleAttr = customizationStyleVars(resume.customization);
    const templateClass = `theme-${resume.template || 'classic'}`;
    const pageMargin = resume.customization?.spacing?.pageMargin != null ? resume.customization.spacing.pageMargin : 32;

    // Standard A4 pixel height at 96 DPI = 1123px
    const A4_PAGE_HEIGHT_PX = 1123;
    // Usable height inside the A4 sheet excluding top/bottom padding and safety margin
    const USABLE_HEIGHT_PX = Math.max(400, A4_PAGE_HEIGHT_PX - (pageMargin * 2) - 12);

    // In a browser environment, use live DOM measurement
    if (typeof document !== 'undefined' && document.body) {
      let scratchpad = document.getElementById('__resume_measure_scratchpad__');
      if (!scratchpad) {
        scratchpad = document.createElement('div');
        scratchpad.id = '__resume_measure_scratchpad__';
        scratchpad.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:794px;min-width:794px;max-width:794px;visibility:hidden;pointer-events:none;z-index:-1000;';
        document.body.appendChild(scratchpad);
      }

      const headerHtml = renderHeaderHtml(resume);
      const sectionsHtml = (resume.sectionOrder || []).map((id) => renderSection(id, resume)).join('');

      scratchpad.innerHTML = `
        <div class="resume-page ${templateClass}" style="${styleAttr}; padding:${pageMargin}px; height:auto; min-height:0; max-height:none; overflow:visible;">
          <div class="resume-page-content doc-main-wrapper">
            ${headerHtml}
            ${sectionsHtml}
          </div>
        </div>`;

      const measuredHeader = scratchpad.querySelector('.doc-header');
      const measuredSections = [...scratchpad.querySelectorAll('.doc-section')];

      const pages = [];
      let currentPageItems = [];
      let currentHeight = 0;

      // Page 1 begins with the header
      if (measuredHeader) {
        const headerH = measuredHeader.getBoundingClientRect().height + 16;
        currentPageItems.push(measuredHeader.outerHTML);
        currentHeight += headerH;
      }

      measuredSections.forEach((secEl) => {
        const titleEl = secEl.querySelector('.doc-section-title');
        const childNodes = [...secEl.children].filter((c) => !c.classList.contains('doc-section-title'));
        const titleH = titleEl ? titleEl.getBoundingClientRect().height + 14 : 0;
        const titleHtml = titleEl ? titleEl.outerHTML : '';

        if (!childNodes.length) {
          // If section is empty or plain text paragraph
          const secH = secEl.getBoundingClientRect().height + 16;
          if (currentHeight + secH > USABLE_HEIGHT_PX && currentPageItems.length > 0) {
            pages.push(currentPageItems);
            currentPageItems = [];
            currentHeight = 0;
          }
          currentPageItems.push(secEl.outerHTML);
          currentHeight += secH;
          return;
        }

        // Section has entries/items. Check if title + first item fits
        const firstItemH = childNodes[0] ? childNodes[0].getBoundingClientRect().height + 10 : 30;
        if (currentHeight + titleH + Math.min(firstItemH, 50) > USABLE_HEIGHT_PX && currentPageItems.length > 0) {
          // Move section title to fresh page to avoid orphan title at bottom
          pages.push(currentPageItems);
          currentPageItems = [];
          currentHeight = 0;
        }

        let sectionItemsForCurrentPage = [];
        if (titleHtml) {
          sectionItemsForCurrentPage.push(titleHtml);
          currentHeight += titleH;
        }

        childNodes.forEach((itemEl) => {
          const itemH = itemEl.getBoundingClientRect().height + 10;
          if (currentHeight + itemH <= USABLE_HEIGHT_PX) {
            sectionItemsForCurrentPage.push(itemEl.outerHTML);
            currentHeight += itemH;
          } else {
            // Item does not fit on current page. Finalize current page and start next page.
            if (sectionItemsForCurrentPage.length > 0) {
              currentPageItems.push(`<section class="doc-section">${sectionItemsForCurrentPage.join('')}</section>`);
              sectionItemsForCurrentPage = [];
            }
            if (currentPageItems.length > 0) {
              pages.push(currentPageItems);
              currentPageItems = [];
              currentHeight = 0;
            }
            // Add continuation section title on new page if it's continuing
            if (titleHtml) {
              sectionItemsForCurrentPage.push(titleHtml);
              currentHeight += titleH;
            }
            sectionItemsForCurrentPage.push(itemEl.outerHTML);
            currentHeight += itemH;
          }
        });

        if (sectionItemsForCurrentPage.length > 0) {
          currentPageItems.push(`<section class="doc-section">${sectionItemsForCurrentPage.join('')}</section>`);
        }
      });

      if (currentPageItems.length > 0 || pages.length === 0) {
        pages.push(currentPageItems);
      }

      // Cleanup scratchpad
      scratchpad.innerHTML = '';

      const totalPages = Math.max(1, pages.length);
      const pagesHtml = pages.map((pageContentList, idx) => {
        const pageNum = idx + 1;
        const pageNumberHtml = renderPageNumber(resume.customization, pageNum, totalPages);

        return `
          <div class="resume-page ${templateClass}" data-page="${pageNum}" style="${styleAttr}; padding:${pageMargin}px;">
            <div class="resume-page-content doc-main-wrapper">
              ${pageContentList.join('')}
            </div>
            ${pageNumberHtml}
          </div>`;
      }).join('');

      const containerHtml = `<div class="resume-pages-container" data-total-pages="${totalPages}">${pagesHtml}</div>`;

      if (targetEl) {
        targetEl.innerHTML = containerHtml;

        // Dispatch pagination update event
        window.dispatchEvent(new CustomEvent('resume:paginated', {
          detail: { totalPages, currentPage: 1 }
        }));
      }

      return containerHtml;
    }

    // Server-side fallback or static render
    return render(resume);
  }

  function render(resume) {
    if (resume && resume.docType === 'cover_letter') {
      return renderCoverLetter(resume);
    }
    const p = resume.personal || {};
    const displayName = p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Your Name';
    const displayTitle = p.title || p.jobTarget || 'Your professional title';
    const sections = (resume.sectionOrder || []).map((id) => renderSection(id, resume)).join('');
    const styleAttr = customizationStyleVars(resume.customization);
    const photoPosition = resume.customization?.photo?.position || 'left';
    const photoHtml = renderPhoto(resume.customization);
    const pageNumberHtml = renderPageNumber(resume.customization, 1, 1);
    const pageMargin = resume.customization?.spacing?.pageMargin != null ? resume.customization.spacing.pageMargin : 32;

    return `
      <div class="resume-pages-container" data-total-pages="1">
        <div class="resume-page theme-${resume.template || 'classic'}" data-page="1" style="${styleAttr}; padding:${pageMargin}px;">
          <div class="resume-page-content doc-main-wrapper">
            <div class="doc-header doc-header-photo-${photoHtml ? photoPosition : 'none'}">
              ${photoHtml}
              <div class="doc-header-text">
                <h1>${esc(displayName)}</h1>
                <div class="doc-title">${esc(displayTitle)}</div>
                <div class="doc-contact">${renderContact(p)}</div>
              </div>
            </div>
            ${sections}
          </div>
          ${pageNumberHtml}
        </div>
      </div>`;
  }

  function mount(resume, targetEl) {
    return paginate(resume, targetEl);
  }

// ---- Modular "disk" rendering (client-side player) ------------------------
  // A JavaScript twin of the server-side render_template_html() in
  // template_service.py. It takes the raw modular HTML template (the "disk")
  // and injects the resume payload into the standardized Mustache placeholders
  // ({{key}}, {{#if}}, {{#each}}), so the browser can render ANY discovered
  // template with zero per-template markup or logic added to the player.

  function _getPath(data, path) {
    let curr = data;
    for (const part of String(path).trim().split('.')) {
      if (!part) continue;
      if (curr && typeof curr === 'object' && part in curr) curr = curr[part];
      else return undefined;
    }
    return curr;
  }

  /**
   * Find the closing tag for a `{{#type path}}` block opened at `from`,
   * correctly handling arbitrarily nested blocks of the same type.
   * Returns the inner body text and the index just past the closing tag.
   */
  function _matchBlock(template, from, type) {
    const openerPrefix = '#' + type;
    const closer = '/' + type;
    let depth = 0;
    let pos = from;
    while (pos < template.length) {
      const ob = template.indexOf('{{', pos);
      if (ob === -1) break;
      const cb = template.indexOf('}}', ob + 2);
      if (cb === -1) break;
      const tag = template.slice(ob + 2, cb).trim();
      if (tag.startsWith(openerPrefix)) {
        depth++;
      } else if (tag === closer) {
        if (depth === 0) {
          return { body: template.slice(from, ob), next: cb + 2 };
        }
        depth--;
      }
      pos = cb + 2;
    }
    // No matching closer found — treat the rest as the body.
    return { body: template.slice(from, template.length), next: template.length };
  }

  /**
   * Recursive tokenizer that fills standardized Mustache placeholders.
   * Supports {{path}}, {{this}}, {{#if path}}...{{/if}} and
   * {{#each path}}...{{/each}} with arbitrary nesting — so a single disk can
   * freely wrap blocks the way its author likes (e.g. an outer {{#if skills}}
   * around inner per-category {{#if}}/{{#each}} blocks).
   */
  function _renderModularBlock(template, data) {
    let out = '';
    let i = 0;
    const n = template.length;
    while (i < n) {
      const ob = template.indexOf('{{', i);
      if (ob === -1) { out += template.slice(i); break; }
      out += template.slice(i, ob);
      const cb = template.indexOf('}}', ob + 2);
      if (cb === -1) { out += template.slice(ob); break; }
      const tag = template.slice(ob + 2, cb).trim();
      i = cb + 2;

      if (tag.startsWith('#each ')) {
        const path = tag.slice(6).trim();
        const { body, next } = _matchBlock(template, i, 'each');
        const items = _getPath(data, path);
        if (Array.isArray(items)) {
          for (const item of items) {
            if (typeof item === 'string') {
              out += body.split('{{this}}').join(esc(item));
            } else if (item && typeof item === 'object') {
              out += _renderModularBlock(body, item);
            }
          }
        }
        i = next;
      } else if (tag.startsWith('#if ')) {
        const path = tag.slice(4).trim();
        const { body, next } = _matchBlock(template, i, 'if');
        const val = _getPath(data, path);
        const truthy = Array.isArray(val) ? val.length > 0 : !!val;
        if (truthy) out += _renderModularBlock(body, data);
        i = next;
      } else {
        // Custom inline helper: {{fn path}} — e.g. {{handle personal.linkedin}}.
        const h = tag.match(/^([A-Za-z_$][\w$]*)\s+(.+)$/);
        if (h && InlineHelpers[h[1]]) {
          const arg = _getPath(data, h[2].trim());
          if (arg !== undefined && arg !== null) out += esc(String(InlineHelpers[h[1]](arg)));
        } else {
          // Plain {{path}} variable — HTML-escaped.
          const val = _getPath(data, tag);
          if (val !== undefined && val !== null) out += esc(String(val));
        }
      }
    }
    return out;
  }

  /** Render a modular resume "disk" into its final self-contained HTML. */
  async function renderModular(templateId, resume) {
    return renderModularFromRaw(await fetchRawTemplate(templateId), resume);
  }

  /** Render a raw template string (metadata comment stripped) against data. */
  function renderModularFromRaw(rawHtml, resume) {
    let output = String(rawHtml || '');
    // Strip any embedded @template metadata comment header.
    output = output.replace(/<!--\s*@template:[\s\S]*?-->\s*/g, '');
    return _renderModularBlock(output, resume || {});
  }

  /**
   * Convenience: render a modular disk and mount the result into an element.
   * Returns the rendered HTML string as well.
   */
  async function renderModularInto(templateId, resume, targetEl) {
    const html = await renderModular(templateId, resume);
    if (targetEl) targetEl.innerHTML = html;
    return html;
  }
  function getA4Dimensions() {
    return A4_DIMENSIONS;
  }

  return {
    render,
    renderCoverLetter,
    mount,
    paginate,
    getA4Dimensions,
    fetchTemplateList,
    clearTemplateListCache,
    clearRawTemplateCache,
    fetchRawTemplate,
    renderModular,
    renderModularFromRaw,
    renderModularInto,
    formatMarkdownLite,
    renderContact,
    renderPhoto,
    renderPageNumber,
    customizationStyleVars,
  };
})();
