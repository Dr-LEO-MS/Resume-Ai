/**
 * pdf-export.js
 * ---------------------------------------------------------------------------
 * High-Resolution Multi-Page PDF, Word (DOCX), and Text export engine.
 * Adheres strictly to physical A4 dimensions (210mm × 297mm) across standard DPIs:
 *   - 300 DPI (High-Quality Print): 2480 × 3508 px
 *   - 150 DPI (Draft Print / Flyers): 1240 × 1754 px
 *   - 96 DPI (Standard CSS Screen): 794 × 1123 px
 *   - 72 DPI (Web / Standard Screen): 595 × 842 px
 * ---------------------------------------------------------------------------
 */

const PDFExport = (() => {
  // DPI to html2canvas scale mapping (base 96 DPI CSS screen resolution)
  const DPI_CONFIG = {
    300: { scale: 3.1234257, label: '300 DPI (High-Quality Print: 2480 × 3508 px)' },
    150: { scale: 1.5617128, label: '150 DPI (Draft Print: 1240 × 1754 px)' },
    96:  { scale: 1.0,       label: '96 DPI (Standard: 794 × 1123 px)' },
    72:  { scale: 0.7493703, label: '72 DPI (Web: 595 × 842 px)' }
  };

  /**
   * Client-side High-Resolution Multi-Page A4 PDF Export using jsPDF and html2canvas.
   * Renders each separated A4 page into exact 210mm × 297mm sheets.
   */
  async function exportViaPDF(resume, { dpi = 300, filename = null } = {}) {
    showExportToast('Preparing high-quality multi-page PDF...');

    try {
      // 1. Wait for web fonts to finish loading so bounding box measurements are exact
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Ensure libraries are available
      const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
      const html2canvasFn = window.html2canvas;

      if (!jsPDFClass || !html2canvasFn) {
        console.warn('Client-side PDF libraries unavailable, falling back to print dialog.');
        return exportViaPrint(resume);
      }

      // Create an off-screen staging area for measurement and capture
      let exportContainer = document.getElementById('__pdf_export_staging__');
      if (!exportContainer) {
        exportContainer = document.createElement('div');
        exportContainer.id = '__pdf_export_staging__';
        document.body.appendChild(exportContainer);
      }
      // Keep visibility visible so html2canvas renders pixels correctly while hiding from user view
      exportContainer.style.cssText = 'position:fixed;left:0;top:0;width:794px;opacity:0;pointer-events:none;z-index:-9999;';

      // Paginate the resume into discrete A4 pages
      TemplateEngine.paginate(resume, exportContainer);
      const pageElements = exportContainer.querySelectorAll('.resume-page');

      if (!pageElements || pageElements.length === 0) {
        throw new Error('No resume pages were rendered for export.');
      }

      // Wait for any images (profile photos) in the pages to complete loading
      const imgs = Array.from(exportContainer.querySelectorAll('img'));
      if (imgs.length > 0) {
        await Promise.all(imgs.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));
      }

      const totalPages = pageElements.length;
      showExportToast(`Rendering ${totalPages} A4 page${totalPages > 1 ? 's' : ''} at ${dpi} DPI...`);

      const scale = (DPI_CONFIG[dpi] && DPI_CONFIG[dpi].scale) || DPI_CONFIG[300].scale;

      // Initialize jsPDF with standard A4 sheet in portrait mode
      const pdf = new jsPDFClass({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];

        // Detect background color to prevent transparency issues in dark or custom themes
        const computedBg = window.getComputedStyle(pageEl).backgroundColor;
        const pageBg = (!computedBg || computedBg === 'rgba(0, 0, 0, 0)' || computedBg === 'transparent') ? '#ffffff' : computedBg;

        // High-resolution canvas capture
        const canvas = await html2canvasFn(pageEl, {
          scale: scale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: pageBg,
          logging: false,
          width: 794,
          height: 1123,
          windowWidth: 794,
          windowHeight: 1123,
          scrollX: 0,
          scrollY: 0,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        // 210mm x 297mm full-bleed A4 sheet dimensions
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      // Clean up staging container
      exportContainer.innerHTML = '';

      const outName = filename || `${(resume.personal?.fullName || 'Resume').trim().replace(/\s+/g, '_')}_Resume.pdf`;
      pdf.save(outName);

      showExportToast('PDF Downloaded successfully!', 2500);
    } catch (err) {
      console.error('PDF export error:', err);
      showExportToast('Exporting via standard print dialog...', 2000);
      exportViaPrint(resume);
    }
  }

  function showExportToast(msg, duration = 3000) {
    let toast = document.getElementById('export-toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'export-toast-notification';
      toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1e293b;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.25);z-index:99999;transition:all 0.3s ease;display:flex;align-items:center;gap:8px;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    if (duration > 0) {
      setTimeout(() => {
        if (toast) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px)';
        }
      }, duration);
    }
  }

  function exportViaPrint(resume) {
    // Generate all discrete A4 pages for multi-page print fidelity
    const html = TemplateEngine.paginate(resume);
    let iframe = document.getElementById('print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${(resume.personal?.fullName || 'Resume').replace(/</g, '')} — Resume</title>
          <link rel="stylesheet" href="/static/css/styles.css">
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { background: #fff; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .resume-pages-container { display: block !important; gap: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
            .resume-page {
              width: 210mm !important;
              height: 297mm !important;
              min-height: 297mm !important;
              max-height: 297mm !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .resume-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>`);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print iframe error:', e);
      }
    }, 400);
  }

  function _resumeSlug(resume) {
    const isCL = resume.docType === 'cover_letter' || resume.doc_type === 'cover_letter';
    const fallback = isCL ? 'Cover_Letter' : 'Resume';
    const full = (resume.personal?.fullName || fallback).replace(/[<>:"/\\|?*]+/g, '').trim().replace(/\s+/g, '_');
    const suffix = isCL ? '_Cover_Letter' : '_Resume';
    return `${full || fallback}${suffix}`;
  }

  function _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function supportsClientRasterPdf() {
    return !!(window.jspdf?.jsPDF || window.jsPDF) && !!window.html2canvas;
  }

  // ---- Loading overlay (works on any page; no template edits needed) -------
  function showExportLoading(message) {
    let overlay = document.getElementById('export-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'export-loading-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:100000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
      const card = document.createElement('div');
      card.style.cssText = 'background:#ffffff;border-radius:12px;padding:22px 30px;box-shadow:0 10px 40px rgba(0,0,0,0.25);display:flex;align-items:center;gap:14px;max-width:420px;text-align:left;';
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      spinner.style.cssText = 'width:26px;height:26px;border-width:3px;color:#2563eb;flex:0 0 auto;';
      const text = document.createElement('div');
      text.id = 'export-loading-text';
      text.style.cssText = 'color:#1e293b;font-size:14px;font-weight:600;line-height:1.4;';
      card.appendChild(spinner);
      card.appendChild(text);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }
    document.getElementById('export-loading-text').textContent = message;
    overlay.style.display = 'flex';
  }

  function updateExportLoading(message) {
    const text = document.getElementById('export-loading-text');
    if (text) text.textContent = message;
  }

  function hideExportLoading() {
    const overlay = document.getElementById('export-loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  /** Try the server-side vector PDF endpoint and download it on success. */
  async function downloadPdfServer(resume, token = null) {
    const res = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ resume }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error((j && j.detail) || `Server returned ${res.status}`);
    }
    const blob = await res.blob();
    _downloadBlob(blob, `${_resumeSlug(resume)}_Resume.pdf`);
  }

  /**
   * PRIMARY download entry point.
   * Server (vector PDF) → browser print-to-PDF → raster jsPDF (last resort).
   */
  async function downloadPdf(resume, { token = null, allowPrintFallback = true } = {}) {
    // 1) Server-side vector PDF (best fidelity, small file, clickable links).
    showExportLoading('Preparing high-quality PDF on server…');
    try {
      await downloadPdfServer(resume, token);
      hideExportLoading();
      showExportToast('PDF downloaded successfully ✓', 2500);
      return;
    } catch (serverErr) {
      console.warn('Server PDF unavailable, using browser fallback:', serverErr);
    }

    // 2) Browser print-to-PDF (vector, preserves links & text).
    if (allowPrintFallback) {
      updateExportLoading('Server export unavailable. Opening print dialog (choose "Save as PDF")…');
      showExportToast('Server PDF unavailable — using browser print. Choose "Save as PDF" as the destination.', 5000);
      try {
        exportViaPrint(resume);
        hideExportLoading();
        return;
      } catch (printErr) {
        console.error('Print fallback failed:', printErr);
      }
    }

    // 3) Raster jsPDF + html2canvas last resort.
    if (supportsClientRasterPdf()) {
      updateExportLoading('Rendering PDF in your browser…');
      hideExportLoading();
      try {
        await exportViaPDF(resume, { dpi: 300 });
        return;
      } catch (rasterErr) {
        console.error('Raster PDF fallback failed:', rasterErr);
      }
    }

    hideExportLoading();
    showExportToast('PDF generation failed. Please try again or use "Print / Standard PDF".', 6000);
  }

  async function exportViaServer(resume, { format = 'pdf', token = null } = {}) {
    if (format === 'pdf') {
      return downloadPdf(resume, { token });
    }

    try {
      const res = await fetch('/api/export/' + format, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ resume }),
      });
      if (!res.ok) throw new Error('Export failed on server');
      const blob = await res.blob();
      _downloadBlob(blob, `${_resumeSlug(resume)}.${format === 'docx' ? 'docx' : 'pdf'}`);
    } catch (err) {
      console.warn('Server export failed, executing client-side fallback download:', err);
      if (format === 'docx') {
        exportViaDocxFallback(resume);
      } else if (format === 'txt') {
        exportViaText(resume);
      } else {
        exportViaPDF(resume, { dpi: 300 });
      }
    }
  }

  function exportViaDocxFallback(resume) {
    const p = resume.personal || {};
    const isCL = resume.docType === 'cover_letter' || resume.doc_type === 'cover_letter';

    if (isCL) {
      const cl = resume.coverLetter || resume.cover_letter || {};
      let clText = `${p.fullName || 'Applicant'}\n`;
      if (p.title) clText += `${p.title}\n`;
      clText += `${[p.email, p.phone, p.location || p.address, p.linkedin, p.website].filter(Boolean).join(' | ')}\n\n`;
      clText += `========================================================================\n\n`;
      if (cl.date) clText += `${cl.date}\n\n`;
      if (cl.hiringManager) clText += `${cl.hiringManager}\n`;
      if (cl.companyName) clText += `${cl.companyName}\n`;
      if (cl.companyAddress) clText += `${cl.companyAddress}\n`;
      clText += `\n${cl.salutation || 'Dear Hiring Team,'}\n\n`;
      clText += `${cl.body || ''}\n\n`;
      clText += `${cl.signOff || 'Sincerely,'}\n`;
      clText += `${cl.signature || p.fullName || ''}\n`;

      const blob = new Blob([clText], { type: 'application/msword;charset=utf-8' });
      _downloadBlob(blob, `${_resumeSlug(resume)}.doc`);
      return;
    }

    let text = `${p.fullName || 'Resume'}\n`;
    if (p.title) text += `${p.title}\n`;
    text += `${[p.email, p.phone, p.location, p.linkedin, p.github, p.website].filter(Boolean).join(' | ')}\n\n`;
    text += `========================================================================\n\n`;

    (resume.sectionOrder || []).forEach(sec => {
      if (resume.hiddenSections && resume.hiddenSections.includes(sec)) return;
      if (sec === 'summary' && resume.summary) {
        text += `PROFILE SUMMARY\n----------------------------------------\n${resume.summary}\n\n`;
      } else if (sec === 'experience' && resume.experience && resume.experience.length) {
        text += `WORK EXPERIENCE\n----------------------------------------\n`;
        resume.experience.forEach(e => {
          text += `${e.role || ''} at ${e.company || ''} (${e.start || ''} - ${e.current ? 'Present' : e.end || ''})\n`;
          if (e.location) text += `Location: ${e.location}\n`;
          (e.bullets || []).filter(Boolean).forEach(b => {
            text += `  • ${b}\n`;
          });
          text += `\n`;
        });
      } else if (sec === 'education' && resume.education && resume.education.length) {
        text += `EDUCATION\n----------------------------------------\n`;
        resume.education.forEach(e => {
          text += `${e.degree || ''} ${e.field ? 'in ' + e.field : ''} - ${e.school || ''} (${e.start || ''} - ${e.end || ''})\n`;
          if (e.gpa) text += `GPA: ${e.gpa}\n`;
          if (e.honors) text += `Honors: ${e.honors}\n`;
          if (e.coursework) text += `Coursework: ${e.coursework}\n`;
          text += `\n`;
        });
      } else if (sec === 'skills' && resume.skills) {
        text += `SKILLS\n----------------------------------------\n`;
        if (Array.isArray(resume.skills)) {
          text += `${resume.skills.join(', ')}\n\n`;
        } else {
          if (resume.skills.technical?.length) text += `Technical: ${resume.skills.technical.join(', ')}\n`;
          if (resume.skills.tools?.length) text += `Tools: ${resume.skills.tools.join(', ')}\n`;
          if (resume.skills.soft?.length) text += `Soft Skills: ${resume.skills.soft.join(', ')}\n`;
          text += `\n`;
        }
      } else if (sec === 'projects' && resume.projects && resume.projects.length) {
        text += `PROJECTS\n----------------------------------------\n`;
        resume.projects.forEach(pr => {
          text += `${pr.name || ''}${pr.role ? ' (' + pr.role + ')' : ''}${pr.link ? ' - ' + pr.link : ''}\n`;
          if (pr.description) text += `${pr.description}\n`;
          text += `\n`;
        });
      } else if (sec === 'certifications' && resume.certifications && resume.certifications.length) {
        text += `CERTIFICATIONS\n----------------------------------------\n`;
        resume.certifications.forEach(c => {
          text += `${c.name || ''} - ${c.issuer || ''} (${c.date || ''})\n`;
        });
        text += `\n`;
      } else if (sec === 'languages' && resume.languages && resume.languages.length) {
        text += `LANGUAGES\n----------------------------------------\n`;
        text += `${resume.languages.map(l => `${l.name} (${l.level})`).join(', ')}\n\n`;
      }
    });

    const blob = new Blob([text], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${_resumeSlug(resume)}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportViaText(resume) {
    const p = resume.personal || {};
    const isCL = resume.docType === 'cover_letter' || resume.doc_type === 'cover_letter';

    if (isCL) {
      const cl = resume.coverLetter || resume.cover_letter || {};
      let clText = `${p.fullName || 'APPLICANT'}\n`;
      if (p.title) clText += `${p.title.toUpperCase()}\n`;
      clText += `${[p.email, p.phone, p.location || p.address, p.linkedin, p.website].filter(Boolean).join(' | ')}\n\n`;
      clText += `${'='.repeat(60)}\n\n`;
      if (cl.date) clText += `${cl.date}\n\n`;
      if (cl.hiringManager) clText += `${cl.hiringManager}\n`;
      if (cl.companyName) clText += `${cl.companyName}\n`;
      if (cl.companyAddress) clText += `${cl.companyAddress}\n`;
      clText += `\n${cl.salutation || 'Dear Hiring Team,'}\n\n`;
      clText += `${cl.body || ''}\n\n`;
      clText += `${cl.signOff || 'Sincerely,'}\n`;
      clText += `${cl.signature || p.fullName || ''}\n`;

      const blob = new Blob([clText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${_resumeSlug(resume)}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
    const p = resume.personal || {};
    let text = `${p.fullName || 'RESUME'}\n`;
    if (p.title) text += `${p.title.toUpperCase()}\n`;
    text += `${[p.email, p.phone, p.location, p.linkedin, p.github, p.website].filter(Boolean).join(' | ')}\n\n`;
    text += `${'='.repeat(60)}\n\n`;

    (resume.sectionOrder || []).forEach(sec => {
      if (resume.hiddenSections && resume.hiddenSections.includes(sec)) return;
      if (sec === 'summary' && resume.summary) {
        text += `PROFILE SUMMARY\n${'-'.repeat(30)}\n${resume.summary}\n\n`;
      } else if (sec === 'experience' && resume.experience && resume.experience.length) {
        text += `WORK EXPERIENCE\n${'-'.repeat(30)}\n`;
        resume.experience.forEach(e => {
          text += `${e.role || 'Role'} | ${e.company || 'Company'} | ${e.start || ''} - ${e.current ? 'Present' : e.end || ''}\n`;
          if (e.location) text += `Location: ${e.location}\n`;
          (e.bullets || []).filter(Boolean).forEach(b => {
            text += `* ${b}\n`;
          });
          text += `\n`;
        });
      } else if (sec === 'education' && resume.education && resume.education.length) {
        text += `EDUCATION\n${'-'.repeat(30)}\n`;
        resume.education.forEach(e => {
          text += `${e.degree || ''} ${e.field ? 'in ' + e.field : ''} | ${e.school || ''} | ${e.start || ''} - ${e.end || ''}\n`;
          if (e.gpa) text += `GPA: ${e.gpa}\n`;
          if (e.honors) text += `Honors: ${e.honors}\n`;
          if (e.coursework) text += `Coursework: ${e.coursework}\n`;
          text += `\n`;
        });
      } else if (sec === 'skills' && resume.skills) {
        text += `SKILLS\n${'-'.repeat(30)}\n`;
        if (Array.isArray(resume.skills)) {
          text += `${resume.skills.join(', ')}\n\n`;
        } else {
          if (resume.skills.technical?.length) text += `Technical: ${resume.skills.technical.join(', ')}\n`;
          if (resume.skills.tools?.length) text += `Tools: ${resume.skills.tools.join(', ')}\n`;
          if (resume.skills.soft?.length) text += `Soft Skills: ${resume.skills.soft.join(', ')}\n`;
          text += `\n`;
        }
      } else if (sec === 'projects' && resume.projects && resume.projects.length) {
        text += `PROJECTS\n${'-'.repeat(30)}\n`;
        resume.projects.forEach(pr => {
          text += `${pr.name || ''}${pr.role ? ' (' + pr.role + ')' : ''}${pr.link ? ' - ' + pr.link : ''}\n`;
          if (pr.description) text += `${pr.description}\n`;
          text += `\n`;
        });
      } else if (sec === 'certifications' && resume.certifications && resume.certifications.length) {
        text += `CERTIFICATIONS\n${'-'.repeat(30)}\n`;
        resume.certifications.forEach(c => {
          text += `${c.name || ''} - ${c.issuer || ''} (${c.date || ''})\n`;
        });
        text += `\n`;
      } else if (sec === 'languages' && resume.languages && resume.languages.length) {
        text += `LANGUAGES\n${'-'.repeat(30)}\n`;
        text += `${resume.languages.map(l => `${l.name} (${l.level})`).join(', ')}\n\n`;
      }
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(p.fullName || 'resume').replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function createShareLink(resume, token = null) {
    const res = await fetch('/api/export/share-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ resume }),
    });
    if (!res.ok) throw new Error('Could not create share link');
    return res.json();
  }

  return {
    exportViaPDF,
    exportViaPrint,
    exportViaServer,
    exportViaDocxFallback,
    exportViaText,
    createShareLink,
    downloadPdf,
    supportsClientRasterPdf,
    DPI_CONFIG,
  };
})();
