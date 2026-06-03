// ── First-time user onboarding tour ──────────────────────────────────────────
// Self-contained spotlight tour. Shows on first visit (localStorage flag).
// To activate: add <script src="onboarding.js"></script> to index.html
//              just before </body>.
// To reset for testing: localStorage.removeItem('occurd_onboarded')
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const STORAGE_KEY = 'occurd_onboarded';

  // ── Tour step definitions ──────────────────────────────────────────────────
  // target:   CSS selector for the element to spotlight
  // title:    bold heading in the tooltip
  // text:     instruction text
  // position: preferred tooltip placement — 'right' | 'left' | 'top' | 'bottom'
  // waitFor:  optional — function that returns true when the step is ready to advance
  //           (used for steps triggered by user action rather than Next button)
  const STEPS = [
    {
      target:   '.leaflet-draw-draw-polygon',
      title:    '① Draw your study area',
      text:     'Click this button, then click on the map to draw a polygon around the area you want to search. Double-click to finish.',
      position: 'right',
    },
    {
      target:   '#taxonTrigger',
      title:    '② Choose species groups',
      text:     'Select which taxon groups to include — birds, plants, insects, and more — or leave it as "All taxa" to get everything.',
      position: 'right',
    },
    {
      target:   '#dateFrom',
      title:    '③ Set your date range',
      text:     'Narrow results to a specific time window. The defaults cover recent years, but you can go back as far as records exist.',
      position: 'right',
    },
    {
      target:   '#runBtn',
      title:    '④ Fetch records',
      text:     'Click here to search GBIF for occurrences inside your polygon. Results appear on the map and in the species list on the right.',
      position: 'right',
    },
    {
      target:   null,   // no spotlight — centred summary card
      title:    "You're all set",
      text:     'Records show as coloured dots by taxon group. Click any dot to see species details and photos. Click a taxon heading in the species list to show or hide that group.',
      position: 'center',
    },
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  let currentStep = 0;
  let overlay, tooltip, spotlight;

  // ── Entry point ───────────────────────────────────────────────────────────
  function init() {
    if (localStorage.getItem(STORAGE_KEY)) return; // already seen
    // Poll until both the data disclaimer and mobile-screen banner are dismissed,
    // then wait a short moment before starting so the UI settles.
    function tryStart() {
      const disclaimer = document.getElementById('disclaimerModal');
      const banner     = document.getElementById('mobileBanner');
      const disclaimerOpen  = disclaimer && disclaimer.classList.contains('open');
      const bannerVisible   = banner     && banner.style.display === 'flex';
      if (disclaimerOpen || bannerVisible) {
        setTimeout(tryStart, 350);
        return;
      }
      setTimeout(start, 500);
    }
    // Initial delay so map and sidebar finish rendering before first check
    setTimeout(tryStart, 800);
  }

  function start() {
    buildDOM();
    showStep(0);
  }

  // ── DOM construction ───────────────────────────────────────────────────────
  function buildDOM() {
    // Semi-transparent overlay
    overlay = document.createElement('div');
    overlay.id = 'ob-overlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:99990;',
      'background:rgba(0,0,0,0.32);',
      'pointer-events:none;',
      'transition:opacity 0.25s;',
    ].join('');

    // Spotlight cutout
    spotlight = document.createElement('div');
    spotlight.id = 'ob-spotlight';
    spotlight.style.cssText = [
      'position:fixed;z-index:99991;',
      'box-shadow:0 0 0 9999px rgba(0,0,0,0.32);',
      'border-radius:6px;',
      'pointer-events:none;',
      'transition:all 0.25s;',
    ].join('');

    // Tooltip card
    tooltip = document.createElement('div');
    tooltip.id = 'ob-tooltip';
    tooltip.style.cssText = [
      'position:fixed;z-index:99995;',
      'background:#f9f8f6;border-radius:10px;',
      'box-shadow:0 4px 24px rgba(0,0,0,0.13);',
      'border:1px solid rgba(0,0,0,0.07);',
      'padding:18px 20px 14px;width:260px;',
      'font-family:var(--font-sans,system-ui,sans-serif);',
      'transition:left 0.2s,top 0.2s;',
    ].join('');

    document.body.appendChild(overlay);
    document.body.appendChild(spotlight);
    document.body.appendChild(tooltip);
  }

  // ── Show a step ────────────────────────────────────────────────────────────
  function showStep(idx) {
    currentStep = idx;
    const step = STEPS[idx];
    const isLast = idx === STEPS.length - 1;
    const isCentre = step.position === 'center' || !step.target;

    // Position spotlight
    if (!isCentre && step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        const PAD = 8;
        spotlight.style.cssText += [
          ';display:block',
          ';left:'   + (r.left   - PAD) + 'px',
          ';top:'    + (r.top    - PAD) + 'px',
          ';width:'  + (r.width  + PAD * 2) + 'px',
          ';height:' + (r.height + PAD * 2) + 'px',
        ].join('');
        spotlight.style.display = 'block';
        overlay.style.background = 'transparent'; // shadow from spotlight instead
      }
    } else {
      spotlight.style.display = 'none';
      overlay.style.background = 'rgba(0,0,0,0.55)';
      overlay.style.pointerEvents = 'auto'; // block clicks on centred card
    }

    // Build tooltip content
    const stepLabel = '<div style="font-size:10px;color:#9b9890;margin-bottom:6px;letter-spacing:0.04em;">' +
      'Step ' + (idx + 1) + ' of ' + STEPS.length + '</div>';
    const title = '<div style="font-size:14px;font-weight:700;color:#1c1b18;margin-bottom:6px;">' +
      step.title + '</div>';
    const text = '<div style="font-size:12px;color:#444;line-height:1.6;margin-bottom:14px;">' +
      step.text + '</div>';
    const skipBtn = !isLast
      ? '<button id="ob-skip" style="background:none;border:none;font-size:11px;color:#9b9890;cursor:pointer;padding:0;font-family:inherit;">Skip tour</button>'
      : '';
    const nextBtn = '<button id="ob-next" style="' +
      'background:#1a5c34;color:#fff;border:none;border-radius:6px;' +
      'padding:7px 18px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;' +
      '">' + (isLast ? 'Done' : 'Next →') + '</button>';

    tooltip.innerHTML =
      stepLabel + title + text +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        skipBtn + nextBtn +
      '</div>';

    // Wire buttons
    const nextEl = document.getElementById('ob-next');
    const skipEl = document.getElementById('ob-skip');
    if (nextEl) nextEl.addEventListener('click', isLast ? finish : () => showStep(idx + 1));
    if (skipEl) skipEl.addEventListener('click', finish);

    // Position tooltip relative to spotlight target
    positionTooltip(step);
  }

  // ── Tooltip positioning ────────────────────────────────────────────────────
  function positionTooltip(step) {
    tooltip.style.left = '';
    tooltip.style.top  = '';
    tooltip.style.transform = '';

    if (step.position === 'center' || !step.target) {
      tooltip.style.left      = '50%';
      tooltip.style.top       = '50%';
      tooltip.style.transform = 'translate(-50%,-50%)';
      return;
    }

    const el = step.target ? document.querySelector(step.target) : null;
    if (!el) {
      tooltip.style.left = '50%';
      tooltip.style.top  = '50%';
      tooltip.style.transform = 'translate(-50%,-50%)';
      return;
    }

    const r   = el.getBoundingClientRect();
    const TW  = 260 + 24; // tooltip width + margin
    const TH  = tooltip.offsetHeight || 160;
    const GAP = 18;

    let left, top;
    const pos = step.position;

    if (pos === 'right' && r.right + GAP + TW < window.innerWidth) {
      left = r.right + GAP;
      top  = Math.max(10, r.top + r.height / 2 - TH / 2);
    } else if (pos === 'left' && r.left - GAP - TW > 0) {
      left = r.left - GAP - TW;
      top  = Math.max(10, r.top + r.height / 2 - TH / 2);
    } else if (pos === 'bottom' || r.right + GAP + TW >= window.innerWidth) {
      left = Math.max(10, r.left + r.width / 2 - TW / 2);
      top  = r.bottom + GAP;
    } else {
      left = Math.max(10, r.left + r.width / 2 - TW / 2);
      top  = r.top - TH - GAP;
    }

    // Keep within viewport
    left = Math.min(left, window.innerWidth  - TW  - 10);
    top  = Math.min(top,  window.innerHeight - TH  - 10);

    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
  }

  // ── Finish ─────────────────────────────────────────────────────────────────
  function finish() {
    localStorage.setItem(STORAGE_KEY, '1');
    [overlay, spotlight, tooltip].forEach(el => {
      if (el) el.style.opacity = '0';
      setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 300);
    });
  }

  // ── Keyboard escape ────────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && tooltip && tooltip.parentNode) finish();
  });

  // ── Boot ───────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
