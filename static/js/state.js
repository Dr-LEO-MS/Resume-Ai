/**
 * state.js
 * ---------------------------------------------------------------------------
 * Single source of truth for the resume being edited in builder.html.
 * Every other module (ai-check, ai-enhance, template-engine, pdf-export,
 * storage) reads from and writes to this object via the exported functions.
 * ---------------------------------------------------------------------------
 */

const ResumeState = (() => {
  // ---- Default empty resume ------------------------------------------------
  let resume = {
    id: null,                     // set once saved to the server; null while purely local
    template: 'classic',          // classic | modern | minimal | bold
    sectionOrder: ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages'],
    hiddenSections: [],
    personal: {
      firstName: '',
      lastName: '',
      fullName: '',
      title: '',
      email: '',
      phone: '',
      linkedin: '',
      postalCode: '',
      city: '',
      country: '',
      location: '',
      github: '',
      website: '',
      address: '',
      dob: '',
      nationality: '',
      drivingLicense: '',
      photo: null,
    },
    summary: '',
    coverLetter: {
      companyName: '',
      hiringManager: '',
      companyAddress: '',
      date: '',
      salutation: 'Dear Hiring Team,',
      body: '',
      keyQualifications: [],
      signOff: 'Sincerely,',
      signature: '',
    },
    experience: [
      // { id, company, role, location, start, end, current, bullets: [''] }
    ],
    education: [
      // { id, school, degree, field, start, end, gpa, coursework, honors }
    ],
    skills: {
      technical: [],
      soft: [],
      tools: [],
    },
    projects: [
      // { id, name, description, link, role, start, end }
    ],
    certifications: [
      // { id, name, issuer, date, url }
    ],
    languages: [
      // { id, name, level }
    ],
    sectionTitles: {},            // { [sectionId]: 'Custom Title' }
    // Per-resume appearance overrides. Every new template initializes these
    // from its meta.json `style` block (see template-engine.js applyTemplateDefaults);
    // anything the user changes here in the Design panel takes precedence
    // and is saved as part of this resume, so it persists across sessions.
    customization: {
      fontSizes: { name: 26, h2: 12, body: 13, contact: 11 },
      colors: { heading: '#1c1c1c', body: '#333333', link: '#5b5bd6', accent: '#5b5bd6' },
      fonts: { heading: 'Fraunces, Georgia, serif', body: 'Inter, sans-serif' },
      spacing: { lineHeight: 1.5, sectionSpacing: 20, pageMargin: 32 },
      photo: { url: null, visible: false, position: 'left', shape: 'circle' },
      pageNumbers: { enabled: false, position: 'bottom-center', format: 'Page {n}' },
    },
  };

  // ---- Pub/sub ---------------------------------------------------------
  const listeners = new Set();
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function notify() {
    listeners.forEach((fn) => fn(resume));
  }

  // ---- Helpers -----------------------------------------------------------
  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function get() {
    return resume;
  }

  function replace(newResume) {
    resume = normalizeResume(newResume);
    notify();
  }

  function normalizeResume(data) {
    if (!data) return resume;
    const base = {
      ...data,
      id: data.id || null,
      template: data.template || 'classic',
      docType: data.docType || 'resume',
      sectionOrder: Array.isArray(data.sectionOrder) ? [...data.sectionOrder] : ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages'],
      hiddenSections: Array.isArray(data.hiddenSections) ? [...data.hiddenSections] : [],
      personal: {
        firstName: data.personal?.firstName || (data.personal?.fullName ? data.personal.fullName.split(' ')[0] : ''),
        lastName: data.personal?.lastName || (data.personal?.fullName ? data.personal.fullName.split(' ').slice(1).join(' ') : ''),
        fullName: data.personal?.fullName || [data.personal?.firstName, data.personal?.lastName].filter(Boolean).join(' ') || '',
        title: data.personal?.title || data.personal?.jobTarget || '',
        email: data.personal?.email || '',
        phone: data.personal?.phone || '',
        linkedin: data.personal?.linkedin || '',
        postalCode: data.personal?.postalCode || '',
        city: data.personal?.city || data.personal?.location || '',
        country: data.personal?.country || '',
        location: data.personal?.location || [data.personal?.city, data.personal?.country].filter(Boolean).join(', ') || '',
        github: data.personal?.github || '',
        website: data.personal?.website || '',
        address: data.personal?.address || '',
        dob: data.personal?.dob || '',
        nationality: data.personal?.nationality || '',
        drivingLicense: data.personal?.drivingLicense || '',
        photo: data.personal?.photo || null,
      },
      summary: data.summary || '',
      coverLetter: {
        companyName: data.coverLetter?.companyName || data.cover_letter?.companyName || '',
        hiringManager: data.coverLetter?.hiringManager || data.cover_letter?.hiringManager || '',
        companyAddress: data.coverLetter?.companyAddress || data.cover_letter?.companyAddress || '',
        date: data.coverLetter?.date || data.cover_letter?.date || '',
        salutation: data.coverLetter?.salutation || data.cover_letter?.salutation || 'Dear Hiring Team,',
        body: data.coverLetter?.body || data.cover_letter?.body || '',
        keyQualifications: Array.isArray(data.coverLetter?.keyQualifications) ? [...data.coverLetter.keyQualifications] : [],
        signOff: data.coverLetter?.signOff || data.cover_letter?.signOff || 'Sincerely,',
        signature: data.coverLetter?.signature || data.cover_letter?.signature || '',
      },
      experience: Array.isArray(data.experience) ? data.experience.map(e => ({
        id: e.id || uid(),
        company: e.company || '',
        role: e.role || '',
        location: e.location || '',
        start: e.start || '',
        end: e.end || '',
        current: Boolean(e.current),
        bullets: Array.isArray(e.bullets) ? [...e.bullets] : [''],
      })) : [],
      education: Array.isArray(data.education) ? data.education.map(e => ({
        id: e.id || uid(),
        school: e.school || '',
        degree: e.degree || '',
        field: e.field || '',
        start: e.start || '',
        end: e.end || '',
        gpa: e.gpa || '',
        coursework: e.coursework || '',
        honors: e.honors || '',
      })) : [],
      skills: normalizeSkills(data.skills),
      projects: Array.isArray(data.projects) ? data.projects.map(p => ({
        id: p.id || uid(),
        name: p.name || '',
        description: p.description || '',
        link: p.link || '',
        role: p.role || '',
        start: p.start || '',
        end: p.end || '',
      })) : [],
      certifications: Array.isArray(data.certifications) ? data.certifications.map(c => ({
        id: c.id || uid(),
        name: c.name || '',
        issuer: c.issuer || '',
        date: c.date || '',
        url: c.url || '',
      })) : [],
      languages: Array.isArray(data.languages) ? data.languages.map(l => ({
        id: l.id || uid(),
        name: l.name || '',
        level: l.level || 'Professional',
      })) : [],
      sectionTitles: (data.sectionTitles && typeof data.sectionTitles === 'object') ? { ...data.sectionTitles } : {},
      customization: normalizeCustomization(data.customization),
    };
    return base;
  }

  const DEFAULT_CUSTOMIZATION = {
    fontSizes: { name: 26, h2: 12, body: 13, contact: 11 },
    colors: { heading: '#1c1c1c', body: '#333333', link: '#5b5bd6', accent: '#5b5bd6' },
    fonts: { heading: 'Fraunces, Georgia, serif', body: 'Inter, sans-serif' },
    spacing: { lineHeight: 1.5, sectionSpacing: 20, pageMargin: 32, bulletStyle: 'disc' },
    photo: { url: null, visible: false, position: 'left', shape: 'circle' },
    pageNumbers: { enabled: false, position: 'bottom-center', format: 'Page {n}' },
    layout: 'single_column',
  };

  function normalizeCustomization(c) {
    c = c || {};
    return {
      fontSizes: { ...DEFAULT_CUSTOMIZATION.fontSizes, ...(c.fontSizes || {}) },
      colors: { ...DEFAULT_CUSTOMIZATION.colors, ...(c.colors || {}) },
      fonts: { ...DEFAULT_CUSTOMIZATION.fonts, ...(c.fonts || {}) },
      spacing: { ...DEFAULT_CUSTOMIZATION.spacing, ...(c.spacing || {}) },
      photo: { ...DEFAULT_CUSTOMIZATION.photo, ...(c.photo || {}) },
      pageNumbers: { ...DEFAULT_CUSTOMIZATION.pageNumbers, ...(c.pageNumbers || {}) },
      layout: c.layout || DEFAULT_CUSTOMIZATION.layout,
    };
  }

  function normalizeSkills(skillsData) {
    if (Array.isArray(skillsData)) {
      // Legacy flat array of string skills
      return {
        technical: skillsData,
        soft: [],
        tools: [],
      };
    }
    if (skillsData && typeof skillsData === 'object') {
      return {
        technical: Array.isArray(skillsData.technical) ? [...skillsData.technical] : [],
        soft: Array.isArray(skillsData.soft) ? [...skillsData.soft] : [],
        tools: Array.isArray(skillsData.tools) ? [...skillsData.tools] : [],
      };
    }
    return { technical: [], soft: [], tools: [] };
  }

  function update(path, value) {
    const keys = path.split('.');
    let obj = resume;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    notify();
  }

  // ---- Section entry CRUD ------------------------------------------------
  function addEntry(section, entryTemplate) {
    const entry = { id: uid(), ...entryTemplate };
    if (resume[section] && typeof resume[section] === 'object' && !Array.isArray(resume[section])) {
      if (!Array.isArray(resume[section].items)) resume[section].items = [];
      resume[section].items.push(entry);
    } else {
      if (!Array.isArray(resume[section])) resume[section] = [];
      resume[section].push(entry);
    }
    notify();
    return entry;
  }

  function removeEntry(section, id) {
    if (resume[section] && typeof resume[section] === 'object' && !Array.isArray(resume[section])) {
      if (Array.isArray(resume[section].items)) {
        resume[section].items = resume[section].items.filter((e) => e.id !== id);
      }
    } else if (Array.isArray(resume[section])) {
      resume[section] = resume[section].filter((e) => e.id !== id);
    }
    notify();
  }

  function updateEntry(section, id, field, value) {
    let list = null;
    if (resume[section] && typeof resume[section] === 'object' && !Array.isArray(resume[section])) {
      list = resume[section].items;
    } else if (Array.isArray(resume[section])) {
      list = resume[section];
    }
    if (!Array.isArray(list)) return;
    const entry = list.find((e) => e.id === id);
    if (entry) entry[field] = value;
    notify();
  }

  function reorderEntries(section, newOrderedIds) {
    let isObject = false;
    let list = null;
    if (resume[section] && typeof resume[section] === 'object' && !Array.isArray(resume[section])) {
      isObject = true;
      list = resume[section].items || [];
    } else if (Array.isArray(resume[section])) {
      list = resume[section];
    } else {
      return;
    }
    const itemMap = new Map();
    list.forEach((item) => {
      if (item && item.id) itemMap.set(String(item.id), item);
    });
    const reordered = [];
    newOrderedIds.forEach((id) => {
      const item = itemMap.get(String(id));
      if (item) {
        reordered.push(item);
        itemMap.delete(String(id));
      }
    });
    // Add any remaining items
    itemMap.forEach((item) => reordered.push(item));
    if (isObject) {
      resume[section].items = reordered;
    } else {
      resume[section] = reordered;
    }
    notify();
  }

  function addCustomSection(customTitle) {
    const id = 'custom_section_' + uid();
    resume[id] = {
      title: customTitle || 'Untitled',
      items: [
        {
          id: uid(),
          title: '',
          city: '',
          start: '',
          end: '',
          description: '',
        }
      ]
    };
    if (!resume.sectionOrder.includes(id)) {
      resume.sectionOrder.push(id);
    }
    notify();
    return id;
  }

  function removeSection(sectionId) {
    resume.sectionOrder = (resume.sectionOrder || []).filter(s => s !== sectionId);
    resume.hiddenSections = (resume.hiddenSections || []).filter(s => s !== sectionId);
    if (resume.sectionTitles && resume.sectionTitles[sectionId]) {
      delete resume.sectionTitles[sectionId];
    }
    if (sectionId.startsWith('custom_') && resume[sectionId]) {
      delete resume[sectionId];
    }
    notify();
  }

  function setSectionTitle(sectionId, title) {
    if (!resume.sectionTitles) resume.sectionTitles = {};
    const trimmed = (title || '').trim();
    if (trimmed) {
      resume.sectionTitles[sectionId] = trimmed;
      if (sectionId.startsWith('custom_') && resume[sectionId] && typeof resume[sectionId] === 'object') {
        resume[sectionId].title = trimmed;
      }
    } else {
      delete resume.sectionTitles[sectionId];
      if (sectionId.startsWith('custom_') && resume[sectionId] && typeof resume[sectionId] === 'object') {
        resume[sectionId].title = 'Custom Section';
      }
    }
    notify();
  }

  function revertSectionTitle(sectionId) {
    if (resume.sectionTitles && resume.sectionTitles[sectionId]) {
      delete resume.sectionTitles[sectionId];
    }
    if (sectionId.startsWith('custom_') && resume[sectionId] && typeof resume[sectionId] === 'object') {
      resume[sectionId].title = 'Custom Section';
    }
    notify();
  }

  function addBullet(entryId) {
    const entry = resume.experience.find((e) => e.id === entryId);
    if (entry) {
      if (!entry.bullets) entry.bullets = [];
      entry.bullets.push('');
    }
    notify();
  }

  function updateBullet(entryId, index, value) {
    const entry = resume.experience.find((e) => e.id === entryId);
    if (entry && entry.bullets) {
      entry.bullets[index] = value;
    }
    notify();
  }

  function removeBullet(entryId, index) {
    const entry = resume.experience.find((e) => e.id === entryId);
    if (entry && entry.bullets) {
      entry.bullets.splice(index, 1);
    }
    notify();
  }

  // ---- Skills helper methods ---------------------------------------------
  function addSkill(category, skillName) {
    const name = skillName.trim();
    if (!name) return;
    if (!resume.skills[category]) resume.skills[category] = [];
    if (!resume.skills[category].includes(name)) {
      resume.skills[category].push(name);
      notify();
    }
  }

  function removeSkill(category, index) {
    if (resume.skills[category]) {
      resume.skills[category].splice(index, 1);
      notify();
    }
  }

  // ---- Section ordering ---------------------------------------------------
  function reorderSections(newOrder) {
    resume.sectionOrder = newOrder;
    notify();
  }

  function toggleSectionVisibility(section) {
    const idx = resume.hiddenSections.indexOf(section);
    if (idx > -1) resume.hiddenSections.splice(idx, 1);
    else resume.hiddenSections.push(section);
    notify();
  }

  function setTemplate(templateId) {
    resume.template = templateId;
    notify();
  }

  // ---- Customization (Design panel) ---------------------------------------
  function updateCustomization(group, field, value) {
    if (!resume.customization) resume.customization = normalizeCustomization();
    if (!resume.customization[group]) resume.customization[group] = {};
    resume.customization[group][field] = value;
    notify();
  }

  function applyTemplateDefaults(templateStyle) {
    // Called when the user picks a template that hasn't been customized yet —
    // seeds sensible starting values from the template's own meta.json style
    // block, which the user can then override in the Design panel.
    if (!templateStyle) return;
    if (templateStyle.font_family) {
      resume.customization.fonts.heading = templateStyle.font_family;
    }
    if (templateStyle.primary_color) {
      resume.customization.colors.accent = templateStyle.primary_color;
      resume.customization.colors.link = templateStyle.primary_color;
    }
    notify();
  }

  // ---- Completion & Inline Validation Analysis ---------------------------
  function getValidation() {
    const errors = {};
    const warnings = {};

    const p = resume.personal || {};
    let personalCount = 0;
    const hasName = (p.firstName && p.firstName.trim()) || (p.fullName && p.fullName.trim());
    if (hasName) personalCount++;
    else errors['personal.fullName'] = 'Name is required';

    if (p.email && p.email.trim()) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) {
        personalCount++;
      } else {
        errors['personal.email'] = 'Invalid email address format';
      }
    } else {
      errors['personal.email'] = 'Email address is recommended';
    }

    if (p.phone && p.phone.trim()) personalCount++;
    const hasLoc = (p.city && p.city.trim()) || (p.country && p.country.trim()) || (p.location && p.location.trim()) || (p.address && p.address.trim());
    if (hasLoc) personalCount++;
    if ((p.title && p.title.trim()) || (p.jobTarget && p.jobTarget.trim())) personalCount++;
    if (p.linkedin && p.linkedin.trim()) personalCount++;

    // Specific validation path for Cover Letters
    if (resume.docType === 'cover_letter') {
      const cl = resume.coverLetter || {};
      let clScore = 0;
      const maxScore = 6;

      if (hasName) clScore++;
      if (p.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) clScore++;
      if (p.phone && p.phone.trim()) clScore += 0.5;
      if (p.title && p.title.trim()) clScore += 0.5;

      if (cl.companyName && cl.companyName.trim()) {
        clScore++;
      } else {
        errors['coverLetter.companyName'] = 'Company name is required';
      }

      if (cl.hiringManager && cl.hiringManager.trim()) {
        clScore += 0.5;
      }

      const rawBody = (cl.body || '').replace(/<[^>]*>/g, '').trim();
      const words = rawBody ? rawBody.split(/\s+/).filter(Boolean).length : 0;
      const chars = rawBody.length;

      if (words >= 100) {
        clScore += 1.5;
      } else if (words > 0) {
        clScore += 0.8;
        warnings['coverLetter.body'] = 'Letter is short. 250–400 words (3–4 paragraphs) recommended.';
      } else {
        errors['coverLetter.body'] = 'Letter body text is required';
      }

      if (words > 500) {
        warnings['coverLetter.body'] = 'Letter is lengthy and may exceed a single A4 page. 250–400 words recommended.';
      }

      const overallPercentage = Math.min(100, Math.round((clScore / maxScore) * 100));

      return {
        errors,
        warnings,
        wordCount: words,
        charCount: chars,
        sectionProgress: {
          personal: Math.min(100, Math.round((personalCount / 4) * 100)),
          employer: cl.companyName ? (cl.hiringManager ? 100 : 70) : 0,
          letter: Math.min(100, Math.round((words / 250) * 100)),
        },
        overallPercentage,
      };
    }

    const sectionProgress = {
      personal: 0,
      summary: 0,
      experience: 0,
      education: 0,
      skills: 0,
      projects: 0,
      certifications: 0,
      languages: 0,
    };

    sectionProgress.personal = Math.min(100, Math.round((personalCount / 5) * 100));

    // Summary validation
    if (resume.summary && resume.summary.trim()) {
      const words = resume.summary.trim().split(/\s+/).length;
      if (words < 15) {
        warnings['summary'] = 'Summary is brief. 30-50 words recommended for maximum impact.';
        sectionProgress.summary = 50;
      } else {
        sectionProgress.summary = 100;
      }
    } else {
      warnings['summary'] = 'Adding a summary improves resume visibility.';
      sectionProgress.summary = 0;
    }

    // Experience validation
    if (resume.experience && resume.experience.length > 0) {
      let expScore = 0;
      resume.experience.forEach((e, idx) => {
        let entryScore = 0;
        if (e.role && e.role.trim()) entryScore += 25;
        else errors[`experience.${idx}.role`] = 'Job title is required';

        if (e.company && e.company.trim()) entryScore += 25;
        else errors[`experience.${idx}.company`] = 'Company name is required';

        if (e.start && e.start.trim()) entryScore += 25;
        if (e.bullets && e.bullets.filter(b => b.trim()).length > 0) entryScore += 25;
        else warnings[`experience.${idx}.bullets`] = 'Add bullet points describing achievements';

        expScore += entryScore;
      });
      sectionProgress.experience = Math.min(100, Math.round(expScore / resume.experience.length));
    } else {
      sectionProgress.experience = 0;
      warnings['experience'] = 'Work experience section is empty';
    }

    // Education validation
    if (resume.education && resume.education.length > 0) {
      let eduScore = 0;
      resume.education.forEach((e, idx) => {
        let entryScore = 0;
        if (e.school && e.school.trim()) entryScore += 35;
        else errors[`education.${idx}.school`] = 'Institution / School is required';

        if (e.degree && e.degree.trim()) entryScore += 35;
        else errors[`education.${idx}.degree`] = 'Degree is required';

        if (e.start || e.end) entryScore += 30;

        eduScore += entryScore;
      });
      sectionProgress.education = Math.min(100, Math.round(eduScore / resume.education.length));
    } else {
      sectionProgress.education = 0;
    }

    // Skills validation
    const totalSkills = (resume.skills?.technical?.length || 0) + 
                        (resume.skills?.soft?.length || 0) + 
                        (resume.skills?.tools?.length || 0);
    if (totalSkills >= 6) {
      sectionProgress.skills = 100;
    } else if (totalSkills > 0) {
      sectionProgress.skills = Math.round((totalSkills / 6) * 100);
      warnings['skills'] = 'Add at least 6-8 skills to highlight your expertise';
    } else {
      sectionProgress.skills = 0;
    }

    // Optional sections
    sectionProgress.projects = (resume.projects && resume.projects.length > 0) ? 100 : 0;
    sectionProgress.certifications = (resume.certifications && resume.certifications.length > 0) ? 100 : 0;
    sectionProgress.languages = (resume.languages && resume.languages.length > 0) ? 100 : 0;

    // Overall Completion Rate Calculation
    const activeSections = resume.sectionOrder.filter(s => !resume.hiddenSections.includes(s));
    let totalWeight = 0;
    let earnedWeight = 0;

    const weights = {
      personal: 25,
      summary: 15,
      experience: 30,
      education: 15,
      skills: 15,
      projects: 10,
      certifications: 10,
      languages: 5,
    };

    activeSections.forEach(sec => {
      const w = weights[sec] || 10;
      totalWeight += w;
      earnedWeight += ((sectionProgress[sec] || 0) / 100) * w;
    });

    const overallPercentage = totalWeight > 0 ? Math.min(100, Math.round((earnedWeight / totalWeight) * 100)) : 0;

    return {
      errors,
      warnings,
      sectionProgress,
      overallPercentage,
    };
  }

  return {
    get, replace, update, subscribe,
    addEntry, removeEntry, updateEntry, reorderEntries,
    addCustomSection, removeSection, setSectionTitle, revertSectionTitle,
    addBullet, updateBullet, removeBullet,
    addSkill, removeSkill,
    reorderSections, toggleSectionVisibility, setTemplate,
    updateCustomization, applyTemplateDefaults,
    getValidation, uid, normalizeResume,
  };
})();
