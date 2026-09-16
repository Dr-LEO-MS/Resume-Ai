/**
 * builder.js
 * ---------------------------------------------------------------------------
 * Page controller for builder.html. Wires ResumeState, ResumeStorage,
 * TemplateEngine, AICheck, AIEnhance, and PDFExport together.
 * ---------------------------------------------------------------------------
 */

(function () {
  if (typeof Auth !== 'undefined' && !Auth.requireAuth()) return;

  const SECTION_LABELS = {
    personal: 'Personal Details',
    summary: 'Objective',
    experience: 'Work Experience',
    education: 'Education',
    skills: 'Skills',
    projects: 'Projects',
    certifications: 'Licenses & Certifications',
    languages: 'Languages',
    custom_section: 'Custom Section',
    training: 'Professional Training',
    additional_experience: 'Additional Experience',
    volunteering: 'Volunteering',
    power_statement: 'Power Statement',
    affiliations: 'Affiliations',
    header_footer: 'Header & Footer',
    extracurricular: 'Extracurricular Activities',
    conferences: 'Conferences',
    hobbies: 'Hobbies',
    references: 'References',
    awards: 'Awards',
  };

  const SECTION_DESCRIPTIONS = {
    personal: 'Your contact details appear at the top of every template.',
    summary: 'Write 2-4 short, energetic sentences about how great you are. Mention the role and what you did. What were the big achievements? Describe your motivation and list your skills.',
    experience: 'List your work experience starting with your most recent position.',
    education: 'List your educational background, degrees, relevant coursework, and honors.',
    skills: 'Add categorized technical, tools, and soft skills relevant to your target role.',
    projects: 'Highlight personal or professional projects, achievements, and repositories.',
    certifications: 'List professional certifications, licenses, or credentials.',
    languages: 'List languages you speak and your level of proficiency.',
    custom_section: 'Add a custom section with your own title and content.',
    training: 'Highlight professional training courses, workshops, and seminars.',
    additional_experience: 'List military, freelance, contract, or other additional experience.',
    volunteering: 'List non-profit, community service, or volunteer work.',
    power_statement: 'Add a key value proposition or high-impact career statement.',
    affiliations: 'List professional associations, boards, or society memberships.',
    header_footer: 'Customize top header or bottom footer text across resume pages.',
    extracurricular: 'List student activities, clubs, or community leadership.',
    conferences: 'List keynote presentations, panels, or conferences attended.',
    hobbies: 'List interests, sports, or hobbies that showcase your personality.',
    references: 'List professional references available upon request.',
    awards: 'List honors, achievements, patents, or industry awards received.',
  };

  const ADD_SECTION_OPTIONS = [
    { id: 'custom_section', label: 'Custom Section', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>`, locked: false },
    { id: 'training', label: 'Professional Training', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`, locked: false },
    { id: 'additional_experience', label: 'Additional Experience', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`, locked: false },
    { id: 'volunteering', label: 'Volunteering', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A4.5 4.5 0 0 0 14.5 4c-1.25 0-2.42.52-3.26 1.35L10 6.55 8.76 5.35A4.5 4.5 0 0 0 1.5 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>`, locked: true },
    { id: 'languages', label: 'Languages', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`, locked: false },
    { id: 'power_statement', label: 'Power Statement', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`, locked: true },
    { id: 'affiliations', label: 'Affiliations', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="21" x2="21" y2="21"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7 12 2"/></svg>`, locked: true },

    { id: 'header_footer', label: 'Header & Footer', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`, locked: true },
    { id: 'extracurricular', label: 'Extracurricular Activities', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22v-9"/><path d="M12 13a7 7 0 0 0 7-7c0-2-1-3-3-3a7 7 0 0 0-4 10z"/><path d="M12 13a7 7 0 0 1-7-7c0-2 1-3 3-3a7 7 0 0 1 4 10z"/></svg>`, locked: false },
    { id: 'conferences', label: 'Conferences', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`, locked: true },
    { id: 'hobbies', label: 'Hobbies', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19.43 12.98A8 8 0 1 0 11 20l.57.02h.43a8 8 0 0 0 7.43-7.04z"/><circle cx="12" cy="12" r="3"/></svg>`, locked: false },
    { id: 'references', label: 'References', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h3c0 4-2 6-4 7.5L3 21z"/><path d="M16 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h3c0 4-2 6-4 7.5l1 1.5z"/></svg>`, locked: false },
    { id: 'awards', label: 'Awards', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 3 18 3 22 9 12 22 2 9 6 3"/></svg>`, locked: true },
    { id: 'certifications', label: 'Licenses & Certifications', icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`, locked: true },
  ];

  let activeSections = ['personal'];
  let activeSection = null; // Temporary context variable used during renderers
  let zoom = 1;
  const expandedCards = new Set(); // tracks expanded entry card IDs (collapsed by default)

  // Crisp, consistently-sized SVG icons for the accordion — swapped in for
  // the old Unicode glyphs (⠿/▲▼), which render inconsistently across
  // fonts/OSes and never quite matched the reference design's clean,
  // minimal look. The chevron rotates via CSS (.is-open), so it's always
  // the same element — no glyph-swapping jank on state change.
  const DRAG_GRIP_SVG = `<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
    <circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/>
    <circle cx="2.5" cy="8" r="1.5"/><circle cx="7.5" cy="8" r="1.5"/>
    <circle cx="2.5" cy="13.5" r="1.5"/><circle cx="7.5" cy="13.5" r="1.5"/>
  </svg>`;
  const CHEVRON_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>`;
  const TRASH_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>`;
  const PENCIL_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
  </svg>`;
  const REVERT_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
    <path d="M3 3v5h5"></path>
  </svg>`;
  const CORE_SECTIONS = ['personal', 'summary', 'experience', 'education', 'skills'];

  function getSectionTitle(secId) {
    const resume = ResumeState.get();
    if (resume.sectionTitles && resume.sectionTitles[secId]) {
      return resume.sectionTitles[secId];
    }
    if (resume[secId] && typeof resume[secId] === 'object' && resume[secId].title) {
      return resume[secId].title;
    }
    return SECTION_LABELS[secId] || secId.replace(/^custom_section_?/, 'Custom Section ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function getDefaultSectionTitle(secId) {
    return SECTION_LABELS[secId] || secId.replace(/^custom_section_?/, 'Custom Section ').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  function getSectionEntries(resume, secId) {
    if (!resume || !secId) return [];
    if (secId === 'experience') return Array.isArray(resume.experience) ? resume.experience : [];
    if (secId === 'education') return Array.isArray(resume.education) ? resume.education : [];
    if (secId === 'projects') return Array.isArray(resume.projects) ? resume.projects : [];
    if (secId === 'certifications') return Array.isArray(resume.certifications) ? resume.certifications : [];
    if (secId === 'languages') return Array.isArray(resume.languages) ? resume.languages : [];
    if (secId === 'references') return Array.isArray(resume.references) ? resume.references : [];
    if (secId.startsWith('custom_section') || secId.startsWith('custom_')) {
      const sec = resume[secId];
      return (sec && Array.isArray(sec.items)) ? sec.items : [];
    }
    if (Array.isArray(resume[secId])) return resume[secId];
    return [];
  }

  function applyTextFormat(textarea, prefix, suffix = '') {
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const val = textarea.value;
    const selected = val.substring(start, end);
    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${suffix}`;
    textarea.value = val.substring(0, start) + replacement + val.substring(end);
    textarea.focus();
    const newPos = selected ? start + replacement.length : start + prefix.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function wireEntriesDragAndDrop(container, sectionName) {
    if (!container) return;
    let draggedEntry = null;

    container.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.entry-row-wrap') || e.target.closest('.entry-card');
      if (!card) return;
      draggedEntry = card;
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.entryId || '');
    });

    container.addEventListener('dragend', () => {
      if (draggedEntry) draggedEntry.classList.remove('is-dragging');
      container.querySelectorAll('.entry-row-wrap, .entry-card').forEach((c) => {
        c.classList.remove('drag-over', 'drag-over-bottom');
      });
      draggedEntry = null;
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const targetCard = e.target.closest('.entry-row-wrap') || e.target.closest('.entry-card');
      if (!targetCard || targetCard === draggedEntry) return;

      const rect = targetCard.getBoundingClientRect();
      const isBottom = e.clientY - rect.top > rect.height / 2;
      container.querySelectorAll('.entry-row-wrap, .entry-card').forEach((c) => {
        if (c !== targetCard) c.classList.remove('drag-over', 'drag-over-bottom');
      });
      if (isBottom) {
        targetCard.classList.remove('drag-over');
        targetCard.classList.add('drag-over-bottom');
      } else {
        targetCard.classList.remove('drag-over-bottom');
        targetCard.classList.add('drag-over');
      }
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetCard = e.target.closest('.entry-row-wrap') || e.target.closest('.entry-card');
      if (!targetCard || !draggedEntry || targetCard === draggedEntry) return;

      const rect = targetCard.getBoundingClientRect();
      const isBottom = e.clientY - rect.top > rect.height / 2;
      if (isBottom) {
        targetCard.parentNode.insertBefore(draggedEntry, targetCard.nextSibling);
      } else {
        targetCard.parentNode.insertBefore(draggedEntry, targetCard);
      }

      container.querySelectorAll('.entry-row-wrap, .entry-card').forEach((c) => {
        c.classList.remove('drag-over', 'drag-over-bottom');
      });

      const newOrderedIds = [...container.querySelectorAll('.entry-row-wrap, .entry-card')]
        .map((c) => c.dataset.entryId)
        .filter(Boolean);

      ResumeState.reorderEntries(sectionName, newOrderedIds);
    });
  }

  const els = {
    sectionList: document.getElementById('section-list'),
    form: document.getElementById('builder-form'),
    previewMount: document.getElementById('preview-mount'),
    autosaveStatus: document.getElementById('autosave-status'),
    zoomLevel: document.getElementById('zoom-level'),
    overallProgressBar: document.getElementById('overall-progress-bar'),
    overallProgressText: document.getElementById('overall-progress-text'),
    exportDropdownToggle: document.getElementById('export-dropdown-toggle'),
    exportDropdownMenu: document.getElementById('export-dropdown-menu'),
    importModal: document.getElementById('import-modal'),
    importFileInput: document.getElementById('import-file-input'),
    importTextInput: document.getElementById('import-text-input'),
  };
// ---- Profile photo: shared modal + actions ---------------------------------
  // The "Add Photo" button lives in Edit -> Profile Summary -> Personal Details
  // (renderPersonalFields), but the modal and actions are shared, so they're
  // wired here once at module scope. Merged URL/upload handling with crop & rotate sub-window modal.
  const photoModalEl = document.getElementById('photo-add-modal');
  const photoCropModalEl = document.getElementById('photo-crop-modal');
  const photoUrlInputEl = document.getElementById('photo-url-input');
  const photoFileInputEl = document.getElementById('photo-file-input');
  const cropCanvas = document.getElementById('crop-canvas');
  const cropZoomRange = document.getElementById('crop-zoom-range');
  const cropRatioSelect = document.getElementById('crop-ratio-select');
  const cropOverlayFrame = document.getElementById('crop-overlay-frame');
  const cropInputX = document.getElementById('crop-input-x');
  const cropInputY = document.getElementById('crop-input-y');
  const cropInputW = document.getElementById('crop-input-w');
  const cropInputH = document.getElementById('crop-input-h');

  const CROP_STAGE_SIZE = 320;
  let loadedImageObj = null;
  let cropRotation = 0;
  let cropScale = 1;
  let cropPanX = 0;
  let cropPanY = 0;
  let cropX = 60;
  let cropY = 60;
  let cropW = 200;
  let cropH = 200;

  let isDraggingCrop = false;
  let isDraggingFrame = false;
  let activeResizer = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let frameDragStartX = 0;
  let frameDragStartY = 0;
  let frameInitialCropX = 0;
  let frameInitialCropY = 0;
  let resizerStartX = 0;
  let resizerStartY = 0;
  let resizerInitialCropX = 0;
  let resizerInitialCropY = 0;
  let resizerInitialCropW = 0;
  let resizerInitialCropH = 0;

  function syncCropInputs() {
    if (cropInputX && document.activeElement !== cropInputX) cropInputX.value = Math.round(cropX);
    if (cropInputY && document.activeElement !== cropInputY) cropInputY.value = Math.round(cropY);
    if (cropInputW && document.activeElement !== cropInputW) cropInputW.value = Math.round(cropW);
    if (cropInputH && document.activeElement !== cropInputH) cropInputH.value = Math.round(cropH);
  }

  function updateOverlayFrameDOM() {
    if (!cropOverlayFrame) return;
    cropOverlayFrame.style.width = `${cropW}px`;
    cropOverlayFrame.style.height = `${cropH}px`;
    cropOverlayFrame.style.transform = `translate(${cropX}px, ${cropY}px)`;
    const ratioVal = cropRatioSelect ? cropRatioSelect.value : '1:1';
    cropOverlayFrame.style.borderRadius = (ratioVal === '1:1') ? '50%' : '8px';
    syncCropInputs();
  }

  function applyRatioPreset(val) {
    let targetW = 200;
    let targetH = 200;
    if (val === '4:3') { targetW = 240; targetH = 180; }
    else if (val === '16:9') { targetW = 280; targetH = 158; }
    else if (val === '3:4') { targetW = 180; targetH = 240; }
    else if (val === '1:1' || val === '1:1-sq') { targetW = 200; targetH = 200; }
    else if (val === 'custom') { return; }

    cropW = Math.min(CROP_STAGE_SIZE, Math.max(20, targetW));
    cropH = Math.min(CROP_STAGE_SIZE, Math.max(20, targetH));
    cropX = Math.round((CROP_STAGE_SIZE - cropW) / 2);
    cropY = Math.round((CROP_STAGE_SIZE - cropH) / 2);
    updateOverlayFrameDOM();
  }

  function onManualCoordInput() {
    const rawX = parseFloat(cropInputX?.value);
    const rawY = parseFloat(cropInputY?.value);
    const rawW = parseFloat(cropInputW?.value);
    const rawH = parseFloat(cropInputH?.value);

    if (!isNaN(rawW) && rawW > 0) {
      cropW = Math.max(20, Math.min(CROP_STAGE_SIZE, Math.round(rawW)));
    }
    if (!isNaN(rawH) && rawH > 0) {
      cropH = Math.max(20, Math.min(CROP_STAGE_SIZE, Math.round(rawH)));
    }
    if (!isNaN(rawX)) {
      cropX = Math.max(0, Math.min(CROP_STAGE_SIZE - cropW, Math.round(rawX)));
    }
    if (!isNaN(rawY)) {
      cropY = Math.max(0, Math.min(CROP_STAGE_SIZE - cropH, Math.round(rawY)));
    }

    if (cropRatioSelect) {
      const r = cropRatioSelect.value;
      if (r === '1:1' || r === '1:1-sq') {
        if (cropW !== cropH) cropRatioSelect.value = 'custom';
      }
    }
    updateOverlayFrameDOM();
  }

  function refreshPhotoUI() {
    const cur = (ResumeState.get().customization || {}).photo || {};
    const img = document.getElementById('pf-photo-preview-img');
    const placeholder = document.getElementById('pf-photo-preview-placeholder');
    if (img && placeholder) {
      if (cur.url) {
        img.src = cur.url;
        img.style.display = '';
        placeholder.style.display = 'none';
      } else {
        img.style.display = 'none';
        placeholder.style.display = '';
      }
    }
    const dzUrl = document.getElementById('dz-photo-url');
    if (dzUrl) dzUrl.value = cur.url || '';
    const dzVis = document.getElementById('dz-photo-visible');
    if (dzVis) dzVis.checked = !!cur.visible;
  }

  function setPhoto(url) {
    ResumeState.updateCustomization('photo', 'url', url);
    ResumeState.updateCustomization('photo', 'visible', true);
    refreshPhotoUI();
  }

  async function removePhoto() {
    if (window.showConfirmModal) {
      const ok = await window.showConfirmModal({
        title: 'Confirm',
        message: 'Are you sure want to permanently delete this Photo?',
        confirmText: 'Yes, Delete!',
        cancelText: 'Cancel',
        danger: true,
      });
      if (!ok) return;
    }
    ResumeState.updateCustomization('photo', 'visible', false);
    ResumeState.updateCustomization('photo', 'url', null);
    refreshPhotoUI();
  }

  function openPhotoModal() {
    if (!photoModalEl) return;
    photoUrlInputEl.value = (ResumeState.get().customization || {}).photo?.url || '';
    if (photoFileInputEl) photoFileInputEl.value = '';
    photoModalEl.classList.remove('d-none');
    photoUrlInputEl?.focus();
  }

  function closePhotoModal() {
    photoModalEl?.classList.add('d-none');
  }

  function openCropModal(imageSrc) {
    if (!photoCropModalEl || !cropCanvas) {
      setPhoto(imageSrc);
      closePhotoModal();
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageObj = img;
      cropRotation = 0;
      cropScale = 1;
      cropPanX = 0;
      cropPanY = 0;
      cropW = 200;
      cropH = 200;
      cropX = Math.round((CROP_STAGE_SIZE - cropW) / 2);
      cropY = Math.round((CROP_STAGE_SIZE - cropH) / 2);
      if (cropZoomRange) cropZoomRange.value = '1';
      if (cropRatioSelect) {
        cropRatioSelect.value = '1:1';
      }
      updateOverlayFrameDOM();
      renderCropCanvas();
      closePhotoModal();
      photoCropModalEl.classList.remove('d-none');
    };
    img.onerror = () => {
      alert('Could not load image for cropping. Using original photo.');
      setPhoto(imageSrc);
      closePhotoModal();
    };
    img.src = imageSrc;
  }

  function renderCropCanvas() {
    if (!cropCanvas || !loadedImageObj) return;
    const ctx = cropCanvas.getContext('2d');
    cropCanvas.width = CROP_STAGE_SIZE;
    cropCanvas.height = CROP_STAGE_SIZE;

    ctx.clearRect(0, 0, CROP_STAGE_SIZE, CROP_STAGE_SIZE);
    ctx.save();
    ctx.translate(CROP_STAGE_SIZE / 2 + cropPanX, CROP_STAGE_SIZE / 2 + cropPanY);
    ctx.rotate((cropRotation * Math.PI) / 180);
    ctx.scale(cropScale, cropScale);

    const aspect = loadedImageObj.width / loadedImageObj.height;
    let drawW = CROP_STAGE_SIZE;
    let drawH = CROP_STAGE_SIZE;
    if (aspect > 1) {
      drawW = CROP_STAGE_SIZE * aspect;
      drawH = CROP_STAGE_SIZE;
    } else {
      drawW = CROP_STAGE_SIZE;
      drawH = CROP_STAGE_SIZE / aspect;
    }

    ctx.drawImage(loadedImageObj, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  if (photoCropModalEl && cropCanvas) {
    document.getElementById('close-crop-modal')?.addEventListener('click', () => photoCropModalEl.classList.add('d-none'));
    document.getElementById('cancel-crop-btn')?.addEventListener('click', () => {
      photoCropModalEl.classList.add('d-none');
      photoModalEl?.classList.remove('d-none');
    });

    // 2-way sync manual coordinate & dimension inputs
    [cropInputX, cropInputY, cropInputW, cropInputH].forEach((input) => {
      if (!input) return;
      input.addEventListener('input', onManualCoordInput);
      input.addEventListener('change', onManualCoordInput);
    });

    // Moveable Photo: Drag & Touch logic on Canvas
    cropCanvas.addEventListener('mousedown', (e) => {
      isDraggingCrop = true;
      dragStartX = e.clientX - cropPanX;
      dragStartY = e.clientY - cropPanY;
      cropCanvas.style.cursor = 'grabbing';
    });

    // Moveable Frame: Drag & Touch logic on Overlay Box
    cropOverlayFrame?.addEventListener('mousedown', (e) => {
      if (e.target && e.target.classList.contains('crop-resizer')) return;
      isDraggingFrame = true;
      frameDragStartX = e.clientX;
      frameDragStartY = e.clientY;
      frameInitialCropX = cropX;
      frameInitialCropY = cropY;
      e.stopPropagation();
    });

    // Resizers: Drag logic on handles
    cropOverlayFrame?.querySelectorAll('.crop-resizer').forEach((resizer) => {
      resizer.addEventListener('mousedown', (e) => {
        activeResizer = resizer.dataset.handle;
        resizerStartX = e.clientX;
        resizerStartY = e.clientY;
        resizerInitialCropX = cropX;
        resizerInitialCropY = cropY;
        resizerInitialCropW = cropW;
        resizerInitialCropH = cropH;
        e.stopPropagation();
      });
    });

    window.addEventListener('mousemove', (e) => {
      if (activeResizer) {
        const dx = e.clientX - resizerStartX;
        const dy = e.clientY - resizerStartY;
        if (activeResizer === 'se') {
          cropW = Math.max(20, Math.min(CROP_STAGE_SIZE - resizerInitialCropX, resizerInitialCropW + dx));
          cropH = Math.max(20, Math.min(CROP_STAGE_SIZE - resizerInitialCropY, resizerInitialCropH + dy));
        } else if (activeResizer === 'sw') {
          const newW = Math.max(20, Math.min(resizerInitialCropX + resizerInitialCropW, resizerInitialCropW - dx));
          cropX = resizerInitialCropX + (resizerInitialCropW - newW);
          cropW = newW;
          cropH = Math.max(20, Math.min(CROP_STAGE_SIZE - resizerInitialCropY, resizerInitialCropH + dy));
        } else if (activeResizer === 'ne') {
          const newH = Math.max(20, Math.min(resizerInitialCropY + resizerInitialCropH, resizerInitialCropH - dy));
          cropY = resizerInitialCropY + (resizerInitialCropH - newH);
          cropH = newH;
          cropW = Math.max(20, Math.min(CROP_STAGE_SIZE - resizerInitialCropX, resizerInitialCropW + dx));
        } else if (activeResizer === 'nw') {
          const newW = Math.max(20, Math.min(resizerInitialCropX + resizerInitialCropW, resizerInitialCropW - dx));
          const newH = Math.max(20, Math.min(resizerInitialCropY + resizerInitialCropH, resizerInitialCropH - dy));
          cropX = resizerInitialCropX + (resizerInitialCropW - newW);
          cropY = resizerInitialCropY + (resizerInitialCropH - newH);
          cropW = newW;
          cropH = newH;
        }
        if (cropRatioSelect && cropRatioSelect.value !== 'custom') {
          cropRatioSelect.value = 'custom';
        }
        updateOverlayFrameDOM();
        return;
      }

      if (isDraggingFrame) {
        const dx = e.clientX - frameDragStartX;
        const dy = e.clientY - frameDragStartY;
        cropX = Math.max(0, Math.min(CROP_STAGE_SIZE - cropW, Math.round(frameInitialCropX + dx)));
        cropY = Math.max(0, Math.min(CROP_STAGE_SIZE - cropH, Math.round(frameInitialCropY + dy)));
        updateOverlayFrameDOM();
        return;
      }

      if (!isDraggingCrop) return;
      cropPanX = e.clientX - dragStartX;
      cropPanY = e.clientY - dragStartY;
      renderCropCanvas();
    });

    window.addEventListener('mouseup', () => {
      activeResizer = null;
      if (isDraggingFrame) {
        isDraggingFrame = false;
      }
      if (isDraggingCrop) {
        isDraggingCrop = false;
        cropCanvas.style.cursor = 'grab';
      }
    });

    // Touch events for mobile
    cropCanvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDraggingCrop = true;
        dragStartX = e.touches[0].clientX - cropPanX;
        dragStartY = e.touches[0].clientY - cropPanY;
      }
    });

    cropOverlayFrame?.addEventListener('touchstart', (e) => {
      if (e.target && e.target.classList.contains('crop-resizer')) return;
      if (e.touches.length === 1) {
        isDraggingFrame = true;
        frameDragStartX = e.touches[0].clientX;
        frameDragStartY = e.touches[0].clientY;
        frameInitialCropX = cropX;
        frameInitialCropY = cropY;
        e.stopPropagation();
      }
    });

    cropOverlayFrame?.querySelectorAll('.crop-resizer').forEach((resizer) => {
      resizer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          activeResizer = resizer.dataset.handle;
          resizerStartX = e.touches[0].clientX;
          resizerStartY = e.touches[0].clientY;
          resizerInitialCropX = cropX;
          resizerInitialCropY = cropY;
          resizerInitialCropW = cropW;
          resizerInitialCropH = cropH;
          e.stopPropagation();
        }
      });
    });

    window.addEventListener('touchmove', (e) => {
      if (activeResizer && e.touches.length === 1) {
        const dx = e.touches[0].clientX - resizerStartX;
        const dy = e.touches[0].clientY - resizerStartY;
        if (activeResizer === 'se') {
          cropW = Math.max(20, Math.min(CROP_STAGE_SIZE - resizerInitialCropX, resizerInitialCropW + dx));
          cropH = Math.max(20, Math.min(CROP_STAGE_SIZE - resizerInitialCropY, resizerInitialCropH + dy));
        } else if (activeResizer === 'sw') {
          const newW = Math.max(20, Math.min(resizerInitialCropX + resizerInitialCropW, resizerInitialCropW - dx));
          cropX = resizerInitialCropX + (resizerInitialCropW - newW);
          cropW = newW;
          cropH = Math.max(20, Math.min(CROP_STAGE_SIZE - resizerInitialCropY, resizerInitialCropH + dy));
        } else if (activeResizer === 'ne') {
          const newH = Math.max(20, Math.min(resizerInitialCropY + resizerInitialCropH, resizerInitialCropH - dy));
          cropY = resizerInitialCropY + (resizerInitialCropH - newH);
          cropH = newH;
          cropW = Math.max(20, Math.min(CROP_STAGE_SIZE - resizerInitialCropX, resizerInitialCropW + dx));
        } else if (activeResizer === 'nw') {
          const newW = Math.max(20, Math.min(resizerInitialCropX + resizerInitialCropW, resizerInitialCropW - dx));
          const newH = Math.max(20, Math.min(resizerInitialCropY + resizerInitialCropH, resizerInitialCropH - dy));
          cropX = resizerInitialCropX + (resizerInitialCropW - newW);
          cropY = resizerInitialCropY + (resizerInitialCropH - newH);
          cropW = newW;
          cropH = newH;
        }
        if (cropRatioSelect && cropRatioSelect.value !== 'custom') {
          cropRatioSelect.value = 'custom';
        }
        updateOverlayFrameDOM();
        return;
      }

      if (isDraggingFrame && e.touches.length === 1) {
        const dx = e.touches[0].clientX - frameDragStartX;
        const dy = e.touches[0].clientY - frameDragStartY;
        cropX = Math.max(0, Math.min(CROP_STAGE_SIZE - cropW, Math.round(frameInitialCropX + dx)));
        cropY = Math.max(0, Math.min(CROP_STAGE_SIZE - cropH, Math.round(frameInitialCropY + dy)));
        updateOverlayFrameDOM();
        return;
      }

      if (!isDraggingCrop || e.touches.length !== 1) return;
      cropPanX = e.touches[0].clientX - dragStartX;
      cropPanY = e.touches[0].clientY - dragStartY;
      renderCropCanvas();
    });

    window.addEventListener('touchend', () => {
      activeResizer = null;
      isDraggingFrame = false;
      isDraggingCrop = false;
    });

    // Wheel zoom on canvas
    cropCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      cropScale = Math.max(0.4, Math.min(4.0, cropScale + delta));
      if (cropZoomRange) cropZoomRange.value = cropScale.toFixed(1);
      renderCropCanvas();
    }, { passive: false });

    cropRatioSelect?.addEventListener('change', (e) => {
      applyRatioPreset(e.target.value);
    });

    document.getElementById('crop-rotate-left-btn')?.addEventListener('click', () => {
      cropRotation = (cropRotation - 90) % 360;
      renderCropCanvas();
    });

    document.getElementById('crop-rotate-right-btn')?.addEventListener('click', () => {
      cropRotation = (cropRotation + 90) % 360;
      renderCropCanvas();
    });

    cropZoomRange?.addEventListener('input', (e) => {
      cropScale = parseFloat(e.target.value) || 1;
      renderCropCanvas();
    });

    document.getElementById('apply-crop-btn')?.addEventListener('click', () => {
      if (!cropCanvas) return;
      const ratioVal = cropRatioSelect ? cropRatioSelect.value : '1:1';

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = cropW;
      exportCanvas.height = cropH;
      const expCtx = exportCanvas.getContext('2d');

      const srcX = Math.max(0, Math.min(CROP_STAGE_SIZE - cropW, cropX));
      const srcY = Math.max(0, Math.min(CROP_STAGE_SIZE - cropH, cropY));

      if (ratioVal === '1:1') {
        expCtx.save();
        expCtx.beginPath();
        expCtx.arc(cropW / 2, cropH / 2, Math.min(cropW, cropH) / 2, 0, Math.PI * 2);
        expCtx.clip();
        expCtx.drawImage(cropCanvas, srcX, srcY, cropW, cropH, 0, 0, cropW, cropH);
        expCtx.restore();
        ResumeState.updateCustomization('photo', 'shape', 'circle');
      } else {
        expCtx.drawImage(cropCanvas, srcX, srcY, cropW, cropH, 0, 0, cropW, cropH);
        if (ratioVal === '1:1-sq') {
          ResumeState.updateCustomization('photo', 'shape', 'square');
        }
      }

      const croppedDataUrl = exportCanvas.toDataURL('image/png');
      setPhoto(croppedDataUrl);
      photoCropModalEl.classList.add('d-none');
    });
  }

  if (photoModalEl) {
    document.getElementById('close-photo-modal')?.addEventListener('click', closePhotoModal);
    document.getElementById('cancel-photo-btn')?.addEventListener('click', closePhotoModal);
    photoModalEl.addEventListener('click', (e) => { if (e.target === photoModalEl) closePhotoModal(); });

    // Merged photo button (URL or local file -> opens crop/rotate sub-window)
    const confirmBtn = document.getElementById('confirm-photo-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const file = photoFileInputEl?.files && photoFileInputEl.files[0];
        const url = photoUrlInputEl?.value.trim();

        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            openCropModal(e.target.result);
          };
          reader.readAsDataURL(file);
        } else if (url) {
          if (!/^(https?:)?\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('data:')) {
            alert("That doesn't look like a valid URL. Include http(s)://.");
            return;
          }
          openCropModal(url);
        } else {
          alert('Please select an image file or enter a photo URL.');
        }
      });
    }
  }

  // ---- Bootstrap: local draft first (so the page has something to show
  // immediately), then — if signed in — sync mode switches to the server and,
  // if a specific resume id is in the URL (e.g. /builder?id=... from the
  // dashboard's Edit/Customize links), that resume is fetched and replaces
  // the draft. See boot() at the bottom of this file for the async part.
  //
  // Bare /builder (no ?id=) means "start a new resume" (e.g. the dashboard's
  // "+ New resume" button) — so the cached local draft's `id` is stripped to
  // avoid silently overwriting whatever resume was last edited on this
  // device. The draft's content is still kept as a convenience starting
  // point in case the browser was closed mid-edit before it ever got an id.
  const bootParams = new URLSearchParams(window.location.search);
  const saved = ResumeStorage.loadLocal();
  if (saved) {
    if (!bootParams.get('id') && saved.id) saved.id = null;
    ResumeState.replace(saved);
  }

  function updateAutosaveStatus(state, timeStr = '') {
    if (!els.autosaveStatus) return;
    const formattedTime = timeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (state === 'saving') {
      els.autosaveStatus.innerHTML = `<span class="autosave-icon saving">⏳</span> <span class="autosave-text">Saving…</span>`;
      els.autosaveStatus.title = 'Saving changes...';
    } else if (state === 'saved') {
      els.autosaveStatus.innerHTML = `<span class="autosave-icon saved">✓</span> <span class="autosave-text">Saved</span> <span class="autosave-time text-muted" style="font-size:10px;">${formattedTime}</span>`;
      els.autosaveStatus.title = `Saved at ${formattedTime}`;
    } else if (state === 'error') {
      els.autosaveStatus.innerHTML = `<span class="autosave-icon error">✕</span> <span class="autosave-text">Error</span>`;
      els.autosaveStatus.title = 'Autosave failed - saved locally';
    }
  }

  updateAutosaveStatus('saved');

  ResumeState.subscribe((resume) => {
    renderPreview(resume);
    renderValidationAndProgress();
    updateAutosaveStatus('saving');
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ResumeStorage.autosave(resume, {
      token: (typeof Auth !== 'undefined' && Auth.isLoggedIn()) ? Auth.getToken() : null,
      onSaved: () => updateAutosaveStatus('saved', timeStr),
      onError: () => updateAutosaveStatus('error'),
    });
  });

  const touchedSections = new Set();

  // ---- Progress & Validation rendering -------------------------------------
  function renderValidationAndProgress() {
    const val = ResumeState.getValidation();

    // Overall progress bar
    if (els.overallProgressBar && els.overallProgressText) {
      els.overallProgressBar.style.width = `${val.overallPercentage}%`;
      els.overallProgressText.textContent = `${val.overallPercentage}%`;
      els.overallProgressBar.style.background =
        val.overallPercentage > 80 ? 'var(--emerald)' : val.overallPercentage > 40 ? 'var(--amber)' : 'var(--signal)';
    }

    // Section list badge updates
    if (els.sectionList) {
      [...els.sectionList.querySelectorAll('.section-list-item')].forEach((li) => {
        const secId = li.dataset.section;
        const badge = li.querySelector('.sec-progress-badge');
        if (badge) {
          const prog = val.sectionProgress[secId] || 0;
          badge.textContent = `${prog}%`;
          badge.className = `sec-progress-badge ${prog === 100 ? 'is-complete' : prog > 0 ? 'is-in-progress' : ''}`;
        }
      });
    }

    // Validation alerts banner on center form
    const alertBox = els.form ? els.form.querySelector('.validation-alert') : document.getElementById('validation-alerts');
    if (alertBox) {
      const activeErrors = Object.entries(val.errors).filter(([key]) => key.startsWith(activeSection) || key === activeSection);
      const activeWarns = Object.entries(val.warnings).filter(([key]) => key.startsWith(activeSection) || key === activeSection);
      const isTouched = touchedSections.has(activeSection);

      if (isTouched && activeErrors.length > 0) {
        alertBox.style.display = 'block';
        alertBox.className = 'validation-alert alert-error';
        alertBox.innerHTML = `<strong>⚠️ Attention needed:</strong> ${activeErrors.map(([, msg]) => msg).join('; ')}`;
      } else if (isTouched && activeWarns.length > 0) {
        alertBox.style.display = 'block';
        alertBox.className = 'validation-alert alert-warning';
        alertBox.innerHTML = `<strong>💡 Tip:</strong> ${activeWarns.map(([, msg]) => msg).join('; ')}`;
      } else {
        alertBox.style.display = 'none';
      }
    }
  }

  function getSectionTitle(secId) {
    const resume = ResumeState.get();
    if (resume.sectionTitles && resume.sectionTitles[secId]) {
      return resume.sectionTitles[secId];
    }
    if (resume[secId] && typeof resume[secId] === 'object' && resume[secId].title) {
      return resume[secId].title;
    }
    return SECTION_LABELS[secId] || secId.replace(/^custom_section_?/, 'Custom Section ').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  function applyTextFormat(textarea, prefix, suffix = '') {
    if (!textarea) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const val = textarea.value;
    const selected = val.substring(start, end);
    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${suffix}`;
    textarea.value = val.substring(0, start) + replacement + val.substring(end);
    textarea.focus();
    const newPos = selected ? start + replacement.length : start + prefix.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---- Section navigator ---------------------------------------------------
  function startEditingSectionTitle(titleContainer) {
    if (!titleContainer) return;
    const labelEl = titleContainer.querySelector('.sec-label');
    const inputEl = titleContainer.querySelector('.sec-label-input');
    if (!labelEl || !inputEl) return;
    labelEl.style.display = 'none';
    inputEl.style.display = 'inline-block';
    inputEl.value = labelEl.textContent.trim();
    inputEl.focus();
    inputEl.select();
  }

  function commitSectionTitle(inputEl) {
    const container = inputEl.closest('.sec-title-container');
    if (!container) return;
    const secId = container.dataset.section;
    const labelEl = container.querySelector('.sec-label');
    const newTitle = inputEl.value.trim();
    if (newTitle) {
      ResumeState.setSectionTitle(secId, newTitle);
    } else {
      ResumeState.revertSectionTitle(secId);
    }
    const displayTitle = getSectionTitle(secId);
    if (labelEl) {
      labelEl.textContent = displayTitle;
      labelEl.style.display = '';
    }
    inputEl.style.display = 'none';
  }

  function cancelSectionTitleEdit(inputEl) {
    const container = inputEl.closest('.sec-title-container');
    if (!container) return;
    const labelEl = container.querySelector('.sec-label');
    if (labelEl) {
      labelEl.style.display = '';
      inputEl.value = labelEl.textContent.trim();
    }
    inputEl.style.display = 'none';
  }

  function renderSectionList() {
    const resume = ResumeState.get();
    const val = ResumeState.getValidation();

    const personalProg = val.sectionProgress.personal ?? computePersonalProgress(resume);
    const isPersonalActive = activeSections.includes('personal');
    const personalTitle = getSectionTitle('personal');
    const personalItemHtml = `
      <li class="section-list-item accordion-item ${isPersonalActive ? 'is-active is-expanded' : ''}" data-section="personal">
        <div class="accordion-header">
          <span class="drag-handle drag-handle-placeholder" aria-hidden="true">${DRAG_GRIP_SVG}</span>
          <div class="sec-title-container" data-section="personal">
            <span class="sec-label" title="Double-click or click edit to rename">${personalTitle}</span>
            <input type="text" class="sec-label-input form-input" value="${personalTitle}" style="display:none;" />
            <div class="sec-title-actions">
              <button type="button" class="sec-action-btn edit-title-btn" title="Edit heading" aria-label="Edit heading">${PENCIL_SVG}</button>
              <button type="button" class="sec-action-btn revert-title-btn" title="Revert to default heading" aria-label="Revert heading">${REVERT_SVG}</button>
            </div>
          </div>
          <span class="sec-progress-badge ${personalProg === 100 ? 'is-complete' : personalProg > 0 ? 'is-in-progress' : ''}">${personalProg}%</span>
          <span class="accordion-chevron ${isPersonalActive ? 'is-open' : ''}">${CHEVRON_SVG}</span>
        </div>
        ${isPersonalActive ? '<div class="accordion-body-slot" id="accordion-body-slot-personal"></div>' : ''}
      </li>`;

    const sectionItemsHtml = resume.sectionOrder
      .map((id) => {
        const prog = val.sectionProgress[id] || (resume[id] ? 100 : 0);
        const isHidden = resume.hiddenSections.includes(id);
        const isActive = activeSections.includes(id);
        const label = getSectionTitle(id);
        const isOptional = !CORE_SECTIONS.includes(id);
        const entries = getSectionEntries(resume, id);
        const hasSubEntries = entries.length > 0;
        const allExpanded = hasSubEntries && entries.every((e) => expandedCards.has(e.id));

        return `
      <li class="section-list-item accordion-item ${isActive ? 'is-active is-expanded' : ''} ${isHidden ? 'is-hidden-section' : ''}" data-section="${id}">
        <div class="accordion-header">
          <span class="drag-handle" draggable="true" title="Drag to reorder">${DRAG_GRIP_SVG}</span>
          <div class="sec-title-container" data-section="${id}">
            <span class="sec-label" title="Double-click or click edit to rename">${label}</span>
            <input type="text" class="sec-label-input form-input" value="${label}" style="display:none;" />
            <div class="sec-title-actions">
              <button type="button" class="sec-action-btn edit-title-btn" title="Edit heading" aria-label="Edit heading">${PENCIL_SVG}</button>
              <button type="button" class="sec-action-btn revert-title-btn" title="Revert to default heading" aria-label="Revert heading">${REVERT_SVG}</button>
              ${isOptional ? `<button type="button" class="sec-action-btn delete-section-btn" data-section="${id}" title="Delete section" aria-label="Delete section">${TRASH_SVG}</button>` : ''}
            </div>
          </div>
          ${hasSubEntries && isActive ? `
            <button type="button" class="btn-toggle-all-subentries" data-section="${id}" title="${allExpanded ? 'Collapse all' : 'Open all'} ${label}">
              ${allExpanded ? `Collapse all ${label} ▴` : `Open all ${label} ▾`}
            </button>
          ` : ''}
          <span class="sec-progress-badge ${prog === 100 ? 'is-complete' : prog > 0 ? 'is-in-progress' : ''}">${prog}%</span>
          <button class="icon-btn toggle-visible" data-section="${id}" title="${isHidden ? 'Show section' : 'Hide section'}">
            ${isHidden ? '🙈' : '👁'}
          </button>
          <span class="accordion-chevron ${isActive ? 'is-open' : ''}">${CHEVRON_SVG}</span>
        </div>
        ${isActive ? `<div class="accordion-body-slot" id="accordion-body-slot-${id}"></div>` : ''}
      </li>`;
      })
      .join('');

    els.sectionList.innerHTML = personalItemHtml + sectionItemsHtml;

    updateCompletenessMeter(val.overallPercentage);
    renderAddSectionGrid();
  }

  function renderAddSectionGrid() {
    const gridEl = document.getElementById('add-section-grid');
    if (!gridEl) return;
    const resume = ResumeState.get();
    const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const isProOrAdmin = user && (user.role === 'admin' || user.plan === 'pro' || user.plan === 'admin');

    const html = ADD_SECTION_OPTIONS.map((opt) => {
      const isSingleUse = opt.id !== 'custom_section';
      const isAdded = isSingleUse && resume.sectionOrder.includes(opt.id) && !resume.hiddenSections.includes(opt.id);
      const isLocked = opt.locked && !isProOrAdmin;
      const isDisabled = isAdded;
      return `
        <button type="button" class="add-sec-card-btn ${isAdded ? 'is-added is-disabled' : ''} ${isLocked ? 'is-locked' : ''}" data-sec="${opt.id}" ${isDisabled ? 'disabled="disabled"' : ''} title="${isAdded ? 'Already added' : opt.label}">
          <span class="add-sec-card-left">
            <span class="add-sec-card-icon">${isAdded ? '✓' : opt.icon}</span>
            <span class="add-sec-card-label">${opt.label}</span>
          </span>
          ${isLocked ? `<span class="add-sec-card-lock" title="Pro Feature">🔒</span>` : ''}
        </button>
      `;
    }).join('');

    gridEl.innerHTML = html;
  }

  /** Fallback if getValidation() doesn't report a "personal" sectionProgress
   * entry — computes a simple percentage from the required contact fields. */
  function computePersonalProgress(resume) {
    const p = resume.personal || {};
    const required = ['fullName', 'email', 'phone', 'location'];
    const filled = required.filter((f) => (p[f] || '').trim()).length;
    return Math.round((filled / required.length) * 100);
  }

  function updateCompletenessMeter(percentage) {
    const pct = Math.round(percentage || 0);
    const badge = document.getElementById('completeness-badge');
    const fill = document.getElementById('completeness-bar-fill');
    if (badge) badge.textContent = pct + '%';
    if (fill) fill.style.width = pct + '%';
  }

  els.sectionList.addEventListener('click', async (e) => {
    // 1. Edit heading title button
    const editBtn = e.target.closest('.edit-title-btn');
    if (editBtn) {
      e.stopPropagation();
      const container = editBtn.closest('.sec-title-container');
      startEditingSectionTitle(container);
      return;
    }

    // 2. Revert heading title button
    const revertBtn = e.target.closest('.revert-title-btn');
    if (revertBtn) {
      e.stopPropagation();
      const container = revertBtn.closest('.sec-title-container');
      const secId = container?.dataset.section;
      if (secId) {
        ResumeState.revertSectionTitle(secId);
        const labelEl = container.querySelector('.sec-label');
        const inputEl = container.querySelector('.sec-label-input');
        const defaultTitle = getSectionTitle(secId);
        if (labelEl) labelEl.textContent = defaultTitle;
        if (inputEl) inputEl.value = defaultTitle;
      }
      return;
    }

    // 3. Delete section button
    const deleteSecBtn = e.target.closest('.delete-section-btn');
    if (deleteSecBtn) {
      e.stopPropagation();
      const sec = deleteSecBtn.dataset.section;
      const secTitle = getSectionTitle(sec);
      const confirmed = window.showConfirmModal
        ? await window.showConfirmModal({
            title: 'Confirm',
            message: `Are you sure want to permanently delete this "${secTitle}" section?`,
            confirmText: 'Yes, Delete!',
            cancelText: 'Cancel',
            danger: true,
          })
        : confirm(`Are you sure want to permanently delete this "${secTitle}" section?`);
      if (!confirmed) return;
      activeSections = activeSections.filter((s) => s !== sec);
      ResumeState.removeSection(sec);
      renderSectionList();
      renderForm();
      return;
    }

    // 4. Toggle visibility
    const toggleBtn = e.target.closest('.toggle-visible');
    if (toggleBtn) {
      e.stopPropagation();
      ResumeState.toggleSectionVisibility(toggleBtn.dataset.section);
      renderSectionList();
      renderForm();
      return;
    }

    // 4b. Toggle all subentries in section
    const toggleAllBtn = e.target.closest('.btn-toggle-all-subentries');
    if (toggleAllBtn) {
      e.stopPropagation();
      const sec = toggleAllBtn.dataset.section;
      const entries = getSectionEntries(ResumeState.get(), sec);
      const allExp = entries.length > 0 && entries.every((item) => expandedCards.has(item.id));
      if (allExp) {
        entries.forEach((item) => expandedCards.delete(item.id));
      } else {
        entries.forEach((item) => expandedCards.add(item.id));
      }
      renderSectionList();
      renderForm();
      return;
    }

    // 5. Ignore clicks inside input or title actions or drag handle
    if (e.target.closest('.sec-label-input') || e.target.closest('.sec-title-actions') || e.target.closest('.drag-handle')) {
      return;
    }

    // 6. Accordion header toggle
    const header = e.target.closest('.accordion-header');
    if (header) {
      const item = header.closest('.section-list-item');
      const clickedSection = item.dataset.section;
      if (activeSections.includes(clickedSection)) {
        activeSections = activeSections.filter(s => s !== clickedSection); // Toggle closed if already open
        const entries = getSectionEntries(ResumeState.get(), clickedSection);
        entries.forEach((item) => expandedCards.delete(item.id));
      } else {
        activeSections.push(clickedSection); // Multiple open sections allowed
        const entries = getSectionEntries(ResumeState.get(), clickedSection);
        entries.forEach((item) => expandedCards.delete(item.id));
      }
      renderSectionList();
      renderForm();
    }
  });

  // Double click on heading label to start inline edit
  els.sectionList.addEventListener('dblclick', (e) => {
    const label = e.target.closest('.sec-label');
    if (label) {
      e.stopPropagation();
      const container = label.closest('.sec-title-container');
      startEditingSectionTitle(container);
    }
  });

  // Keydown / focusout on section title input
  els.sectionList.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('sec-label-input')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commitSectionTitle(e.target);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelSectionTitleEdit(e.target);
      }
    }
  });

  els.sectionList.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('sec-label-input')) {
      commitSectionTitle(e.target);
    }
  });

  // Add optional section grid / button handling
  const addGridEl = document.getElementById('add-section-grid');
  if (addGridEl) {
    addGridEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.add-sec-card-btn');
      if (!btn || btn.disabled || btn.classList.contains('is-disabled')) return;
      const sec = btn.dataset.sec;
      const opt = ADD_SECTION_OPTIONS.find((o) => o.id === sec);
      const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
      const isProOrAdmin = user && (user.role === 'admin' || user.plan === 'pro' || user.plan === 'admin');

      if (opt && opt.locked && !isProOrAdmin) {
        alert('This section is a Pro feature. Please upgrade your plan to unlock it.');
        return;
      }

      if (sec === 'custom_section') {
        const newSecId = ResumeState.addCustomSection('Untitled');
        if (!activeSections.includes(newSecId)) {
          activeSections.push(newSecId);
        }
        renderSectionList();
        renderForm();
        const itemEl = document.querySelector(`.section-list-item[data-section="${newSecId}"]`);
        if (itemEl) {
          itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return;
      }

      const resume = ResumeState.get();
      if (!resume.sectionOrder.includes(sec)) {
        resume.sectionOrder.push(sec);
      }
      if (resume.hiddenSections.includes(sec)) {
        ResumeState.toggleSectionVisibility(sec);
      }
      if (!activeSections.includes(sec)) {
        activeSections.push(sec);
      }
      renderSectionList();
      renderForm();

      const itemEl = document.querySelector(`.section-list-item[data-section="${sec}"]`);
      if (itemEl) {
        itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // Legacy fallback for any add-opt-sec-btn
  document.querySelectorAll('.add-opt-sec-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sec = btn.dataset.sec;
      const resume = ResumeState.get();
      if (!resume.sectionOrder.includes(sec)) {
        resume.sectionOrder.push(sec);
      }
      if (resume.hiddenSections.includes(sec)) {
        ResumeState.toggleSectionVisibility(sec);
      }
      if (!activeSections.includes(sec)) {
        activeSections.push(sec);
      }
      renderSectionList();
      renderForm();
    });
  });

  // Drag & drop section reordering
  let dragSrc = null;
  els.sectionList.addEventListener('dragstart', (e) => {
    dragSrc = e.target.closest('.section-list-item');
    if (dragSrc) dragSrc.classList.add('dragging');
  });
  els.sectionList.addEventListener('dragend', () => dragSrc && dragSrc.classList.remove('dragging'));
  els.sectionList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.section-list-item');
    if (!target || target === dragSrc) return;
    const rect = target.getBoundingClientRect();
    const before = e.clientY - rect.top < rect.height / 2;
    target.parentNode.insertBefore(dragSrc, before ? target : target.nextSibling);
  });
  els.sectionList.addEventListener('drop', () => {
    // "Personal Details" isn't draggable and isn't part of resume.sectionOrder
    // (it's always rendered at the top of the document, outside the
    // reorderable section list) — exclude it if it's somehow in this list.
    const newOrder = [...els.sectionList.querySelectorAll('.section-list-item')]
      .map((li) => li.dataset.section)
      .filter((id) => id !== 'personal');
    ResumeState.reorderSections(newOrder);
  });

  // ---- Section form renderer (renders inline inside each active accordion slot) ------
  function renderForm() {
    activeSections.forEach((secId) => {
      const slot = document.getElementById(`accordion-body-slot-${secId}`);
      if (!slot) return;

      let formEl = slot.querySelector('.builder-form');
      if (!formEl) {
        formEl = document.createElement('section');
        formEl.className = 'builder-form';
        formEl.setAttribute('aria-label', `Edit ${secId} content`);
        slot.appendChild(formEl);
      }

      els.form = formEl;
      activeSection = secId;

      if (!formEl.dataset.touchBound) {
        formEl.dataset.touchBound = 'true';
        formEl.addEventListener('input', () => {
          touchedSections.add(secId);
          renderValidationAndProgress();
        });
        formEl.addEventListener('blur', () => {
          touchedSections.add(secId);
          renderValidationAndProgress();
        }, true);
      }

      renderSingleForm(secId);
    });
  }

  function renderSingleForm(secId) {
    const resume = ResumeState.get();
    els.form.innerHTML = `
      <div class="form-header-wrap">
        <p class="form-hint text-muted">${SECTION_DESCRIPTIONS[secId] || ''}</p>
      </div>
      <div class="validation-alert" style="display:none"></div>`;

    const renderers = {
      summary: renderSummaryForm,
      experience: renderExperienceForm,
      education: renderEducationForm,
      skills: renderSkillsForm,
      projects: renderProjectsForm,
      certifications: renderCertificationsForm,
      languages: renderLanguagesForm,
    };

    if (secId === 'personal') {
      renderPersonalFields();
      return;
    }
    if (secId.startsWith('custom_') || secId === 'custom_section') {
      renderCustomSectionForm(secId, resume);
      return;
    }
    if (renderers[secId]) {
      renderers[secId](resume);
    } else {
      renderGenericSectionForm(secId, resume);
    }
    renderValidationAndProgress();
  }

  let isMoreDetailsOpen = false;

  function renderPersonalFields() {
    const p = ResumeState.get().personal || {};
    const wrap = document.createElement('div');
    wrap.className = 'form-block pf-redesign-wrap';

    const hasExtraDetails = !!(p.website || p.github || p.address || p.dob || p.nationality || p.drivingLicense);
    if (hasExtraDetails) isMoreDetailsOpen = true;

    wrap.innerHTML = `
      <div class="pf-top-row">
        <div class="pf-job-target-col">
          <div class="pf-label-with-badge">
            <span>Job Target</span>
            <span class="badge-job-target-score" title="Target role match strength">+0%</span>
          </div>
          <div class="field-with-ai" style="width: 100%;">
            <input id="pf-title" class="form-input" list="job-roles-list" value="${p.title || ''}" placeholder="The role you want">
            <datalist id="job-roles-list">
              <option value="Senior Software Engineer">
              <option value="Full Stack Developer">
              <option value="Frontend Engineer">
              <option value="Backend Engineer">
              <option value="DevOps &amp; Cloud Infrastructure Engineer">
              <option value="Data Scientist / AI Engineer">
              <option value="Product Manager">
              <option value="Project Manager">
              <option value="Scrum Master">
              <option value="UI/UX Designer">
              <option value="Graphic Designer">
              <option value="Business Analyst">
              <option value="Digital Marketing Specialist">
              <option value="Content Strategist">
              <option value="SEO Specialist">
              <option value="Financial Analyst">
              <option value="Accountant">
              <option value="Human Resources Manager">
              <option value="Talent Acquisition Specialist">
              <option value="Sales &amp; Business Development Manager">
              <option value="Account Executive">
              <option value="Customer Success Manager">
              <option value="Operations Manager">
              <option value="Executive Assistant">
              <option value="Legal Counsel">
              <option value="Healthcare Administrator">
              <option value="Research Scientist">
            </datalist>
            <button class="icon-btn enhance-btn" id="enhance-title-btn" type="button" title="Clean up with AI">✦</button>
          </div>
        </div>

        <div class="pf-photo-card">
          <div class="pf-photo-thumb" id="pf-photo-preview-wrap">
            <img id="pf-photo-preview-img" src="" alt="" style="display:none">
            <span id="pf-photo-preview-placeholder" class="photo-preview-placeholder">👤</span>
          </div>
          <div class="pf-photo-actions">
            <button type="button" class="pf-photo-link-btn edit" id="pf-photo-add-btn">✎ Edit photo</button>
            <button type="button" class="pf-photo-link-btn delete" id="pf-photo-remove-btn">🗑 Delete</button>
          </div>
        </div>
      </div>

      <div class="pf-two-col-grid">
        <div class="pf-field-wrap">
          <label for="pf-firstName">First Name *</label>
          <input id="pf-firstName" class="form-input" value="${p.firstName || ''}" placeholder="e.g. Alex">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-lastName">Last Name</label>
          <input id="pf-lastName" class="form-input" value="${p.lastName || ''}" placeholder="e.g. Morgan">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-email">Email Address *</label>
          <input id="pf-email" type="email" class="form-input" value="${p.email || ''}" placeholder="alex@example.com">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-phone">Phone Number</label>
          <input id="pf-phone" class="form-input" value="${p.phone || ''}" placeholder="+1 (555) 019-2834">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-linkedin">LinkedIn Profile URL</label>
          <input id="pf-linkedin" class="form-input" value="${p.linkedin || ''}" placeholder="linkedin.com/in/alexmorgan">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-postalCode">Postal Code</label>
          <input id="pf-postalCode" class="form-input" value="${p.postalCode || ''}" placeholder="e.g. 94105">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-city">City / State</label>
          <input id="pf-city" class="form-input" value="${p.city || ''}" placeholder="San Francisco, CA">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-country">Country</label>
          <input id="pf-country" class="form-input" value="${p.country || ''}" placeholder="e.g. United States">
          <span class="pf-helper-text">For users outside the US</span>
        </div>
      </div>

      <div>
        <button type="button" class="pf-toggle-more-btn ${isMoreDetailsOpen ? 'is-open' : ''}" id="pf-toggle-more-btn">
          <span class="pf-toggle-icon">∨</span>
          <span id="pf-toggle-more-text">${isMoreDetailsOpen ? 'Hide additional details' : 'Add more details'}</span>
        </button>
      </div>

      <div class="pf-more-details-panel ${isMoreDetailsOpen ? 'is-open' : ''}" id="pf-more-details-panel">
        <div class="pf-field-wrap">
          <label for="pf-website">Portfolio / Website</label>
          <input id="pf-website" class="form-input" value="${p.website || ''}" placeholder="alexmorgan.dev">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-github">GitHub Profile URL</label>
          <input id="pf-github" class="form-input" value="${p.github || ''}" placeholder="github.com/username">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-address">Street Address</label>
          <input id="pf-address" class="form-input" value="${p.address || ''}" placeholder="e.g. 123 Market St, Suite 400">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-dob">Date of Birth</label>
          <input id="pf-dob" class="form-input" value="${p.dob || ''}" placeholder="e.g. Oct 14, 1995">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-nationality">Nationality</label>
          <input id="pf-nationality" class="form-input" value="${p.nationality || ''}" placeholder="e.g. American">
        </div>
        <div class="pf-field-wrap">
          <label for="pf-drivingLicense">Driving License</label>
          <input id="pf-drivingLicense" class="form-input" value="${p.drivingLicense || ''}" placeholder="e.g. Full / Clean">
        </div>
      </div>
    `;
    els.form.appendChild(wrap);

    // Synchronize first/last name with fullName
    const fnInput = document.getElementById('pf-firstName');
    const lnInput = document.getElementById('pf-lastName');
    const syncFullName = () => {
      const curP = ResumeState.get().personal || {};
      const f = fnInput ? fnInput.value.trim() : (curP.firstName || '');
      const l = lnInput ? lnInput.value.trim() : (curP.lastName || '');
      const combined = [f, l].filter(Boolean).join(' ');
      ResumeState.update('personal.fullName', combined);
    };

    if (fnInput) {
      fnInput.addEventListener('input', (e) => {
        ResumeState.update('personal.firstName', e.target.value);
        syncFullName();
      });
    }
    if (lnInput) {
      lnInput.addEventListener('input', (e) => {
        ResumeState.update('personal.lastName', e.target.value);
        syncFullName();
      });
    }

    // Synchronize city/country with location
    const cityInput = document.getElementById('pf-city');
    const countryInput = document.getElementById('pf-country');
    const syncLocation = () => {
      const curP = ResumeState.get().personal || {};
      const c = cityInput ? cityInput.value.trim() : (curP.city || '');
      const co = countryInput ? countryInput.value.trim() : (curP.country || '');
      const combined = [c, co].filter(Boolean).join(', ');
      ResumeState.update('personal.location', combined);
    };

    if (cityInput) {
      cityInput.addEventListener('input', (e) => {
        ResumeState.update('personal.city', e.target.value);
        syncLocation();
      });
    }
    if (countryInput) {
      countryInput.addEventListener('input', (e) => {
        ResumeState.update('personal.country', e.target.value);
        syncLocation();
      });
    }

    // Wire other standard fields
    ['title', 'email', 'phone', 'linkedin', 'postalCode', 'website', 'github', 'address', 'dob', 'nationality', 'drivingLicense'].forEach((f) => {
      const input = document.getElementById('pf-' + f);
      if (input) {
        input.addEventListener('input', (e) => ResumeState.update('personal.' + f, e.target.value));
      }
    });

    const toggleBtn = document.getElementById('pf-toggle-more-btn');
    const morePanel = document.getElementById('pf-more-details-panel');
    const toggleText = document.getElementById('pf-toggle-more-text');
    if (toggleBtn && morePanel) {
      toggleBtn.addEventListener('click', () => {
        isMoreDetailsOpen = !isMoreDetailsOpen;
        if (isMoreDetailsOpen) {
          toggleBtn.classList.add('is-open');
          morePanel.classList.add('is-open');
          if (toggleText) toggleText.textContent = 'Hide additional details';
        } else {
          toggleBtn.classList.remove('is-open');
          morePanel.classList.remove('is-open');
          if (toggleText) toggleText.textContent = 'Add more details';
        }
      });
    }

    const titleInput = document.getElementById('pf-title');
    document.getElementById('enhance-title-btn')?.addEventListener('click', (e) => {
      AIEnhance.enhanceFieldInPlace({
        button: e.currentTarget,
        textarea: titleInput,
        kind: 'title',
        onApplied: (val) => ResumeState.update('personal.title', val),
      });
    });

    // Profile photo actions (shared modal defined at module scope)
    refreshPhotoUI();
    document.getElementById('pf-photo-add-btn')?.addEventListener('click', openPhotoModal);
    document.getElementById('pf-photo-remove-btn')?.addEventListener('click', removePhoto);
  }

  function renderSummaryForm() {
    const wrap = document.createElement('div');
    wrap.className = 'form-block';
    const summaryVal = ResumeState.get().summary || '';
    const CHAR_TARGET_MIN = 400, CHAR_TARGET_MAX = 600;

    wrap.innerHTML = `
      <div class="field">
        <div class="richtext-toolbar" id="summary-toolbar" role="toolbar" aria-label="Text formatting">
          <button type="button" class="rt-btn" data-format="bold" title="Bold"><strong>B</strong></button>
          <button type="button" class="rt-btn" data-format="italic" title="Italic"><em>I</em></button>
          <button type="button" class="rt-btn" data-format="underline" title="Underline"><u>U</u></button>
          <span class="rt-divider"></span>
          <button type="button" class="rt-btn" data-format="bullet" title="Bulleted list">☰</button>
          <button type="button" class="rt-btn" data-format="link" title="Insert link">🔗</button>
          <span class="rt-spacer"></span>
          <button class="ai-quick-link" id="enhance-summary-btn" type="button">✦ Get help with writing</button>
        </div>
        <textarea id="pf-summary" rows="5" class="form-textarea richtext-input" placeholder="Computer Science graduate with a strong foundation in full-stack development...">${summaryVal}</textarea>
        <div class="row justify-between align-center mt-2">
          <span class="recruiter-tip" id="summary-recruiter-tip"></span>
          <span class="char-count-ring" id="summary-char-ring"></span>
        </div>
      </div>`;
    els.form.appendChild(wrap);

    const summaryEl = document.getElementById('pf-summary');
    const tipEl = document.getElementById('summary-recruiter-tip');
    const ringEl = document.getElementById('summary-char-ring');

    function updateCounter() {
      const len = summaryEl.value.length;
      const inRange = len >= CHAR_TARGET_MIN && len <= CHAR_TARGET_MAX;
      tipEl.textContent = inRange
        ? 'Nice — this length tends to get more recruiter attention.'
        : `Recruiter tip: write ${CHAR_TARGET_MIN}-${CHAR_TARGET_MAX} characters to increase interview chances`;
      tipEl.style.color = inRange ? 'var(--good)' : 'var(--text-muted)';
      const pct = Math.min(100, Math.round((len / CHAR_TARGET_MAX) * 100));
      ringEl.textContent = `${len} / ${CHAR_TARGET_MAX}`;
      ringEl.style.setProperty('--ring-pct', pct);
      ringEl.classList.toggle('is-good', inRange);
    }
    updateCounter();

    summaryEl.addEventListener('input', (e) => {
      ResumeState.update('summary', e.target.value);
      updateCounter();
    });

    // ---- Formatting toolbar: wraps the current textarea selection with the
    // matching markdown-lite marker (see formatMarkdownLite() in
    // template-engine.js / format_markdown_lite() in export_router.py,
    // which both parse this exact syntax back into real bold/italic/
    // underline/list/link formatting in the preview, PDF, and DOCX).
    document.querySelectorAll('#summary-toolbar .rt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const format = btn.dataset.format;
        const start = summaryEl.selectionStart, end = summaryEl.selectionEnd;
        const selected = summaryEl.value.slice(start, end) || 'text';
        let inserted, cursorOffset;

        if (format === 'bullet') {
          const lineStart = summaryEl.value.lastIndexOf('\n', start - 1) + 1;
          summaryEl.value = summaryEl.value.slice(0, lineStart) + '- ' + summaryEl.value.slice(lineStart);
          summaryEl.selectionStart = summaryEl.selectionEnd = start + 2;
          summaryEl.focus();
          ResumeState.update('summary', summaryEl.value);
          updateCounter();
          return;
        }
        if (format === 'link') {
          const url = prompt('Link URL (https://...)', 'https://');
          if (!url) return;
          inserted = `[${selected}](${url})`;
        } else {
          const marker = { bold: '**', italic: '*', underline: '__' }[format];
          inserted = `${marker}${selected}${marker}`;
        }
        summaryEl.value = summaryEl.value.slice(0, start) + inserted + summaryEl.value.slice(end);
        summaryEl.selectionStart = start;
        summaryEl.selectionEnd = start + inserted.length;
        summaryEl.focus();
        ResumeState.update('summary', summaryEl.value);
        updateCounter();
      });
    });

    document.getElementById('enhance-summary-btn').addEventListener('click', (e) => {
      AIEnhance.enhanceFieldInPlace({
        button: e.currentTarget,
        textarea: summaryEl,
        kind: 'summary',
        onApplied: (val) => { ResumeState.update('summary', val); updateCounter(); },
      });
    });
  }

  function renderExperienceForm(resume) {
    const listWrap = document.createElement('div');
    listWrap.className = 'entries-list';
    (resume.experience || []).forEach((entry) => listWrap.appendChild(buildExperienceCard(entry)));
    els.form.appendChild(listWrap);
    wireEntriesDragAndDrop(listWrap, 'experience');

    const addBtn = document.createElement('button');
    addBtn.className = 'add-entry-btn';
    addBtn.textContent = '+ Add Work Experience Entry';
    addBtn.onclick = () => {
      const newEntry = ResumeState.addEntry('experience', {
        company: '', role: '', location: '', start: '', end: '', current: false, bullets: [''],
      });
      if (newEntry && newEntry.id) {
        expandedCards.add(newEntry.id);
      }
      renderForm();
    };
    els.form.appendChild(addBtn);
  }

  function buildExperienceCard(entry) {
    const isExpanded = expandedCards.has(entry.id);
    const cardWrap = document.createElement('div');
    cardWrap.className = 'entry-row-wrap';
    cardWrap.setAttribute('draggable', 'true');
    cardWrap.dataset.entryId = entry.id;

    const titlePrimary = entry.role || entry.company ? `${entry.role || 'Job Title'} — ${entry.company || 'Company'}` : '(Not specified)';
    const subtitle = entry.start || entry.end || entry.current ? `${entry.start || ''}${entry.start || entry.end || entry.current ? ' - ' : ''}${entry.current ? 'Present' : (entry.end || '')}` : '';

    cardWrap.innerHTML = `
      <span class="entry-drag-handle" draggable="true" title="Drag to reorder">${DRAG_GRIP_SVG}</span>
      <div class="entry-card ${!isExpanded ? 'is-collapsed' : ''}">
        <div class="entry-card-head toggle-card-btn" role="button" tabindex="0" title="Click to expand/collapse">
          <div class="entry-title-wrap">
            <div class="entry-title-primary">${titlePrimary}</div>
            ${subtitle ? `<div class="entry-subtitle-muted">${subtitle}</div>` : ''}
          </div>
          <span class="card-chevron ${isExpanded ? 'is-open' : ''}">${CHEVRON_SVG}</span>
        </div>
        <div class="entry-card-body" style="${!isExpanded ? 'display:none' : ''}">
          <div class="field-row">
            <div class="field"><label>Job Title *</label><input class="form-input" data-field="role" value="${entry.role || ''}" placeholder="Senior Software Engineer"></div>
            <div class="field"><label>Company *</label><input class="form-input" data-field="company" value="${entry.company || ''}" placeholder="Google / Microsoft"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Location</label><input class="form-input" data-field="location" value="${entry.location || ''}" placeholder="New York, NY (or Remote)"></div>
            <div class="field">
              <label>Employment Period</label>
              <div class="row gap-2 align-center">
                <input class="form-input" data-field="start" value="${entry.start || ''}" placeholder="Jan 2021" style="width:110px">
                <span class="text-muted">–</span>
                <input class="form-input" data-field="end" value="${entry.end || ''}" placeholder="Present" style="width:110px" ${entry.current ? 'disabled' : ''}>
                <label class="row gap-1 align-center text-xs" style="margin-left:8px;cursor:pointer">
                  <input type="checkbox" data-field="current" ${entry.current ? 'checked' : ''}> Present
                </label>
              </div>
            </div>
          </div>
          <div class="field" style="margin-top:var(--space-3)">
            <label style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:var(--space-2);display:block">Key Accomplishments & Bullet Points</label>
            <div class="bullets-list"></div>
            <button class="add-entry-btn add-bullet-btn" type="button" style="margin-top:var(--space-2)">+ Add Bullet Point</button>
          </div>
        </div>
      </div>
      <button type="button" class="icon-btn remove-entry-btn" title="Delete position" aria-label="Delete position">${TRASH_SVG}</button>`;

    // Toggle collapse
    cardWrap.querySelector('.toggle-card-btn').addEventListener('click', () => {
      if (expandedCards.has(entry.id)) expandedCards.delete(entry.id);
      else expandedCards.add(entry.id);
      renderForm();
    });

    // Wire inputs
    ['role', 'company', 'location', 'start', 'end'].forEach((f) => {
      const input = cardWrap.querySelector(`[data-field="${f}"]`);
      if (input) {
        input.addEventListener('input', (e) => {
          ResumeState.updateEntry('experience', entry.id, f, e.target.value);
          const updated = ResumeState.get().experience.find((item) => item.id === entry.id);
          if (updated) {
            const titleEl = cardWrap.querySelector('.entry-title-primary');
            if (titleEl) {
              titleEl.textContent = updated.role || updated.company ? `${updated.role || 'Job Title'} — ${updated.company || 'Company'}` : '(Not specified)';
            }
            const subEl = cardWrap.querySelector('.entry-subtitle-muted');
            const newSub = updated.start || updated.end || updated.current ? `${updated.start || ''}${updated.start || updated.end || updated.current ? ' - ' : ''}${updated.current ? 'Present' : (updated.end || '')}` : '';
            if (subEl) subEl.textContent = newSub;
          }
        });
      }
    });

    const currentCheckbox = cardWrap.querySelector('[data-field="current"]');
    if (currentCheckbox) {
      currentCheckbox.addEventListener('change', (e) => {
        ResumeState.updateEntry('experience', entry.id, 'current', e.target.checked);
        renderForm();
      });
    }

    cardWrap.querySelector('.remove-entry-btn').addEventListener('click', async () => {
      const confirmed = window.showConfirmModal
        ? await window.showConfirmModal({
            title: 'Confirm',
            message: 'Are you sure want to permanently delete this position?',
            confirmText: 'Yes, Delete!',
            cancelText: 'Cancel',
            danger: true,
          })
        : confirm('Are you sure want to permanently delete this position?');
      if (!confirmed) return;
      expandedCards.delete(entry.id);
      ResumeState.removeEntry('experience', entry.id);
      renderForm();
    });

    const bulletsList = cardWrap.querySelector('.bullets-list');
    (entry.bullets || []).forEach((bullet, idx) => bulletsList.appendChild(buildBulletRow(entry.id, idx, bullet)));

    cardWrap.querySelector('.add-bullet-btn').addEventListener('click', () => {
      ResumeState.addBullet(entry.id);
      renderForm();
    });

    return cardWrap;
  }

  function buildBulletRow(entryId, index, value) {
    const row = document.createElement('div');
    row.className = 'bullet-row';
    row.innerHTML = `
      <textarea class="form-textarea" placeholder="Increased system throughput by 45% by architecting distributed cache layer...">${value || ''}</textarea>
      <button type="button" class="icon-btn enhance-btn" title="Enhance with AI" aria-label="Enhance with AI">✦</button>
      <button type="button" class="icon-btn remove-bullet-btn" title="Delete bullet" aria-label="Delete bullet">${TRASH_SVG}</button>`;

    const textarea = row.querySelector('textarea');
    textarea.addEventListener('input', (e) => ResumeState.updateBullet(entryId, index, e.target.value));
    row.querySelector('.remove-bullet-btn').addEventListener('click', async () => {
      const confirmed = window.showConfirmModal
        ? await window.showConfirmModal({
            title: 'Confirm',
            message: 'Are you sure want to permanently delete this bullet point?',
            confirmText: 'Yes, Delete!',
            cancelText: 'Cancel',
            danger: true,
          })
        : confirm('Are you sure want to permanently delete this bullet point?');
      if (!confirmed) return;
      ResumeState.removeBullet(entryId, index);
      renderForm();
    });
    row.querySelector('.enhance-btn').addEventListener('click', (e) => {
      AIEnhance.enhanceFieldInPlace({
        button: e.currentTarget,
        textarea,
        kind: 'bullet',
        context: { entryId },
        onApplied: (val) => ResumeState.updateBullet(entryId, index, val),
      });
    });
    return row;
  }

  function renderEducationForm(resume) {
    const listWrap = document.createElement('div');
    listWrap.className = 'entries-list';

    (resume.education || []).forEach((e) => {
      const isExpanded = expandedCards.has(e.id);
      const cardWrap = document.createElement('div');
      cardWrap.className = 'entry-row-wrap';
      cardWrap.setAttribute('draggable', 'true');
      cardWrap.dataset.entryId = e.id;

      const titlePrimary = e.school || e.degree ? `${e.degree || 'Degree'} — ${e.school || 'School'}` : '(Not specified)';
      const subtitle = e.start || e.end ? `${e.start || ''}${e.start && e.end ? ' - ' : ''}${e.end || ''}` : '';

      cardWrap.innerHTML = `
        <span class="entry-drag-handle" draggable="true" title="Drag to reorder">${DRAG_GRIP_SVG}</span>
        <div class="entry-card ${!isExpanded ? 'is-collapsed' : ''}">
          <div class="entry-card-head toggle-card-btn" role="button" tabindex="0" title="Click to expand/collapse">
            <div class="entry-title-wrap">
              <div class="entry-title-primary">${titlePrimary}</div>
              ${subtitle ? `<div class="entry-subtitle-muted">${subtitle}</div>` : ''}
            </div>
            <span class="card-chevron ${isExpanded ? 'is-open' : ''}">${CHEVRON_SVG}</span>
          </div>
          <div class="entry-card-body" style="${!isExpanded ? 'display:none' : ''}">
            <div class="field-row">
              <div class="field"><label>Institution / School *</label><input class="form-input" data-f="school" value="${e.school || ''}" placeholder="Stanford University"></div>
              <div class="field"><label>Degree *</label><input class="form-input" data-f="degree" value="${e.degree || ''}" placeholder="B.S. Computer Science"></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Field of Study</label><input class="form-input" data-f="field" value="${e.field || ''}" placeholder="Software Engineering"></div>
              <div class="field"><label>GPA / Honors</label><input class="form-input" data-f="gpa" value="${e.gpa || ''}" placeholder="3.8 / Magna Cum Laude"></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Start Date</label><input class="form-input" data-f="start" value="${e.start || ''}" placeholder="Sep 2017"></div>
              <div class="field"><label>Graduation Date</label><input class="form-input" data-f="end" value="${e.end || ''}" placeholder="May 2021"></div>
            </div>
            <div class="field" style="margin-top:var(--space-2)">
              <label>Relevant Coursework or Honors</label>
              <input class="form-input" data-f="coursework" value="${e.coursework || ''}" placeholder="Algorithms, Distributed Systems, Machine Learning">
            </div>
          </div>
        </div>
        <button type="button" class="icon-btn remove-entry-btn" title="Delete education entry" aria-label="Delete education entry">${TRASH_SVG}</button>`;

      cardWrap.querySelector('.toggle-card-btn').addEventListener('click', () => {
        if (expandedCards.has(e.id)) expandedCards.delete(e.id);
        else expandedCards.add(e.id);
        renderForm();
      });

      cardWrap.querySelectorAll('[data-f]').forEach((input) => {
        const handler = (ev) => {
          ResumeState.updateEntry('education', e.id, ev.target.dataset.f, ev.target.value);
          const updated = ResumeState.get().education.find((item) => item.id === e.id);
          if (updated) {
            const titleEl = cardWrap.querySelector('.entry-title-primary');
            if (titleEl) {
              titleEl.textContent = updated.school || updated.degree ? `${updated.degree || 'Degree'} — ${updated.school || 'School'}` : '(Not specified)';
            }
            const subEl = cardWrap.querySelector('.entry-subtitle-muted');
            const newSub = updated.start || updated.end ? `${updated.start || ''}${updated.start && updated.end ? ' - ' : ''}${updated.end || ''}` : '';
            if (subEl) subEl.textContent = newSub;
          }
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
      });

      cardWrap.querySelector('.remove-entry-btn').addEventListener('click', async () => {
        const confirmed = window.showConfirmModal
          ? await window.showConfirmModal({
              title: 'Confirm',
              message: 'Are you sure want to permanently delete this education entry?',
              confirmText: 'Yes, Delete!',
              cancelText: 'Cancel',
              danger: true,
            })
          : confirm('Are you sure want to permanently delete this education entry?');
        if (!confirmed) return;
        expandedCards.delete(e.id);
        ResumeState.removeEntry('education', e.id);
        renderForm();
      });

      listWrap.appendChild(cardWrap);
    });

    wireEntriesDragAndDrop(listWrap, 'education');
    els.form.appendChild(listWrap);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-entry-btn';
    addBtn.textContent = '+ Add Education Entry';
    addBtn.onclick = () => {
      const newEntry = ResumeState.addEntry('education', { school: '', degree: '', field: '', start: '', end: '', gpa: '', coursework: '' });
      if (newEntry && newEntry.id) {
        expandedCards.add(newEntry.id);
      }
      renderForm();
    };
    els.form.appendChild(addBtn);
  }

  function renderSkillsForm(resume) {
    const wrap = document.createElement('div');
    wrap.className = 'form-block';
    const skills = resume.skills || { technical: [], soft: [], tools: [] };

    wrap.innerHTML = `
      <div class="row justify-between align-center mb-4">
        <p class="text-muted text-sm" style="margin:0">Add skills by category, or let AI suggest ones you likely have based on your experience.</p>
        <button class="btn btn-accent btn-sm" id="ai-suggest-skills-btn">✦ AI Suggest Skills</button>
      </div>
      <div class="skills-category-section" style="margin-bottom:var(--space-5)">
        <label><strong>Technical Skills</strong></label>
        <div class="field-row align-center">
          <input id="tech-skill-input" class="form-input" placeholder="e.g. Python, React, PostgreSQL (press Enter)">
          <button class="btn btn-ghost btn-sm" id="add-tech-skill-btn">Add</button>
        </div>
        <div class="skills-pills-row" id="tech-pills" style="margin-top:var(--space-2)"></div>
      </div>

      <div class="skills-category-section" style="margin-bottom:var(--space-5)">
        <label><strong>Tools & Technologies</strong></label>
        <div class="field-row align-center">
          <input id="tools-skill-input" class="form-input" placeholder="e.g. Docker, Git, AWS, Kubernetes (press Enter)">
          <button class="btn btn-ghost btn-sm" id="add-tools-skill-btn">Add</button>
        </div>
        <div class="skills-pills-row" id="tools-pills" style="margin-top:var(--space-2)"></div>
      </div>

      <div class="skills-category-section" style="margin-bottom:var(--space-5)">
        <label><strong>Soft Skills & Leadership</strong></label>
        <div class="field-row align-center">
          <input id="soft-skill-input" class="form-input" placeholder="e.g. System Architecture, Team Leadership (press Enter)">
          <button class="btn btn-ghost btn-sm" id="add-soft-skill-btn">Add</button>
        </div>
        <div class="skills-pills-row" id="soft-pills" style="margin-top:var(--space-2)"></div>
      </div>`;

    els.form.appendChild(wrap);

    function wireCategory(cat, inputId, btnId, pillsId) {
      const input = document.getElementById(inputId);
      const btn = document.getElementById(btnId);
      const pillsContainer = document.getElementById(pillsId);

      function renderPills() {
        const list = (ResumeState.get().skills || {})[cat] || [];
        pillsContainer.innerHTML = list
          .map(
            (s, idx) => `
          <span class="skill-pill-tag">
            ${s}
            <button class="remove-skill-tag" data-cat="${cat}" data-idx="${idx}">✕</button>
          </span>`
          )
          .join('');

        pillsContainer.querySelectorAll('.remove-skill-tag').forEach((b) => {
          b.addEventListener('click', () => {
            ResumeState.removeSkill(b.dataset.cat, parseInt(b.dataset.idx, 10));
            renderPills();
          });
        });
      }

      function handleAdd() {
        if (input.value.trim()) {
          ResumeState.addSkill(cat, input.value.trim());
          input.value = '';
          renderPills();
        }
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAdd();
        }
      });
      btn.addEventListener('click', handleAdd);
      renderPills();
    }

    wireCategory('technical', 'tech-skill-input', 'add-tech-skill-btn', 'tech-pills');
    wireCategory('tools', 'tools-skill-input', 'add-tools-skill-btn', 'tools-pills');
    wireCategory('soft', 'soft-skill-input', 'add-soft-skill-btn', 'soft-pills');

    // ---- AI Suggest Skills: infers plausible-but-missing skills from the
    // candidate's actual job titles/bullets and offers them as one-click adds.
    document.getElementById('ai-suggest-skills-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Thinking…';
      try {
        const res = await fetch('/api/ai/suggest-skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume: ResumeState.get() }),
        });
        if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
        const suggestions = await res.json();
        const all = [...(suggestions.technical || []), ...(suggestions.tools || []), ...(suggestions.soft || [])];
        if (!all.length) {
          alert('No confident suggestions — try adding a job title or a bit more experience detail first, then try again.');
          return;
        }
        const proceed = window.showConfirmModal
          ? await window.showConfirmModal({
              title: 'Add Suggested Skills',
              message: `AI suggests adding these skills based on your experience:\n\n${all.join(', ')}`,
              confirmText: 'Add Skills',
              cancelText: 'Cancel',
              danger: false,
            })
          : confirm(`AI suggests adding these skills based on your experience:\n\n${all.join(', ')}\n\nAdd them all?`);
        if (!proceed) return;
        (suggestions.technical || []).forEach((s) => ResumeState.addSkill('technical', s));
        (suggestions.tools || []).forEach((s) => ResumeState.addSkill('tools', s));
        (suggestions.soft || []).forEach((s) => ResumeState.addSkill('soft', s));
        renderForm(); // re-render so the new pills show up immediately
      } catch (err) {
        alert('AI suggest failed: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  function renderProjectsForm(resume) {
    const listWrap = document.createElement('div');
    listWrap.className = 'entries-list';

    (resume.projects || []).forEach((p) => {
      const isExpanded = expandedCards.has(p.id);
      const cardWrap = document.createElement('div');
      cardWrap.className = 'entry-row-wrap';
      cardWrap.setAttribute('draggable', 'true');
      cardWrap.dataset.entryId = p.id;

      const titlePrimary = p.name ? p.name : '(Not specified)';
      const subtitle = p.role || p.link ? `${p.role || ''}${p.role && p.link ? ' • ' : ''}${p.link || ''}` : '';

      cardWrap.innerHTML = `
        <span class="entry-drag-handle" draggable="true" title="Drag to reorder">${DRAG_GRIP_SVG}</span>
        <div class="entry-card ${!isExpanded ? 'is-collapsed' : ''}">
          <div class="entry-card-head toggle-card-btn" role="button" tabindex="0" title="Click to expand/collapse">
            <div class="entry-title-wrap">
              <div class="entry-title-primary">${titlePrimary}</div>
              ${subtitle ? `<div class="entry-subtitle-muted">${subtitle}</div>` : ''}
            </div>
            <span class="card-chevron ${isExpanded ? 'is-open' : ''}">${CHEVRON_SVG}</span>
          </div>
          <div class="entry-card-body" style="${!isExpanded ? 'display:none' : ''}">
            <div class="field-row">
              <div class="field"><label>Project Name</label><input class="form-input" data-f="name" value="${p.name || ''}" placeholder="E-Commerce AI Assistant"></div>
              <div class="field"><label>Role / Role Title</label><input class="form-input" data-f="role" value="${p.role || ''}" placeholder="Lead Developer"></div>
            </div>
            <div class="field"><label>Project Link / URL</label><input class="form-input" data-f="link" value="${p.link || ''}" placeholder="github.com/user/project"></div>
            <div class="field"><label>Description & Tech Used</label>
              <div class="bullet-row">
                <textarea class="form-textarea" data-f="description" rows="3" placeholder="Built real-time recommendations engine processing 10k events/sec using Python, Redis, and React.">${p.description || ''}</textarea>
                <button class="icon-btn enhance-btn enhance-project-btn" type="button" title="Enhance with AI">✦</button>
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="icon-btn remove-entry-btn" title="Delete project" aria-label="Delete project">${TRASH_SVG}</button>`;

      cardWrap.querySelector('.toggle-card-btn').addEventListener('click', () => {
        if (expandedCards.has(p.id)) expandedCards.delete(p.id);
        else expandedCards.add(p.id);
        renderForm();
      });

      cardWrap.querySelectorAll('[data-f]').forEach((input) => {
        const handler = (ev) => {
          ResumeState.updateEntry('projects', p.id, ev.target.dataset.f, ev.target.value);
          const updated = ResumeState.get().projects.find((item) => item.id === p.id);
          if (updated) {
            const titleEl = cardWrap.querySelector('.entry-title-primary');
            if (titleEl) {
              titleEl.textContent = updated.name || '(Not specified)';
            }
            const subEl = cardWrap.querySelector('.entry-subtitle-muted');
            const newSub = updated.role || updated.link ? `${updated.role || ''}${updated.role && updated.link ? ' • ' : ''}${updated.link || ''}` : '';
            if (subEl) subEl.textContent = newSub;
          }
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
      });

      cardWrap.querySelector('.remove-entry-btn').addEventListener('click', async () => {
        const confirmed = window.showConfirmModal
          ? await window.showConfirmModal({
              title: 'Confirm',
              message: 'Are you sure want to permanently delete this project?',
              confirmText: 'Yes, Delete!',
              cancelText: 'Cancel',
              danger: true,
            })
          : confirm('Are you sure want to permanently delete this project?');
        if (!confirmed) return;
        expandedCards.delete(p.id);
        ResumeState.removeEntry('projects', p.id);
        renderForm();
      });

      const descTextarea = cardWrap.querySelector('[data-f="description"]');
      cardWrap.querySelector('.enhance-project-btn')?.addEventListener('click', (e) => {
        AIEnhance.enhanceFieldInPlace({
          button: e.currentTarget,
          textarea: descTextarea,
          kind: 'project_description',
          onApplied: (val) => ResumeState.updateEntry('projects', p.id, 'description', val),
        });
      });

      listWrap.appendChild(cardWrap);
    });

    wireEntriesDragAndDrop(listWrap, 'projects');
    els.form.appendChild(listWrap);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-entry-btn';
    addBtn.textContent = '+ Add Project';
    addBtn.onclick = () => {
      const newEntry = ResumeState.addEntry('projects', { name: '', role: '', link: '', description: '' });
      if (newEntry && newEntry.id) {
        expandedCards.add(newEntry.id);
      }
      renderForm();
    };
    els.form.appendChild(addBtn);
  }

  function renderCertificationsForm(resume) {
    const listWrap = document.createElement('div');
    listWrap.className = 'entries-list';

    (resume.certifications || []).forEach((c) => {
      const isExpanded = expandedCards.has(c.id);
      const cardWrap = document.createElement('div');
      cardWrap.className = 'entry-row-wrap';
      cardWrap.setAttribute('draggable', 'true');
      cardWrap.dataset.entryId = c.id;

      const titlePrimary = c.name ? c.name : '(Not specified)';
      const subtitle = c.issuer || c.date ? `${c.issuer || ''}${c.issuer && c.date ? ' • ' : ''}${c.date || ''}` : '';

      cardWrap.innerHTML = `
        <span class="entry-drag-handle" draggable="true" title="Drag to reorder">${DRAG_GRIP_SVG}</span>
        <div class="entry-card ${!isExpanded ? 'is-collapsed' : ''}">
          <div class="entry-card-head toggle-card-btn" role="button" tabindex="0" title="Click to expand/collapse">
            <div class="entry-title-wrap">
              <div class="entry-title-primary">${titlePrimary}</div>
              ${subtitle ? `<div class="entry-subtitle-muted">${subtitle}</div>` : ''}
            </div>
            <span class="card-chevron ${isExpanded ? 'is-open' : ''}">${CHEVRON_SVG}</span>
          </div>
          <div class="entry-card-body" style="${!isExpanded ? 'display:none' : ''}">
            <div class="field-row">
              <div class="field"><label>Certification Name</label><input class="form-input" data-f="name" value="${c.name || ''}" placeholder="AWS Certified Solutions Architect"></div>
              <div class="field"><label>Issuer</label><input class="form-input" data-f="issuer" value="${c.issuer || ''}" placeholder="Amazon Web Services"></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Date Issued</label><input class="form-input" data-f="date" value="${c.date || ''}" placeholder="2023"></div>
              <div class="field"><label>Credential URL</label><input class="form-input" data-f="url" value="${c.url || ''}" placeholder="credly.com/org/aws..."></div>
            </div>
          </div>
        </div>
        <button type="button" class="icon-btn remove-entry-btn" title="Delete certification" aria-label="Delete certification">${TRASH_SVG}</button>`;

      cardWrap.querySelector('.toggle-card-btn').addEventListener('click', () => {
        if (expandedCards.has(c.id)) expandedCards.delete(c.id);
        else expandedCards.add(c.id);
        renderForm();
      });

      cardWrap.querySelectorAll('[data-f]').forEach((input) => {
        const handler = (ev) => {
          ResumeState.updateEntry('certifications', c.id, ev.target.dataset.f, ev.target.value);
          const updated = ResumeState.get().certifications.find((item) => item.id === c.id);
          if (updated) {
            const titleEl = cardWrap.querySelector('.entry-title-primary');
            if (titleEl) {
              titleEl.textContent = updated.name || '(Not specified)';
            }
            const subEl = cardWrap.querySelector('.entry-subtitle-muted');
            const newSub = updated.issuer || updated.date ? `${updated.issuer || ''}${updated.issuer && updated.date ? ' • ' : ''}${updated.date || ''}` : '';
            if (subEl) subEl.textContent = newSub;
          }
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
      });

      cardWrap.querySelector('.remove-entry-btn').addEventListener('click', async () => {
        const confirmed = window.showConfirmModal
          ? await window.showConfirmModal({
              title: 'Confirm',
              message: 'Are you sure want to permanently delete this certification?',
              confirmText: 'Yes, Delete!',
              cancelText: 'Cancel',
              danger: true,
            })
          : confirm('Are you sure want to permanently delete this certification?');
        if (!confirmed) return;
        expandedCards.delete(c.id);
        ResumeState.removeEntry('certifications', c.id);
        renderForm();
      });

      listWrap.appendChild(cardWrap);
    });

    wireEntriesDragAndDrop(listWrap, 'certifications');
    els.form.appendChild(listWrap);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-entry-btn';
    addBtn.textContent = '+ Add Certification';
    addBtn.onclick = () => {
      const newEntry = ResumeState.addEntry('certifications', { name: '', issuer: '', date: '', url: '' });
      if (newEntry && newEntry.id) {
        expandedCards.add(newEntry.id);
      }
      renderForm();
    };
    els.form.appendChild(addBtn);
  }

  function renderLanguagesForm(resume) {
    const listWrap = document.createElement('div');
    listWrap.className = 'entries-list';

    (resume.languages || []).forEach((l) => {
      const isExpanded = expandedCards.has(l.id);
      const cardWrap = document.createElement('div');
      cardWrap.className = 'entry-row-wrap';
      cardWrap.setAttribute('draggable', 'true');
      cardWrap.dataset.entryId = l.id;

      const titlePrimary = l.name ? l.name : '(Not specified)';
      const subtitle = l.level || '';

      cardWrap.innerHTML = `
        <span class="entry-drag-handle" draggable="true" title="Drag to reorder">${DRAG_GRIP_SVG}</span>
        <div class="entry-card ${!isExpanded ? 'is-collapsed' : ''}">
          <div class="entry-card-head toggle-card-btn" role="button" tabindex="0" title="Click to expand/collapse">
            <div class="entry-title-wrap">
              <div class="entry-title-primary">${titlePrimary}</div>
              ${subtitle ? `<div class="entry-subtitle-muted">${subtitle}</div>` : ''}
            </div>
            <span class="card-chevron ${isExpanded ? 'is-open' : ''}">${CHEVRON_SVG}</span>
          </div>
          <div class="entry-card-body" style="${!isExpanded ? 'display:none' : ''}">
            <div class="field-row">
              <div class="field"><label>Language</label><input class="form-input" data-f="name" value="${l.name || ''}" placeholder="English"></div>
              <div class="field"><label>Proficiency Level</label>
                <select class="form-select" data-f="level">
                  ${['Native / Bilingual', 'Fluent', 'Professional Working', 'Conversational', 'Basic']
                    .map((lvl) => `<option ${l.level === lvl ? 'selected' : ''}>${lvl}</option>`)
                    .join('')}
                </select>
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="icon-btn remove-entry-btn" title="Delete language" aria-label="Delete language">${TRASH_SVG}</button>`;

      cardWrap.querySelector('.toggle-card-btn').addEventListener('click', () => {
        if (expandedCards.has(l.id)) expandedCards.delete(l.id);
        else expandedCards.add(l.id);
        renderForm();
      });

      cardWrap.querySelectorAll('[data-f]').forEach((input) => {
        const handler = (ev) => {
          ResumeState.updateEntry('languages', l.id, ev.target.dataset.f, ev.target.value);
          const updated = ResumeState.get().languages.find((item) => item.id === l.id);
          if (updated) {
            const titleEl = cardWrap.querySelector('.entry-title-primary');
            if (titleEl) {
              titleEl.textContent = updated.name || '(Not specified)';
            }
            const subEl = cardWrap.querySelector('.entry-subtitle-muted');
            if (subEl) subEl.textContent = updated.level || '';
          }
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
      });

      cardWrap.querySelector('.remove-entry-btn').addEventListener('click', async () => {
        const confirmed = window.showConfirmModal
          ? await window.showConfirmModal({
              title: 'Confirm',
              message: 'Are you sure want to permanently delete this language?',
              confirmText: 'Yes, Delete!',
              cancelText: 'Cancel',
              danger: true,
            })
          : confirm('Are you sure want to permanently delete this language?');
        if (!confirmed) return;
        expandedCards.delete(l.id);
        ResumeState.removeEntry('languages', l.id);
        renderForm();
      });

      listWrap.appendChild(cardWrap);
    });

    wireEntriesDragAndDrop(listWrap, 'languages');
    els.form.appendChild(listWrap);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-entry-btn';
    addBtn.textContent = '+ Add Language';
    addBtn.onclick = () => {
      const newEntry = ResumeState.addEntry('languages', { name: '', level: 'Fluent' });
      if (newEntry && newEntry.id) {
        expandedCards.add(newEntry.id);
      }
      renderForm();
    };
    els.form.appendChild(addBtn);
  }

  // ---- Custom Section Form Renderer (multi-instance, matching reference design) --------
  function renderCustomSectionForm(secId, resume) {
    const customSec = (resume[secId] && typeof resume[secId] === 'object') ? resume[secId] : { title: 'Untitled', items: [] };
    const wrap = document.createElement('div');
    wrap.className = 'form-block custom-section-block';

    // Section title edit row with rename and delete controls
    const titleRow = document.createElement('div');
    titleRow.className = 'section-title-rename-row';
    titleRow.innerHTML = `
      <div style="flex: 1;">
        <label class="field-label-sm mb-1">Section Title</label>
        <input class="form-input custom-sec-title-input" value="${customSec.title || 'Untitled'}" placeholder="e.g. Key Highlights, Publications, Projects">
      </div>
      <button type="button" class="icon-btn remove-custom-sec-btn" title="Delete section" aria-label="Delete section" style="color:var(--warn); margin-top: 18px;">${TRASH_SVG}</button>
    `;
    wrap.appendChild(titleRow);

    const titleInput = titleRow.querySelector('.custom-sec-title-input');
    titleInput.addEventListener('input', (e) => {
      const newTitle = e.target.value;
      const cur = (ResumeState.get()[secId] && typeof ResumeState.get()[secId] === 'object') ? ResumeState.get()[secId] : { title: 'Untitled', items: [] };
      ResumeState.update(secId, { ...cur, title: newTitle });
      const secLi = document.querySelector(`.section-list-item[data-section="${secId}"] .sec-label`);
      if (secLi) secLi.textContent = newTitle || 'Untitled';
    });

    titleRow.querySelector('.remove-custom-sec-btn').addEventListener('click', async () => {
      const confirmed = window.showConfirmModal
        ? await window.showConfirmModal({
            title: 'Confirm',
            message: `Are you sure want to permanently delete the "${customSec.title || 'Untitled'}" section?`,
            confirmText: 'Yes, Delete!',
            cancelText: 'Cancel',
            danger: true,
          })
        : confirm(`Are you sure want to permanently delete the "${customSec.title || 'Untitled'}" section?`);
      if (!confirmed) return;
      activeSections = activeSections.filter((s) => s !== secId);
      ResumeState.removeSection(secId);
      renderSectionList();
      renderForm();
    });

    const listWrap = document.createElement('div');
    listWrap.className = 'entries-list';
    const items = Array.isArray(customSec.items) ? customSec.items : [];

    items.forEach((item) => {
      const isExpanded = expandedCards.has(item.id);
      const cardWrap = document.createElement('div');
      cardWrap.className = 'entry-row-wrap';
      cardWrap.dataset.entryId = item.id;
      const titlePrimary = item.title ? item.title : '(Not specified)';
      const subtitle = [item.city, [item.start, item.end].filter(Boolean).join(' - ')].filter(Boolean).join(' • ');

      cardWrap.innerHTML = `
        <span class="entry-drag-handle" draggable="true" title="Drag to reorder">${DRAG_GRIP_SVG}</span>
        <div class="entry-card ${!isExpanded ? 'is-collapsed' : ''}">
          <div class="entry-card-head toggle-card-btn" role="button" tabindex="0" title="Click to expand/collapse">
            <div class="entry-title-wrap">
              <div class="entry-title-primary">${titlePrimary}</div>
              ${subtitle ? `<div class="entry-subtitle-muted">${subtitle}</div>` : ''}
            </div>
            <span class="card-chevron ${isExpanded ? 'is-open' : ''}">${CHEVRON_SVG}</span>
          </div>
          <div class="entry-card-body" style="${!isExpanded ? 'display:none' : ''}">
            <div class="field-row">
              <div class="field" style="flex: 2;">
                <label>Activity name, job title, book title etc.</label>
                <input class="form-input" data-f="title" value="${item.title || ''}" placeholder="e.g. Speaker at TechSummit">
              </div>
              <div class="field" style="flex: 1;">
                <label>City</label>
                <input class="form-input" data-f="city" value="${item.city || ''}" placeholder="e.g. New York, NY">
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label>Start Date</label>
                <input class="form-input" data-f="start" value="${item.start || ''}" placeholder="MM / YYYY">
              </div>
              <div class="field">
                <label>End Date</label>
                <input class="form-input" data-f="end" value="${item.end || ''}" placeholder="MM / YYYY">
              </div>
            </div>
            <div class="field" style="margin-top:var(--space-2)">
              <label>Description</label>
              <div class="rich-text-toolbar">
                <div class="rich-text-btn-group">
                  <button type="button" class="rich-text-btn rt-bold" title="Bold"><b>B</b></button>
                  <button type="button" class="rich-text-btn rt-italic" title="Italic"><i>I</i></button>
                  <button type="button" class="rich-text-btn rt-underline" title="Underline"><u>U</u></button>
                  <button type="button" class="rich-text-btn rt-strike" title="Strikethrough"><s>S</s></button>
                  <button type="button" class="rich-text-btn rt-bullet" title="Bullet list">• List</button>
                  <button type="button" class="rich-text-btn rt-link" title="Link">🔗 Link</button>
                </div>
                <button type="button" class="btn-ai-help-writing enhance-btn" title="Get help with writing">✦ Get help with writing</button>
              </div>
              <textarea class="form-textarea custom-item-desc" data-f="description" rows="4" placeholder="Briefly describe your role, contributions, or achievements...">${item.description || ''}</textarea>
            </div>
          </div>
        </div>
        <button type="button" class="icon-btn remove-entry-btn" title="Delete item" aria-label="Delete item">${TRASH_SVG}</button>`;

      // Collapse toggle
      cardWrap.querySelector('.toggle-card-btn').addEventListener('click', () => {
        if (expandedCards.has(item.id)) expandedCards.delete(item.id);
        else expandedCards.add(item.id);
        renderForm();
      });

      // Rich text toolbar buttons
      const textarea = cardWrap.querySelector('.custom-item-desc');
      cardWrap.querySelector('.rt-bold')?.addEventListener('click', () => applyTextFormat(textarea, '**', '**'));
      cardWrap.querySelector('.rt-italic')?.addEventListener('click', () => applyTextFormat(textarea, '*', '*'));
      cardWrap.querySelector('.rt-underline')?.addEventListener('click', () => applyTextFormat(textarea, '<u>', '</u>'));
      cardWrap.querySelector('.rt-strike')?.addEventListener('click', () => applyTextFormat(textarea, '~~', '~~'));
      cardWrap.querySelector('.rt-bullet')?.addEventListener('click', () => applyTextFormat(textarea, '• '));
      cardWrap.querySelector('.rt-link')?.addEventListener('click', () => applyTextFormat(textarea, '[', '](https://)'));

      // AI help with writing
      cardWrap.querySelector('.btn-ai-help-writing')?.addEventListener('click', (e) => {
        AIEnhance.enhanceFieldInPlace({
          button: e.currentTarget,
          textarea: textarea,
          kind: 'experience_bullet',
          onApplied: (val) => {
            ResumeState.updateEntry(secId, item.id, 'description', val);
          },
        });
      });

      // Data bindings
      cardWrap.querySelectorAll('[data-f]').forEach((input) => {
        const handler = (ev) => {
          ResumeState.updateEntry(secId, item.id, ev.target.dataset.f, ev.target.value);
          const updatedSec = ResumeState.get()[secId];
          const updatedItem = (updatedSec?.items || []).find((i) => i.id === item.id);
          if (updatedItem) {
            const titleEl = cardWrap.querySelector('.entry-title-primary');
            if (titleEl) {
              titleEl.textContent = updatedItem.title || '(Not specified)';
            }
            const subEl = cardWrap.querySelector('.entry-subtitle-muted');
            if (subEl) {
              subEl.textContent = [updatedItem.city, [updatedItem.start, updatedItem.end].filter(Boolean).join(' - ')].filter(Boolean).join(' • ');
            }
          }
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
      });

      // Delete entry item
      cardWrap.querySelector('.remove-entry-btn').addEventListener('click', async () => {
        const confirmed = window.showConfirmModal
          ? await window.showConfirmModal({
              title: 'Confirm',
              message: 'Are you sure want to permanently delete this item?',
              confirmText: 'Yes, Delete!',
              cancelText: 'Cancel',
              danger: true,
            })
          : confirm('Are you sure want to permanently delete this item?');
        if (!confirmed) return;
        expandedCards.delete(item.id);
        ResumeState.removeEntry(secId, item.id);
        renderForm();
      });

      listWrap.appendChild(cardWrap);
    });

    wireEntriesDragAndDrop(listWrap, secId);
    wrap.appendChild(listWrap);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-entry-btn add-more-item-btn';
    addBtn.textContent = '+ Add one more item';
    addBtn.onclick = () => {
      const newEntry = ResumeState.addEntry(secId, { title: '', city: '', start: '', end: '', description: '' });
      if (newEntry && newEntry.id) {
        expandedCards.add(newEntry.id);
      }
      renderForm();
    };
    wrap.appendChild(addBtn);

    els.form.appendChild(wrap);
  }

  // ---- Generic Section Form Renderer ----------------------------------------------------
  function renderGenericSectionForm(secId, resume) {
    if (secId === 'power_statement') {
      const wrap = document.createElement('div');
      wrap.className = 'form-block';
      const val = typeof resume.power_statement === 'string' ? resume.power_statement : (resume.power_statement?.text || '');
      wrap.innerHTML = `
        <div class="field">
          <label><strong>Power Statement / Executive Summary</strong></label>
          <textarea id="power-statement-input" rows="4" class="form-textarea" placeholder="A results-driven technology leader with 8+ years experience scaling high-load architectures...">${val}</textarea>
        </div>`;
      els.form.appendChild(wrap);
      document.getElementById('power-statement-input')?.addEventListener('input', (e) => {
        ResumeState.update('power_statement', e.target.value);
      });
      return;
    }

    if (secId === 'hobbies') {
      const wrap = document.createElement('div');
      wrap.className = 'form-block';
      const items = Array.isArray(resume.hobbies) ? resume.hobbies : (typeof resume.hobbies === 'string' ? resume.hobbies.split(',').map(s => s.trim()).filter(Boolean) : []);
      wrap.innerHTML = `
        <div class="field">
          <label><strong>Hobbies & Interests</strong></label>
          <div class="field-row align-center">
            <input id="hobby-input" class="form-input" placeholder="e.g. Photography, Marathon Running, Chess (press Enter)">
            <button class="btn btn-ghost btn-sm" id="add-hobby-btn">Add</button>
          </div>
          <div class="skills-pills-row" id="hobbies-pills" style="margin-top:var(--space-2)"></div>
        </div>`;
      els.form.appendChild(wrap);

      function renderHobbiesPills() {
        const pContainer = document.getElementById('hobbies-pills');
        if (!pContainer) return;
        const currentHobbies = Array.isArray(ResumeState.get().hobbies) ? ResumeState.get().hobbies : [];
        pContainer.innerHTML = currentHobbies.map((h, idx) => `
          <span class="skill-pill">
            <span>${h}</span>
            <button type="button" class="remove-pill-btn" data-idx="${idx}" title="Remove">✕</button>
          </span>`).join('');
        pContainer.querySelectorAll('.remove-pill-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const list = [...ResumeState.get().hobbies];
            list.splice(idx, 1);
            ResumeState.update('hobbies', list);
            renderHobbiesPills();
          });
        });
      }

      function addHobbyItem() {
        const input = document.getElementById('hobby-input');
        const val = input?.value.trim();
        if (!val) return;
        const list = Array.isArray(ResumeState.get().hobbies) ? [...ResumeState.get().hobbies] : [];
        if (!list.includes(val)) {
          list.push(val);
          ResumeState.update('hobbies', list);
          renderHobbiesPills();
        }
        if (input) input.value = '';
      }

      document.getElementById('add-hobby-btn')?.addEventListener('click', addHobbyItem);
      document.getElementById('hobby-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addHobbyItem();
        }
      });
      renderHobbiesPills();
      return;
    }

    if (secId === 'references') {
      const listWrap = document.createElement('div');
      listWrap.className = 'entries-list';
      const items = Array.isArray(resume.references) ? resume.references : [];

      items.forEach((ref) => {
        const isExpanded = expandedCards.has(ref.id);
        const cardWrap = document.createElement('div');
        cardWrap.className = 'entry-row-wrap';
        cardWrap.dataset.entryId = ref.id;
        const titlePrimary = ref.name || '(Not specified)';
        const subtitle = [ref.role, ref.company].filter(Boolean).join(' • ');

        cardWrap.innerHTML = `
          <span class="entry-drag-handle" draggable="true" title="Drag to reorder">${DRAG_GRIP_SVG}</span>
          <div class="entry-card ${!isExpanded ? 'is-collapsed' : ''}">
            <div class="entry-card-head toggle-card-btn" role="button" tabindex="0" title="Click to expand/collapse">
              <div class="entry-title-wrap">
                <div class="entry-title-primary">${titlePrimary}</div>
                ${subtitle ? `<div class="entry-subtitle-muted">${subtitle}</div>` : ''}
              </div>
              <span class="card-chevron ${isExpanded ? 'is-open' : ''}">${CHEVRON_SVG}</span>
            </div>
            <div class="entry-card-body" style="${!isExpanded ? 'display:none' : ''}">
              <div class="field-row">
                <div class="field"><label>Reference Full Name *</label><input class="form-input" data-f="name" value="${ref.name || ''}" placeholder="Dr. Jane Smith"></div>
                <div class="field"><label>Relationship / Title</label><input class="form-input" data-f="role" value="${ref.role || ''}" placeholder="Former Engineering Manager"></div>
              </div>
              <div class="field-row">
                <div class="field"><label>Company / Organization</label><input class="form-input" data-f="company" value="${ref.company || ''}" placeholder="Acme Corp"></div>
                <div class="field"><label>Email Address</label><input class="form-input" data-f="email" value="${ref.email || ''}" placeholder="jane.smith@acme.com"></div>
              </div>
              <div class="field-row">
                <div class="field"><label>Phone Number</label><input class="form-input" data-f="phone" value="${ref.phone || ''}" placeholder="+1 (555) 019-2834"></div>
              </div>
            </div>
          </div>
          <button type="button" class="icon-btn remove-entry-btn" title="Delete reference" aria-label="Delete reference">${TRASH_SVG}</button>`;

        cardWrap.querySelector('.toggle-card-btn').addEventListener('click', () => {
          if (expandedCards.has(ref.id)) expandedCards.delete(ref.id);
          else expandedCards.add(ref.id);
          renderForm();
        });

        cardWrap.querySelectorAll('[data-f]').forEach((input) => {
          const handler = (ev) => {
            ResumeState.updateEntry('references', ref.id, ev.target.dataset.f, ev.target.value);
            const updated = (ResumeState.get().references || []).find((item) => item.id === ref.id);
            if (updated) {
              const titleEl = cardWrap.querySelector('.entry-title-primary');
              if (titleEl) {
                titleEl.textContent = updated.name || '(Not specified)';
              }
              const subEl = cardWrap.querySelector('.entry-subtitle-muted');
              if (subEl) {
                subEl.textContent = [updated.role, updated.company].filter(Boolean).join(' • ');
              }
            }
          };
          input.addEventListener('input', handler);
          input.addEventListener('change', handler);
        });

        cardWrap.querySelector('.remove-entry-btn').addEventListener('click', async () => {
          const confirmed = window.showConfirmModal
            ? await window.showConfirmModal({
                title: 'Confirm',
                message: 'Are you sure want to permanently delete this reference?',
                confirmText: 'Yes, Delete!',
                cancelText: 'Cancel',
                danger: true,
              })
            : confirm('Are you sure want to permanently delete this reference?');
          if (!confirmed) return;
          expandedCards.delete(ref.id);
          ResumeState.removeEntry('references', ref.id);
          renderForm();
        });

        listWrap.appendChild(cardWrap);
      });

      wireEntriesDragAndDrop(listWrap, 'references');
      els.form.appendChild(listWrap);

      const addBtn = document.createElement('button');
      addBtn.className = 'add-entry-btn';
      addBtn.textContent = '+ Add Reference Contact';
      addBtn.onclick = () => {
        const newEntry = ResumeState.addEntry('references', { name: '', role: '', company: '', email: '', phone: '' });
        if (newEntry && newEntry.id) {
          expandedCards.add(newEntry.id);
        }
        renderForm();
      };
      els.form.appendChild(addBtn);
      return;
    }

    if (secId === 'header_footer') {
      const wrap = document.createElement('div');
      wrap.className = 'form-block';
      const hf = resume.header_footer || {};
      wrap.innerHTML = `
        <div class="field">
          <label><strong>Custom Header Note / Sub-headline</strong></label>
          <input class="form-input" id="hf-header-note" value="${hf.header || ''}" placeholder="Confidential / Prepared for ACME Corp">
        </div>
        <div class="field" style="margin-top:var(--space-3)">
          <label><strong>Custom Footer Note / Disclaimer</strong></label>
          <input class="form-input" id="hf-footer-note" value="${hf.footer || ''}" placeholder="References available upon request.">
        </div>`;
      els.form.appendChild(wrap);

      document.getElementById('hf-header-note')?.addEventListener('input', (e) => {
        const cur = ResumeState.get().header_footer || {};
        ResumeState.update('header_footer', { ...cur, header: e.target.value });
      });
      document.getElementById('hf-footer-note')?.addEventListener('input', (e) => {
        const cur = ResumeState.get().header_footer || {};
        ResumeState.update('header_footer', { ...cur, footer: e.target.value });
      });
      return;
    }

    // Default multi-entry renderer for all other sections (training, volunteering, affiliations, etc.)
    const listWrap = document.createElement('div');
    listWrap.className = 'entries-list';
    const entries = Array.isArray(resume[secId]) ? resume[secId] : [];

    entries.forEach((entry) => {
      const isExpanded = expandedCards.has(entry.id);
      const cardWrap = document.createElement('div');
      cardWrap.className = 'entry-row-wrap';
      cardWrap.dataset.entryId = entry.id;
      const titlePrimary = entry.title || entry.name || '(Not specified)';
      const subtitle = [entry.subtitle || entry.org, entry.date].filter(Boolean).join(' • ');

      cardWrap.innerHTML = `
        <span class="entry-drag-handle" draggable="true" title="Drag to reorder">${DRAG_GRIP_SVG}</span>
        <div class="entry-card ${!isExpanded ? 'is-collapsed' : ''}">
          <div class="entry-card-head toggle-card-btn" role="button" tabindex="0" title="Click to expand/collapse">
            <div class="entry-title-wrap">
              <div class="entry-title-primary">${titlePrimary}</div>
              ${subtitle ? `<div class="entry-subtitle-muted">${subtitle}</div>` : ''}
            </div>
            <span class="card-chevron ${isExpanded ? 'is-open' : ''}">${CHEVRON_SVG}</span>
          </div>
          <div class="entry-card-body" style="${!isExpanded ? 'display:none' : ''}">
            <div class="field-row">
              <div class="field"><label>Title / Role / Honor *</label><input class="form-input" data-f="title" value="${entry.title || entry.name || ''}" placeholder="Title or Role"></div>
              <div class="field"><label>Organization / Issuer / Institution</label><input class="form-input" data-f="subtitle" value="${entry.subtitle || entry.org || ''}" placeholder="Organization Name"></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Date / Year</label><input class="form-input" data-f="date" value="${entry.date || ''}" placeholder="2022 - 2024"></div>
              <div class="field"><label>Location (Optional)</label><input class="form-input" data-f="location" value="${entry.location || ''}" placeholder="City, State"></div>
            </div>
            <div class="field" style="margin-top:var(--space-2)">
              <label>Description / Key Details</label>
              <textarea class="form-textarea" data-f="description" rows="3" placeholder="Brief summary of responsibilities, achievements, or curriculum...">${entry.description || ''}</textarea>
            </div>
          </div>
        </div>
        <button type="button" class="icon-btn remove-entry-btn" title="Delete entry" aria-label="Delete entry">${TRASH_SVG}</button>`;

      cardWrap.querySelector('.toggle-card-btn').addEventListener('click', () => {
        if (expandedCards.has(entry.id)) expandedCards.delete(entry.id);
        else expandedCards.add(entry.id);
        renderForm();
      });

      cardWrap.querySelectorAll('[data-f]').forEach((input) => {
        const handler = (ev) => {
          ResumeState.updateEntry(secId, entry.id, ev.target.dataset.f, ev.target.value);
          const updated = (ResumeState.get()[secId] || []).find((item) => item.id === entry.id);
          if (updated) {
            const titleEl = cardWrap.querySelector('.entry-title-primary');
            if (titleEl) {
              titleEl.textContent = updated.title || updated.name || '(Not specified)';
            }
            const subEl = cardWrap.querySelector('.entry-subtitle-muted');
            if (subEl) {
              subEl.textContent = [updated.subtitle || updated.org, updated.date].filter(Boolean).join(' • ');
            }
          }
        };
        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
      });

      cardWrap.querySelector('.remove-entry-btn').addEventListener('click', async () => {
        const itemLabel = SECTION_LABELS[secId] || 'item';
        const confirmed = window.showConfirmModal
          ? await window.showConfirmModal({
              title: 'Confirm',
              message: `Are you sure want to permanently delete this ${itemLabel}?`,
              confirmText: 'Yes, Delete!',
              cancelText: 'Cancel',
              danger: true,
            })
          : confirm(`Are you sure want to permanently delete this ${itemLabel}?`);
        if (!confirmed) return;
        expandedCards.delete(entry.id);
        ResumeState.removeEntry(secId, entry.id);
        renderForm();
      });

      listWrap.appendChild(cardWrap);
    });

    wireEntriesDragAndDrop(listWrap, secId);
    els.form.appendChild(listWrap);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-entry-btn';
    addBtn.textContent = `+ Add ${SECTION_LABELS[secId] || 'Entry'}`;
    addBtn.onclick = () => {
      const newEntry = ResumeState.addEntry(secId, { title: '', subtitle: '', date: '', location: '', description: '' });
      if (newEntry && newEntry.id) {
        expandedCards.add(newEntry.id);
      }
      renderForm();
    };
    els.form.appendChild(addBtn);
  }

  // ---- Real-time Live Preview & A4 Multi-Page Pagination ----------------
  let previewCurrentPage = 1;
  let previewTotalPages = 1;

  function renderPreview(resume) {
    TemplateEngine.mount(resume, els.previewMount);
    els.previewMount.style.transform = `scale(${zoom * 0.9})`;
    els.previewMount.style.transformOrigin = 'top center';
    updatePagination();
  }

  function updatePagination() {
    const pages = els.previewMount.querySelectorAll('.resume-page');
    const counterEl = document.getElementById('page-counter');
    if (!pages || pages.length === 0) return;

    previewTotalPages = pages.length;
    if (previewCurrentPage > previewTotalPages) {
      previewCurrentPage = previewTotalPages;
    }
    if (counterEl) {
      counterEl.textContent = `${previewCurrentPage} / ${previewTotalPages}`;
    }
  }

  function scrollToPreviewPage(page) {
    if (page < 1 || page > previewTotalPages) return;
    previewCurrentPage = page;
    const targetPageEl = els.previewMount.querySelector(`.resume-page[data-page="${page}"]`);
    if (targetPageEl) {
      targetPageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const counterEl = document.getElementById('page-counter');
    if (counterEl) {
      counterEl.textContent = `${previewCurrentPage} / ${previewTotalPages}`;
    }
  }

  // Listen to pagination updates from TemplateEngine
  window.addEventListener('resume:paginated', (e) => {
    if (e.detail && e.detail.totalPages) {
      previewTotalPages = e.detail.totalPages;
      const counterEl = document.getElementById('page-counter');
      if (counterEl) {
        counterEl.textContent = `${previewCurrentPage} / ${previewTotalPages}`;
      }
    }
  });


  document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
    zoom = Math.min(1.4, zoom + 0.1);
    els.zoomLevel.textContent = Math.round(zoom * 100) + '%';
    renderPreview(ResumeState.get());
  });
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
    zoom = Math.max(0.6, zoom - 0.1);
    els.zoomLevel.textContent = Math.round(zoom * 100) + '%';
    renderPreview(ResumeState.get());
  });
  document.getElementById('fullscreen-preview-btn')?.addEventListener('click', () => {
    ResumeStorage.saveLocal(ResumeState.get());
    window.open('/preview', '_blank');
  });

  // ---- Template Switcher (dynamically populated from /api/templates) ------
  async function renderTemplatePills() {
    const grid = document.getElementById('template-cards-grid');
    if (!grid) return;
    const list = await TemplateEngine.fetchTemplateList();
    const filterPillsContainer = document.querySelector('.filter-pills-scroll');

    // Template filtering logic
    const filterPills = document.querySelectorAll('.filter-pill');
    let activeFilter = 'all';

    function renderGrid() {
      const isCL = ResumeState.get().docType === 'cover_letter';
      if (filterPillsContainer) {
        filterPillsContainer.style.display = isCL ? 'none' : '';
      }

      const filteredList = list.filter(t => {
        const isDocCL = t.category === 'Cover Letter' || (t.id && t.id.startsWith('cl-')) || t.doc_type === 'cover_letter' || (t.tags && t.tags.includes('cover_letter'));
        if (isCL) {
          return isDocCL;
        } else {
          if (isDocCL) return false;
          if (activeFilter === 'all') return true;
          // Basic static filters; easily extendable
          if (activeFilter === 'photo' && !t.hasPhoto) return false;
          if (activeFilter === 'two-column' && t.layout !== 'two_column') return false;
          if (activeFilter === 'ats' && !t.isAts) return false;
          return true;
        }
      });

      grid.innerHTML = filteredList
        .map((t) => `
          <div class="template-card-item ${t.id === ResumeState.get().template ? 'is-selected' : ''}" data-template="${t.id}">
            <div class="template-thumb-preview">
               <div class="template-thumb-fallback theme-${t.id}" aria-label="${t.name} preview">
                 <span class="thumb-fallback-name">${t.name}</span>
                 <span class="thumb-fallback-line"></span>
                 <span class="thumb-fallback-line short"></span>
                 <span class="thumb-fallback-section"></span>
                 <span class="thumb-fallback-line"></span>
                 <span class="thumb-fallback-line short"></span>
               </div>
            </div>
            <div class="template-card-foot">
               <span class="template-card-name">${t.name}</span>
               <div class="badge-group">
                 <span class="format-badge badge-pdf">PDF</span>
                 <span class="format-badge badge-docx">DOCX</span>
               </div>
            </div>
          </div>
        `)
        .join('');

      grid.querySelectorAll('.template-card-item').forEach((card) => {
        card.addEventListener('click', () => {
          grid.querySelectorAll('.template-card-item').forEach((c) => c.classList.remove('is-selected'));
          card.classList.add('is-selected');
          const meta = list.find((t) => t.id === card.dataset.template);
          ResumeState.setTemplate(card.dataset.template);
          if (meta && meta.style) ResumeState.applyTemplateDefaults(meta.style);
        });
      });
    }

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        activeFilter = pill.dataset.filter;
        renderGrid();
      });
    });

    // Make sure we re-render if the template or docType changes from elsewhere
    let lastDocType = ResumeState.get().docType;
    ResumeState.subscribe((state) => {
       if (state.docType !== lastDocType) {
         lastDocType = state.docType;
         renderGrid();
       } else {
         const activeEl = grid.querySelector(`.template-card-item[data-template="${state.template}"]`);
         if (activeEl) {
           grid.querySelectorAll('.template-card-item').forEach((c) => c.classList.remove('is-selected'));
           activeEl.classList.add('is-selected');
         }
       }
    });

    renderGrid();
  }
  renderTemplatePills();

  // ---- Export Dropdown & Handlers ------------------------------------------
  if (els.exportDropdownToggle && els.exportDropdownMenu) {
    els.exportDropdownToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = els.exportDropdownMenu.classList.contains('d-none');
      els.exportDropdownMenu.classList.toggle('d-none');
      els.exportDropdownToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    els.exportDropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', (ev) => {
      // Ignore clicks originating INSIDE the export menu (its item handlers
      // below call stopPropagation, but guard anyway for robustness so the
      // menu can't be hidden in the same tick the user picks an export).
      if (ev.target && ev.target.closest && ev.target.closest('#export-dropdown-menu')) return;
      if (els.exportDropdownMenu) els.exportDropdownMenu.classList.add('d-none');
      if (els.exportDropdownToggle) els.exportDropdownToggle.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.exportDropdownMenu) {
        els.exportDropdownMenu.classList.add('d-none');
        if (els.exportDropdownToggle) els.exportDropdownToggle.setAttribute('aria-expanded', 'false');
      }
    });

    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Preparing PDF…';
        try {
          // Server-side vector PDF with automatic browser fallbacks and a
          // loading overlay (handled inside PDFExport.downloadPdf).
          await PDFExport.downloadPdf(ResumeState.get(), { token: Auth.getToken ? Auth.getToken() : null });
        } catch (err) {
          // downloadPdf already surfaces errors via its own toast; this is a
          // defensive catch so an unexpected failure is never fatal.
          console.error('PDF download failed:', err);
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
      });
    }

    const exportPdfFastBtn = document.getElementById('export-pdf-fast-btn');
    if (exportPdfFastBtn) {
      exportPdfFastBtn.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Opening print…';
        try {
          PDFExport.exportViaPrint(ResumeState.get());
        } finally {
          btn.disabled = false;
          btn.textContent = '🖨️ Print / Standard PDF';
        }
      });
    }

    const exportDocxBtn = document.getElementById('export-docx-btn');
    if (exportDocxBtn) {
      exportDocxBtn.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Preparing Word doc…';
        try {
          await PDFExport.exportViaServer(ResumeState.get(), { format: 'docx', token: Auth.getToken() });
        } catch (err) {
          console.error('Server DOCX export failed, falling back to client DOCX:', err);
          PDFExport.exportViaDocxFallback(ResumeState.get());
        } finally {
          btn.disabled = false;
          btn.textContent = original;
        }
      });
    }

    const exportTxtBtn = document.getElementById('export-txt-btn');
    if (exportTxtBtn) {
      exportTxtBtn.addEventListener('click', () => {
        PDFExport.exportViaText(ResumeState.get());
      });
    }
  }

  // ---- Import Resume Functionality -----------------------------------------
  if (els.importModal) {
    const importButton = document.getElementById('import-btn');
    importButton?.addEventListener('click', () => {
      els.importModal.classList.remove('d-none');
    });

    document.getElementById('close-import-modal').addEventListener('click', () => {
      els.importModal.classList.add('d-none');
    });

    document.getElementById('cancel-import-btn').addEventListener('click', () => {
      els.importModal.classList.add('d-none');
    });

    // PDF/DOCX are binary — reading them as text would just produce garbage,
    // so those go straight to the server's extractor (pdfplumber / python-docx
    // + AI parsing, see api/routers/import_router.py) instead of through the
    // textarea. Plain .txt still loads into the textarea for quick editing.
    const importStatus = document.getElementById('import-file-status');
    let pendingImportFile = null;

    els.importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      pendingImportFile = null;
      if (importStatus) importStatus.textContent = '';
      if (!file) return;

      const isTxt = /\.txt$/i.test(file.name);
      if (isTxt) {
        const reader = new FileReader();
        reader.onload = (event) => { els.importTextInput.value = event.target.result; };
        reader.readAsText(file);
        return;
      }

      // PDF / DOCX: hand off to the server on confirm rather than the textarea.
      pendingImportFile = file;
      els.importTextInput.value = '';
      els.importTextInput.placeholder = `"${file.name}" selected — click Parse & Import to extract it.`;
      if (importStatus) importStatus.textContent = `Ready to parse "${file.name}" on the server.`;
    });

    document.getElementById('confirm-import-btn').addEventListener('click', async () => {
      const confirmBtn = document.getElementById('confirm-import-btn');
      const raw = els.importTextInput.value.trim();

      if (!pendingImportFile && !raw) {
        alert('Please choose a file or paste resume text/JSON.');
        return;
      }

      confirmBtn.disabled = true;
      const originalLabel = confirmBtn.textContent;
      confirmBtn.textContent = 'Parsing…';

      try {
        if (pendingImportFile) {
          const formData = new FormData();
          formData.append('file', pendingImportFile);
          const token = (typeof Auth !== 'undefined' && Auth.isLoggedIn()) ? Auth.getToken() : null;
          const res = await fetch('/api/import/resume', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || 'Could not import that file.');
          ResumeState.replace(data.resume);
        } else if (raw.startsWith('{') && raw.endsWith('}')) {
          ResumeState.replace(JSON.parse(raw));
        } else {
          ResumeState.replace(parseResumeText(raw));
        }

        pendingImportFile = null;
        els.importModal.classList.add('d-none');
        renderSectionList();
        renderForm();
        alert('Resume imported successfully!');
      } catch (err) {
        alert(err.message || 'Could not parse resume data. Please verify the file or text and try again.');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalLabel;
      }
    });
  }

  // ---- Edit / Customize tabs + Design controls (font, color, spacing,
  // bullet style, layout, photo, page numbers) -----------------------------
  const customizePanel = document.getElementById('view-customize-left');
  if (customizePanel) {
    const dz = {
      headingFont: document.getElementById('dz-heading-font'),
      bodyFont: document.getElementById('dz-body-font'),
      nameSize: document.getElementById('dz-name-size'),
      h2Size: document.getElementById('dz-h2-size'),
      bodySize: document.getElementById('dz-body-size'),
      contactSize: document.getElementById('dz-contact-size'),
      colorHeading: document.getElementById('dz-color-heading'),
      colorBody: document.getElementById('dz-color-body'),
      colorAccent: document.getElementById('dz-color-accent'),
      colorLink: document.getElementById('dz-color-link'),
      lineHeight: document.getElementById('dz-line-height'),
      sectionSpacing: document.getElementById('dz-section-spacing'),
      pageMargin: document.getElementById('dz-page-margin'),
      bulletStyle: document.getElementById('dz-bullet-style'),
      photoVisible: document.getElementById('dz-photo-visible'),
      photoUrl: document.getElementById('dz-photo-url'),
      photoShape: document.getElementById('dz-photo-shape'),
      photoPosition: document.getElementById('dz-photo-position'),
      pnEnabled: document.getElementById('dz-pn-enabled'),
      pnPosition: document.getElementById('dz-pn-position'),
      pnFormat: document.getElementById('dz-pn-format'),
    };

    function populateCustomizePanel() {
      const c = ResumeState.get().customization || {};
      const f = c.fontSizes || {}, col = c.colors || {}, fam = c.fonts || {}, s = c.spacing || {}, photo = c.photo || {}, pn = c.pageNumbers || {};

      dz.headingFont.value = fam.heading || 'Fraunces, Georgia, serif';
      dz.bodyFont.value = fam.body || 'Inter, sans-serif';
      dz.nameSize.value = f.name ?? 26; dz.nameSizeVal();
      dz.h2Size.value = f.h2 ?? 12; dz.h2SizeVal();
      dz.bodySize.value = f.body ?? 13; dz.bodySizeVal();
      dz.contactSize.value = f.contact ?? 11; dz.contactSizeVal();
      dz.colorHeading.value = col.heading || '#1c1c1c';
      dz.colorBody.value = col.body || '#333333';
      dz.colorAccent.value = col.accent || '#5b5bd6';
      dz.colorLink.value = col.link || '#5b5bd6';
      dz.lineHeight.value = s.lineHeight ?? 1.5; dz.lineHeightVal();
      dz.sectionSpacing.value = s.sectionSpacing ?? 20; dz.sectionSpacingVal();
      dz.pageMargin.value = s.pageMargin ?? 32; dz.pageMarginVal();
      dz.bulletStyle.value = s.bulletStyle || 'disc';
      dz.photoVisible.checked = !!photo.visible;
      dz.photoUrl.value = photo.url || '';
      dz.photoShape.value = photo.shape || 'circle';
      dz.photoPosition.value = photo.position || 'left';
      dz.pnEnabled.checked = !!pn.enabled;
      dz.pnPosition.value = pn.position || 'bottom-center';
      dz.pnFormat.value = pn.format || 'Page {n}';
    }

    // Small helpers to show the live numeric value next to each slider label.
    dz.nameSizeVal = () => (document.getElementById('dz-name-size-val').textContent = dz.nameSize.value + 'px');
    dz.h2SizeVal = () => (document.getElementById('dz-h2-size-val').textContent = dz.h2Size.value + 'px');
    dz.bodySizeVal = () => (document.getElementById('dz-body-size-val').textContent = dz.bodySize.value + 'px');
    dz.contactSizeVal = () => (document.getElementById('dz-contact-size-val').textContent = dz.contactSize.value + 'px');
    dz.lineHeightVal = () => (document.getElementById('dz-line-height-val').textContent = dz.lineHeight.value);
    dz.sectionSpacingVal = () => (document.getElementById('dz-section-spacing-val').textContent = dz.sectionSpacing.value + 'px');
    dz.pageMarginVal = () => (document.getElementById('dz-page-margin-val').textContent = dz.pageMargin.value + 'px');

    // ---- 4-Segment View Switching -------------------------------------------
    const viewTabs = document.querySelectorAll('.nav-segment-tabs .view-tab');

    const leftPanels = {
      edit: document.getElementById('view-edit-left'),
      customize: document.getElementById('view-customize-left'),
      aireview: document.getElementById('view-edit-left'), // AI review shares left accordion
      preview: document.getElementById('view-edit-left'),
    };

    const rightPanels = {
      edit: document.getElementById('view-preview-right'),
      customize: document.getElementById('view-preview-right'),
      aireview: document.getElementById('view-aireview-right'),
      preview: document.getElementById('view-preview-right'),
    };

    let currentActiveView = 'edit';

    function showView(viewId) {
      currentActiveView = viewId;
      const shell = document.getElementById('main');
      if (shell) shell.setAttribute('data-active-view', viewId);

      viewTabs.forEach(tab => tab.classList.toggle('is-active', tab.dataset.view === viewId));

      const isCL = ResumeState.get().docType === 'cover_letter';
      const viewEditLeft = document.getElementById('view-edit-left');
      const viewCoverLetterEdit = document.getElementById('view-coverletter-edit');
      const viewCustomizeLeft = document.getElementById('view-customize-left');

      // Toggle left panels
      viewEditLeft?.classList.add('d-none');
      viewCoverLetterEdit?.classList.add('d-none');
      viewCustomizeLeft?.classList.add('d-none');

      if (viewId === 'edit' || viewId === 'preview' || viewId === 'aireview') {
        if (isCL) {
          viewCoverLetterEdit?.classList.remove('d-none');
        } else {
          viewEditLeft?.classList.remove('d-none');
        }
      } else if (viewId === 'customize') {
        viewCustomizeLeft?.classList.remove('d-none');
      }

      // Toggle right panels
      document.getElementById('view-preview-right')?.classList.add('d-none');
      document.getElementById('view-aireview-right')?.classList.add('d-none');
      if (rightPanels[viewId]) rightPanels[viewId].classList.remove('d-none');

      if (viewId === 'customize') populateCustomizePanel();
      if (viewId === 'aireview') {
        const container = document.getElementById('view-aireview-right');
        if (!container.dataset.aiRunDone) {
          container.dataset.aiRunDone = 'true';
          window.runAICheck();
        }
      }

      // Update URL silently
      const url = new URL(window.location);
      url.searchParams.set('view', viewId);
      window.history.replaceState({}, '', url);
    }

    // Re-evaluate left view when docType changes
    ResumeState.subscribe((state) => {
      const isCL = state.docType === 'cover_letter';
      const viewEditLeft = document.getElementById('view-edit-left');
      const viewCoverLetterEdit = document.getElementById('view-coverletter-edit');
      if (currentActiveView === 'edit' || currentActiveView === 'preview' || currentActiveView === 'aireview') {
        if (isCL) {
          viewEditLeft?.classList.add('d-none');
          viewCoverLetterEdit?.classList.remove('d-none');
        } else {
          viewCoverLetterEdit?.classList.add('d-none');
          viewEditLeft?.classList.remove('d-none');
        }
      }
    });

    viewTabs.forEach(tab => {
      tab.addEventListener('click', () => showView(tab.dataset.view));
    });

    // Sub-tab switching for Customize panel
    const custSubtabs = document.querySelectorAll('.cust-subtab');
    const custSubpanels = {
      templates: document.getElementById('cust-subpanel-templates'),
      text: document.getElementById('cust-subpanel-text'),
      layout: document.getElementById('cust-subpanel-layout')
    };
    custSubtabs.forEach(tab => {
      tab.addEventListener('click', () => {
        custSubtabs.forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        Object.values(custSubpanels).forEach(p => p.classList.add('d-none'));
        custSubpanels[tab.dataset.subtab].classList.remove('d-none');
      });
    });

    // Theme color swatches
    const currentUser = (typeof Auth !== 'undefined') ? Auth.getUser() : null;
    const isProOrAdmin = currentUser && (currentUser.role === 'admin' || currentUser.plan === 'pro' || currentUser.plan === 'admin');

    const allSwatches = document.querySelectorAll('.color-swatch');
    allSwatches.forEach(swatch => {
      if (isProOrAdmin && swatch.classList.contains('swatch-locked')) {
        swatch.classList.remove('swatch-locked');
        swatch.textContent = '';
        if (swatch.dataset.colorName) swatch.title = swatch.dataset.colorName;
      }

      swatch.addEventListener('click', () => {
        if (swatch.classList.contains('swatch-locked')) {
          alert('This color swatch is exclusive to Pro and Admin users!');
          return;
        }
        allSwatches.forEach(s => {
          s.classList.remove('swatch-active');
          if (!s.classList.contains('swatch-locked')) s.textContent = '';
        });
        swatch.classList.add('swatch-active');
        swatch.textContent = '✓';
        const color = swatch.dataset.color;
        if (color) {
          dz.colorAccent.value = color;
          dz.colorHeading.value = color;
          ResumeState.updateCustomization('colors', 'accent', color);
          ResumeState.updateCustomization('colors', 'heading', color);
        }
      });
    });

    // Exposed so boot()'s ?panel=design URL handling (below) can jump
    // straight into the Customize tab.
    window.__showCustomizeView = () => showView('customize');

    // Document Title binding
    const docTitleInput = document.getElementById('doc-title-input');
    if (docTitleInput) {
      // Sync from state to UI on load
      ResumeState.subscribe(resume => {
         if (document.activeElement !== docTitleInput) {
            docTitleInput.value = resume.personal?.fullName || 'My Resume';
         }
      });
      // Sync UI to state
      docTitleInput.addEventListener('change', (e) => {
         ResumeState.update('personal.fullName', e.target.value);
      });
    }

    // Language dropdown binding
    const langSelect = document.getElementById('lang-select-dropdown');
    if (langSelect) {
      ResumeState.subscribe(resume => {
         if (document.activeElement !== langSelect) {
            langSelect.value = resume.lang || 'en';
         }
      });
      langSelect.addEventListener('change', (e) => {
         ResumeState.update('lang', e.target.value);
      });
    }

    // Each control writes straight into resume.customization via the state
    // module's own setter — ResumeState's subscribers (including the live
    // preview) re-render automatically, so changes appear instantly.
    dz.headingFont.addEventListener('change', () => ResumeState.updateCustomization('fonts', 'heading', dz.headingFont.value));
    dz.bodyFont.addEventListener('change', () => ResumeState.updateCustomization('fonts', 'body', dz.bodyFont.value));

    dz.nameSize.addEventListener('input', () => { dz.nameSizeVal(); ResumeState.updateCustomization('fontSizes', 'name', Number(dz.nameSize.value)); });
    dz.h2Size.addEventListener('input', () => { dz.h2SizeVal(); ResumeState.updateCustomization('fontSizes', 'h2', Number(dz.h2Size.value)); });
    dz.bodySize.addEventListener('input', () => { dz.bodySizeVal(); ResumeState.updateCustomization('fontSizes', 'body', Number(dz.bodySize.value)); });
    dz.contactSize.addEventListener('input', () => { dz.contactSizeVal(); ResumeState.updateCustomization('fontSizes', 'contact', Number(dz.contactSize.value)); });

    dz.colorHeading.addEventListener('input', () => ResumeState.updateCustomization('colors', 'heading', dz.colorHeading.value));
    dz.colorBody.addEventListener('input', () => ResumeState.updateCustomization('colors', 'body', dz.colorBody.value));
    dz.colorAccent.addEventListener('input', () => ResumeState.updateCustomization('colors', 'accent', dz.colorAccent.value));
    dz.colorLink.addEventListener('input', () => ResumeState.updateCustomization('colors', 'link', dz.colorLink.value));

    dz.lineHeight.addEventListener('input', () => { dz.lineHeightVal(); ResumeState.updateCustomization('spacing', 'lineHeight', Number(dz.lineHeight.value)); });
    dz.sectionSpacing.addEventListener('input', () => { dz.sectionSpacingVal(); ResumeState.updateCustomization('spacing', 'sectionSpacing', Number(dz.sectionSpacing.value)); });
    dz.pageMargin.addEventListener('input', () => { dz.pageMarginVal(); ResumeState.updateCustomization('spacing', 'pageMargin', Number(dz.pageMargin.value)); });
    dz.bulletStyle.addEventListener('change', () => ResumeState.updateCustomization('spacing', 'bulletStyle', dz.bulletStyle.value));

    dz.photoVisible.addEventListener('change', () => ResumeState.updateCustomization('photo', 'visible', dz.photoVisible.checked));
    dz.photoUrl.addEventListener('change', () => ResumeState.updateCustomization('photo', 'url', dz.photoUrl.value.trim() || null));
    dz.photoShape.addEventListener('change', () => ResumeState.updateCustomization('photo', 'shape', dz.photoShape.value));
    dz.photoPosition.addEventListener('change', () => ResumeState.updateCustomization('photo', 'position', dz.photoPosition.value));

    // Add/Remove photo now lives in Edit -> Profile Summary -> Personal Details
    // (see renderPersonalFields); the shared open/close/upload logic is defined
    // at module scope above.

    dz.pnEnabled.addEventListener('change', () => ResumeState.updateCustomization('pageNumbers', 'enabled', dz.pnEnabled.checked));
    dz.pnPosition.addEventListener('change', () => ResumeState.updateCustomization('pageNumbers', 'position', dz.pnPosition.value));
    dz.pnFormat.addEventListener('change', () => ResumeState.updateCustomization('pageNumbers', 'format', dz.pnFormat.value));

    document.getElementById('design-reset-btn').addEventListener('click', async () => {
      const list = await TemplateEngine.fetchTemplateList();
      const current = list.find((t) => t.id === ResumeState.get().template);
      if (current && current.style) {
        ResumeState.applyTemplateDefaults(current.style);
        populateCustomizePanel();
      }
    });

  }

  // Smart Plain Text Parser
  function parseResumeText(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed = ResumeState.normalizeResume({});

    // Email extraction
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
    if (emailMatch) parsed.personal.email = emailMatch[1];

    // Phone extraction
    const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) parsed.personal.phone = phoneMatch[0];

    // LinkedIn extraction
    const linkedinMatch = text.match(/(linkedin\.com\/in\/[^\s]+)/i);
    if (linkedinMatch) parsed.personal.linkedin = linkedinMatch[1];

    // Name extraction (first line that isn't contact info)
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (!firstLine.includes('@') && !firstLine.match(/\d{5,}/)) {
        parsed.personal.fullName = firstLine;
      }
    }

    // Parse summary or experience if available
    let currentSection = 'summary';
    lines.forEach((line) => {
      const lower = line.toLowerCase();
      if (lower.includes('experience') || lower.includes('employment') || lower.includes('work history')) {
        currentSection = 'experience';
      } else if (lower.includes('education') || lower.includes('university') || lower.includes('college')) {
        currentSection = 'education';
      } else if (lower.includes('skills') || lower.includes('technologies')) {
        currentSection = 'skills';
      } else {
        if (currentSection === 'summary' && !parsed.personal.fullName.includes(line) && !line.includes('@')) {
          parsed.summary += (parsed.summary ? ' ' : '') + line;
        } else if (currentSection === 'skills') {
          line.split(/[,•|]/).forEach((s) => {
            if (s.trim()) parsed.skills.technical.push(s.trim());
          });
        }
      }
    });

    return parsed;
  }

  // ---- AI Review: run fresh analysis (exposed globally for ai-check.js) ----
  window.runAICheck = async function () {
    const aiReviewContainer = document.getElementById('view-aireview-right');
    AICheck.renderLoading(aiReviewContainer);
    try {
      const targetRole = document.getElementById('target-role-input')?.textContent.trim();
      const jd = document.getElementById('jd-input')?.value.trim();
      const result = await AICheck.run(ResumeState.get(), targetRole, jd);
      AICheck.renderInto(aiReviewContainer, result);
    } catch (err) {
      AICheck.renderError(aiReviewContainer, aiErrorMessage(err));
    }
  };

  function aiErrorMessage(err) {
    return err && err.message ? err.message : 'Could not run AI right now. Please try again.';
  }

  // ---- Top-of-accordion AI quick actions ------------------------------------
  document.getElementById('ai-quick-summary-btn')?.addEventListener('click', () => {
    // Jump to the Summary section and trigger its existing AI-enhance flow
    // (reuses the same enhance-summary-btn logic — no duplicate AI call code).
    if (!activeSections.includes('summary')) activeSections.push('summary');
    renderSectionList();
    renderForm();
    requestAnimationFrame(() => document.getElementById('enhance-summary-btn')?.click());
  });

  document.getElementById('ai-quick-coverletter-btn')?.addEventListener('click', () => {
    window.location.href = '/builder?doc_type=cover_letter';
  });


  // ---- Feedback Edge Tab -----------------------------------------------
  document.getElementById('feedback-edge-tab')?.addEventListener('click', () => {
    // Switch to the AI Review tab
    document.getElementById('tab-aireview-btn')?.click();
  });

  document.getElementById('ai-dashboard-refresh-btn')?.addEventListener('click', () => {
    if (typeof window.runAICheck === 'function') {
      window.runAICheck();
    }
  });

  // ---- Pagination Buttons & Scroll Tracking -----------------------------------
  document.getElementById('page-prev-btn')?.addEventListener('click', () => {
    if (previewCurrentPage > 1) {
      previewCurrentPage--;
      scrollToPreviewPage(previewCurrentPage);
    }
  });
  document.getElementById('page-next-btn')?.addEventListener('click', () => {
    if (previewCurrentPage < previewTotalPages) {
      previewCurrentPage++;
      scrollToPreviewPage(previewCurrentPage);
    }
  });

  const previewContainer = document.getElementById('view-preview-right');
  if (previewContainer) {
    let scrollTimeout;
    previewContainer.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const pages = els.previewMount.querySelectorAll('.resume-page');
        if (!pages || pages.length === 0) return;
        const containerRect = previewContainer.getBoundingClientRect();
        const containerCenter = containerRect.top + containerRect.height / 2;
        let closestPage = previewCurrentPage;
        let minDistance = Infinity;

        pages.forEach((pEl) => {
          const pRect = pEl.getBoundingClientRect();
          const pCenter = pRect.top + pRect.height / 2;
          const dist = Math.abs(pCenter - containerCenter);
          if (dist < minDistance) {
            minDistance = dist;
            closestPage = parseInt(pEl.dataset.page, 10) || 1;
          }
        });

        if (closestPage !== previewCurrentPage) {
          previewCurrentPage = closestPage;
          const counterEl = document.getElementById('page-counter');
          if (counterEl) counterEl.textContent = `${previewCurrentPage} / ${previewTotalPages}`;
        }
      }, 50);
    });
  }

  // ---- Dedicated Cover Letter Editor Binding & AI Writer -------------------
  function initCoverLetterEditor() {
    const clContainer = document.getElementById('view-coverletter-edit');
    if (!clContainer) return;

    // Personal inputs
    const inFullName = document.getElementById('cl-input-fullname');
    const inTitle = document.getElementById('cl-input-title');
    const inAddress = document.getElementById('cl-input-address');
    const inEmail = document.getElementById('cl-input-email');
    const inPhone = document.getElementById('cl-input-phone');
    const inLinkedin = document.getElementById('cl-input-linkedin');
    const inWebsite = document.getElementById('cl-input-website');

    // Employer inputs
    const inCompany = document.getElementById('cl-input-company');
    const inManager = document.getElementById('cl-input-manager');
    const inCompanyAddr = document.getElementById('cl-input-company-address');
    const inDate = document.getElementById('cl-input-date');

    // Letter inputs
    const inSalutation = document.getElementById('cl-input-salutation');
    const inBody = document.getElementById('cl-letter-body');
    const inSignoff = document.getElementById('cl-input-signoff');
    const inSignature = document.getElementById('cl-input-signature');

    // Badges & count
    const badgeWord = document.getElementById('cl-word-badge');
    const charCountEl = document.getElementById('cl-char-count');

    // Toggle extra personal
    const toggleExtraBtn = document.getElementById('cl-toggle-extra-personal');
    const extraGrid = document.getElementById('cl-extra-personal-grid');
    if (toggleExtraBtn && extraGrid) {
      toggleExtraBtn.addEventListener('click', () => {
        extraGrid.classList.toggle('d-none');
        const isHidden = extraGrid.classList.contains('d-none');
        const labelSpan = toggleExtraBtn.querySelector('#cl-extra-personal-label');
        if (labelSpan) {
          labelSpan.textContent = isHidden
            ? '＋ Additional contact details (LinkedIn, Website, etc.)'
            : '－ Hide additional contact details';
        }
      });
    }

    // Update counters
    function updateCounters(text) {
      const raw = (text || '').trim();
      const words = raw ? raw.split(/\s+/).filter(Boolean).length : 0;
      const chars = (text || '').length;

      if (badgeWord) {
        badgeWord.className = 'cl-word-badge';
        if (words === 0) {
          badgeWord.classList.add('brief');
          badgeWord.textContent = '0 words';
        } else if (words < 150) {
          badgeWord.classList.add('brief');
          badgeWord.textContent = `${words} word${words === 1 ? '' : 's'} · Brief`;
        } else if (words <= 450) {
          badgeWord.classList.add('optimal');
          badgeWord.textContent = `${words} words · Optimal length`;
        } else {
          badgeWord.classList.add('lengthy');
          badgeWord.textContent = `${words} words · Lengthy`;
        }
      }

      if (charCountEl) {
        charCountEl.textContent = `${chars.toLocaleString()} chars`;
      }
    }

    // Sync state to inputs
    function syncStateToInputs(state) {
      const p = state.personal || {};
      const cl = state.coverLetter || state.cover_letter || {};

      if (inFullName && document.activeElement !== inFullName) {
        inFullName.value = p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || '';
      }
      if (inTitle && document.activeElement !== inTitle) {
        inTitle.value = p.title || p.jobTarget || '';
      }
      if (inAddress && document.activeElement !== inAddress) {
        inAddress.value = p.address || p.location || '';
      }
      if (inEmail && document.activeElement !== inEmail) {
        inEmail.value = p.email || '';
      }
      if (inPhone && document.activeElement !== inPhone) {
        inPhone.value = p.phone || '';
      }
      if (inLinkedin && document.activeElement !== inLinkedin) {
        inLinkedin.value = p.linkedin || '';
      }
      if (inWebsite && document.activeElement !== inWebsite) {
        inWebsite.value = p.website || '';
      }

      if (inCompany && document.activeElement !== inCompany) {
        inCompany.value = cl.companyName || '';
      }
      if (inManager && document.activeElement !== inManager) {
        inManager.value = cl.hiringManager || '';
      }
      if (inCompanyAddr && document.activeElement !== inCompanyAddr) {
        inCompanyAddr.value = cl.companyAddress || '';
      }
      if (inDate && document.activeElement !== inDate) {
        inDate.value = cl.date || '';
      }

      if (inSalutation && document.activeElement !== inSalutation) {
        inSalutation.value = cl.salutation || 'Dear Hiring Team,';
      }
      if (inBody && document.activeElement !== inBody) {
        inBody.value = cl.body || '';
      }
      if (inSignoff && document.activeElement !== inSignoff) {
        inSignoff.value = cl.signOff || 'Sincerely,';
      }
      if (inSignature && document.activeElement !== inSignature) {
        inSignature.value = cl.signature || p.fullName || '';
      }

      updateCounters(cl.body || '');
    }

    // Bind input listeners with real-time state synchronization
    inFullName?.addEventListener('input', (e) => ResumeState.update('personal.fullName', e.target.value));
    inTitle?.addEventListener('input', (e) => ResumeState.update('personal.title', e.target.value));
    inAddress?.addEventListener('input', (e) => ResumeState.update('personal.address', e.target.value));
    inEmail?.addEventListener('input', (e) => ResumeState.update('personal.email', e.target.value));
    inPhone?.addEventListener('input', (e) => ResumeState.update('personal.phone', e.target.value));
    inLinkedin?.addEventListener('input', (e) => ResumeState.update('personal.linkedin', e.target.value));
    inWebsite?.addEventListener('input', (e) => ResumeState.update('personal.website', e.target.value));

    inCompany?.addEventListener('input', (e) => ResumeState.update('coverLetter.companyName', e.target.value));
    inManager?.addEventListener('input', (e) => ResumeState.update('coverLetter.hiringManager', e.target.value));
    inCompanyAddr?.addEventListener('input', (e) => ResumeState.update('coverLetter.companyAddress', e.target.value));
    inDate?.addEventListener('input', (e) => ResumeState.update('coverLetter.date', e.target.value));

    inSalutation?.addEventListener('input', (e) => ResumeState.update('coverLetter.salutation', e.target.value));
    inBody?.addEventListener('input', (e) => {
      ResumeState.update('coverLetter.body', e.target.value);
      updateCounters(e.target.value);
    });
    inSignoff?.addEventListener('input', (e) => ResumeState.update('coverLetter.signOff', e.target.value));
    inSignature?.addEventListener('input', (e) => ResumeState.update('coverLetter.signature', e.target.value));

    // Rich text toolbar operations
    function wrapSelection(prefix, suffix = prefix, defaultText = 'text') {
      if (!inBody) return;
      const start = inBody.selectionStart;
      const end = inBody.selectionEnd;
      const value = inBody.value;
      const selected = value.substring(start, end) || defaultText;
      const replacement = prefix + selected + suffix;
      inBody.value = value.substring(0, start) + replacement + value.substring(end);
      inBody.selectionStart = start + prefix.length;
      inBody.selectionEnd = start + replacement.length - suffix.length;
      inBody.focus();
      ResumeState.update('coverLetter.body', inBody.value);
      updateCounters(inBody.value);
    }

    function formatLines(prefixFn) {
      if (!inBody) return;
      const start = inBody.selectionStart;
      const end = inBody.selectionEnd;
      const value = inBody.value;
      const selected = value.substring(start, end) || 'List item';
      const lines = selected.split('\n');
      const formatted = lines.map((l, i) => prefixFn(i) + l.replace(/^[-•*]|\d+\.\s*/, '').trim()).join('\n');
      inBody.value = value.substring(0, start) + formatted + value.substring(end);
      inBody.focus();
      ResumeState.update('coverLetter.body', inBody.value);
      updateCounters(inBody.value);
    }

    document.getElementById('cl-tb-bold')?.addEventListener('click', () => wrapSelection('**', '**', 'bold text'));
    document.getElementById('cl-tb-italic')?.addEventListener('click', () => wrapSelection('*', '*', 'italic text'));
    document.getElementById('cl-tb-underline')?.addEventListener('click', () => wrapSelection('<u>', '</u>', 'underlined text'));
    document.getElementById('cl-tb-strike')?.addEventListener('click', () => wrapSelection('~~', '~~', 'strikethrough text'));
    document.getElementById('cl-tb-bullet')?.addEventListener('click', () => formatLines(() => '- '));
    document.getElementById('cl-tb-number')?.addEventListener('click', () => formatLines((i) => `${i + 1}. `));
    document.getElementById('cl-tb-link')?.addEventListener('click', () => {
      const url = prompt('Enter link URL (e.g. https://example.com):', 'https://');
      if (url) wrapSelection('[', `](${url})`, 'link text');
    });

    // Keyboard shortcuts inside inBody (Ctrl+B, Ctrl+I, Ctrl+U)
    inBody?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          wrapSelection('**', '**', 'bold text');
        } else if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          wrapSelection('*', '*', 'italic text');
        } else if (e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          wrapSelection('<u>', '</u>', 'underlined text');
        }
      }
    });

    // AI Cover Letter Modal wiring
    const aiHelpBtn = document.getElementById('cl-ai-help-btn');
    const aiModal = document.getElementById('cl-ai-modal');
    const closeAiModal = document.getElementById('close-cl-ai-modal');
    const cancelAiBtn = document.getElementById('cancel-cl-ai-btn');
    const generateAiBtn = document.getElementById('generate-cl-ai-btn');
    const applyAiBtn = document.getElementById('apply-cl-ai-btn');
    const aiRoleInput = document.getElementById('cl-ai-role');
    const aiCompanyInput = document.getElementById('cl-ai-company');
    const aiManagerInput = document.getElementById('cl-ai-manager');
    const aiToneSelect = document.getElementById('cl-ai-tone');
    const aiHighlightsInput = document.getElementById('cl-ai-highlights');
    const aiResultWrap = document.getElementById('cl-ai-result-wrap');
    const aiResultText = document.getElementById('cl-ai-result');
    const aiResultWords = document.getElementById('cl-ai-result-words');

    function openAiModal() {
      const resume = ResumeState.get();
      const cl = resume.coverLetter || resume.cover_letter || {};
      if (aiRoleInput) aiRoleInput.value = resume.personal?.title || resume.personal?.jobTarget || '';
      if (aiCompanyInput) aiCompanyInput.value = cl.companyName || '';
      if (aiManagerInput) aiManagerInput.value = cl.hiringManager || '';
      aiResultWrap?.classList.add('d-none');
      applyAiBtn?.classList.add('d-none');
      aiModal?.classList.remove('d-none');
    }

    function hideAiModal() {
      aiModal?.classList.add('d-none');
    }

    aiHelpBtn?.addEventListener('click', openAiModal);
    closeAiModal?.addEventListener('click', hideAiModal);
    cancelAiBtn?.addEventListener('click', hideAiModal);

    generateAiBtn?.addEventListener('click', async () => {
      const role = aiRoleInput?.value.trim() || 'Professional';
      const company = aiCompanyInput?.value.trim() || 'Target Company';
      const manager = aiManagerInput?.value.trim() || '';
      const tone = aiToneSelect?.value || 'professional';
      const highlights = aiHighlightsInput?.value.trim() || '';

      generateAiBtn.disabled = true;
      generateAiBtn.innerHTML = '<span>⏳</span> Generating...';

      try {
        const resp = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'cover_letter',
            job_title: role,
            context: {
              companyName: company,
              hiringManager: manager,
              tone: tone,
              highlights: highlights
            }
          })
        });

        if (!resp.ok) {
          throw new Error(`AI generation returned ${resp.status}`);
        }

        const data = await resp.json();
        const generated = data.result || '';

        if (aiResultText && aiResultWrap) {
          aiResultText.value = generated;
          const words = generated.trim().split(/\s+/).filter(Boolean).length;
          if (aiResultWords) aiResultWords.textContent = `${words} words`;
          aiResultWrap.classList.remove('d-none');
          applyAiBtn?.classList.remove('d-none');
        }
      } catch (err) {
        console.error('Failed to generate cover letter:', err);
        alert('Could not generate cover letter at this time. Please try again.');
      } finally {
        generateAiBtn.disabled = false;
        generateAiBtn.innerHTML = '✦ Regenerate Letter';
      }
    });

    applyAiBtn?.addEventListener('click', () => {
      if (aiResultText && inBody) {
        const text = aiResultText.value;
        inBody.value = text;
        ResumeState.update('coverLetter.body', text);
        updateCounters(text);
        hideAiModal();
      }
    });

    // Subscribe to state changes
    ResumeState.subscribe(syncStateToInputs);
    syncStateToInputs(ResumeState.get());
  }

  // ---- Init -----------------------------------------------------------------

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get('id');
    const secureToken = params.get('token');
    const requestedDocType = params.get('doc_type');
    const loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();

    if (secureToken) {
      try {
        const found = await ResumeStorage.loadBySecureToken(secureToken);
        if (found) {
          ResumeState.replace({ ...found.content, id: found.id, template: found.template, docType: found.doc_type });
        }
      } catch (err) {
        console.error('Could not load resume via encrypted token:', err);
      }
    } else if (loggedIn && resumeId) {
      ResumeStorage.setSyncMode('server');
      try {
        const found = await ResumeStorage.loadOneFromServer(resumeId, Auth.getToken());
        if (found) {
          ResumeState.replace({ ...found.content, id: found.id, template: found.template, docType: found.doc_type });
        }
      } catch (err) {
        console.error('Could not load the requested resume, showing local draft instead:', err);
      }
    }

    if (requestedDocType === 'cover_letter' || ResumeState.get().docType === 'cover_letter') {
      ResumeState.update('docType', 'cover_letter');
      const curTpl = ResumeState.get().template;
      if (!curTpl || !curTpl.startsWith('cl-')) {
        ResumeState.setTemplate('cl-modern');
      }
    }

    initCoverLetterEditor();
    renderSectionList();
    renderForm();
    renderPreview(ResumeState.get());

    const initialView = params.get('view') || (params.get('panel') === 'design' ? 'customize' : 'edit');
    showView(initialView);

    // Dashboard's "Customize" button links here with &panel=design to jump
    // straight into the Design & Photo tab instead of the content forms.
    if (params.get('panel') === 'design') {
      window.__showCustomizeView?.();
    }
  }
  boot();
})();
