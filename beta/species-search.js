// ── NZ species search ─────────────────────────────────────────────────────────
// Handles the NZ species field (NZOR + NVS autocomplete), NZ gate,
// and exposes window._nzorSearch / window._nvsSearch for the taxonomy browser.
(function() {
  const NZ_BOUNDS    = { minLat: -52, maxLat: -29, minLng: 163, maxLng: 180 };
  const SAMOA_BOUNDS = { minLat: -15.0, maxLat: -13.0, minLng: -173.5, maxLng: -168.0 };
  const NZOR_URL  = 'https://raw.githubusercontent.com/rutherfordecology/but-is-it-threatened/main/nzor_names.json';
  const NVS_URL   = 'https://raw.githubusercontent.com/rutherfordecology/but-is-it-threatened/main/nvs.json';

  const field  = document.getElementById('spField');
  const input  = document.getElementById('spInput');
  const clrBtn = document.getElementById('spClear');

  // Dropdown appended to body to avoid sidebar clipping
  const drop = document.createElement('div');
  drop.id = 'spDrop';
  document.body.appendChild(drop);

  let nzorData     = null;   // loaded lazily
  let nzorPromise  = null;   // shared load promise — prevents duplicate fetches
  let nzorLoading  = false;
  let nvsData      = null;   // NVS codes: {code → {sci, pref?, prefSci?}}
  let nvsPromise   = null;
  let nzorSciIndex = null;   // built once: lowercase sci name → [vernacular display names]
  let selectedKey  = null;   // GBIF taxon key once resolved
  let debounce     = null;
  let focusIdx     = -1;
  let curItems     = [];

  window.getSpeciesTaxonKey = () => selectedKey;
  window._nzorReady = () => !!nzorData;

  // Reverse index: sci name (lowercase) → vernacular display names from NZOR
  function buildSciIndex() {
    if (nzorSciIndex || !nzorData) return;
    nzorSciIndex = {};
    for (const val of Object.values(nzorData)) {
      if (val.cls === 'v' && val.sci) {
        const k = val.sci.toLowerCase();
        if (!nzorSciIndex[k]) nzorSciIndex[k] = [];
        if (!nzorSciIndex[k].includes(val.n)) nzorSciIndex[k].push(val.n);
      }
    }
  }

  // Returns vernacular name(s) for a scientific name — used by species checklist
  window.getNzorVernacular = function(sciName) {
    if (!sciName) return '';
    if (!nzorSciIndex) buildSciIndex();
    if (!nzorSciIndex) return '';
    const hits = nzorSciIndex[sciName.toLowerCase()];
    if (!hits || !hits.length) return '';
    // Deduplicate and return up to 2 names joined
    const uniq = hits.filter((v, i, a) => a.indexOf(v) === i);
    return uniq.slice(0, 2).join(' · ');
  };

  // Exposed so buildChecklist can trigger a load and re-render when NZOR arrives
  window.ensureNzorLoaded = function() {
    if (nzorData) return Promise.resolve(true);
    return ensureData(true);
  };

  // Expose search function so the taxonomy browser can use it for common/Māori name lookup
  window._nzorSearch = function(q) { return nzorData ? search(q) : []; };

  // Load NVS codes file independently (small file, loads fast)
  function ensureNvs() {
    if (nvsData) return Promise.resolve(true);
    if (!nvsPromise) {
      nvsPromise = fetch(NVS_URL)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => { nvsData = data; nvsPromise = null; return true; })
        .catch(e => { console.warn('NVS load failed:', e); nvsPromise = null; return false; });
    }
    return nvsPromise;
  }

  // Search NVS codes — exact match first, then prefix matches
  function searchNvs(q) {
    if (!nvsData) return [];
    const norm = q.toLowerCase().trim().replace(/\s+/g, '');
    if (norm.length < 2) return [];
    const results = [];
    const seen = new Set();
    // Resolve entry, following pref redirect once
    function resolveEntry(code) {
      const e = nvsData[code];
      if (!e) return null;
      if (e.pref && nvsData[e.pref]) {
        return { code: e.pref, sci: e.prefSci || nvsData[e.pref].sci || e.sci };
      }
      return { code, sci: e.sci };
    }
    // Exact match
    const exact = resolveEntry(norm);
    if (exact && !seen.has(exact.code)) {
      seen.add(exact.code);
      results.push({ cls: 'nvs', n: exact.sci, sci: exact.sci, nvscode: norm, key: norm });
    }
    // Prefix matches
    for (const code of Object.keys(nvsData)) {
      if (results.length >= 8) break;
      if (code === norm || !code.startsWith(norm)) continue;
      const r = resolveEntry(code);
      if (r && !seen.has(r.code)) {
        seen.add(r.code);
        results.push({ cls: 'nvs', n: r.sci, sci: r.sci, nvscode: code, key: code });
      }
    }
    return results;
  }

  window._nvsSearch = function(q) { return nvsData ? searchNvs(q) : []; };

  // Show field only when centred over NZ or Samoa
  function checkNZGate() {
    const c = map.getCenter();
    // Normalise longitude to [-180, 180] — Leaflet uses a continuous axis so panning
    // past the antimeridian gives values like 189 instead of -171 for Samoa.
    let lng = ((c.lng + 180) % 360 + 360) % 360 - 180;
    const inNZ    = c.lat >= NZ_BOUNDS.minLat    && c.lat <= NZ_BOUNDS.maxLat    &&
                    lng    >= NZ_BOUNDS.minLng    && lng    <= NZ_BOUNDS.maxLng;
    const inSamoa = c.lat >= SAMOA_BOUNDS.minLat && c.lat <= SAMOA_BOUNDS.maxLat &&
                    lng    >= SAMOA_BOUNDS.minLng && lng    <= SAMOA_BOUNDS.maxLng;
    field.style.display = (inNZ || inSamoa) ? 'block' : 'none';
    if (inNZ && !nzorData && !nzorLoading) ensureData(true);
    if (inNZ && !nvsData && !nvsPromise) ensureNvs();
  }
  map.on('moveend', checkNZGate);
  map.on('zoomend', checkNZGate);
  setTimeout(checkNZGate, 600);
  setTimeout(checkNZGate, 2500);

  // Load NZOR names — shared promise so concurrent callers all wait on the same fetch
  async function ensureData(silent) {
    if (nzorData) return true;
    if (!nzorPromise) {
      nzorLoading = true;
      if (!silent) showDrop([{ _loading: true }]);
      nzorPromise = fetch(NZOR_URL)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => { nzorData = data; nzorLoading = false; nzorPromise = null; return true; })
        .catch(e => { console.warn('NZOR load failed:', e); nzorData = null; nzorLoading = false; nzorPromise = null; return false; });
    }
    return nzorPromise;
  }

  function normQuery(s) {
    // Strip macrons for matching, lowercase
    return s.toLowerCase()
      .replace(/[āÃā]/g, 'a').replace(/[ēĒ]/g, 'e')
      .replace(/[īĪ]/g, 'i').replace(/[ōŌ]/g, 'o')
      .replace(/[ūŪ]/g, 'u').trim();
  }

  function search(q) {
    if (!nzorData) return [];
    const norm = normQuery(q);
    if (norm.length < 2) return [];
    const starts = [], contains = [];
    for (const key of Object.keys(nzorData)) {
      if (key.startsWith(norm))    starts.push(key);
      else if (key.includes(norm)) contains.push(key);
    }
    // Starts-with always first; pad remaining slots with contains matches
    const top = starts.slice(0, 10);
    if (top.length < 10) top.push(...contains.slice(0, 10 - top.length));
    const results = top.map(k => ({ key: k, ...nzorData[k] }));

    // Genus option: single-word query that is the first word of 2+ scientific names
    if (!norm.includes(' ') && norm.length >= 3) {
      const genusPrefix = norm + ' ';
      const genusHits = starts.filter(k => k.startsWith(genusPrefix) && nzorData[k].cls !== 'v');
      if (genusHits.length >= 2) {
        const properGenus = norm.charAt(0).toUpperCase() + norm.slice(1);
        results.unshift({ key: '_genus_' + norm, n: properGenus, cls: 'g' });
      }
    }

    return results;
  }

  function posDrop() {
    const r = input.getBoundingClientRect();
    drop.style.left  = r.left + 'px';
    drop.style.top   = (r.bottom + 2) + 'px';
    drop.style.width = r.width + 'px';
  }

  function showDrop(items) {
    curItems = items; focusIdx = -1;
    drop.innerHTML = '';
    if (!items.length) { drop.style.display = 'none'; return; }
    if (items[0]._loading) {
      drop.innerHTML = '<div class="sp-loading">Loading NZ species names…</div>';
      posDrop(); drop.style.display = 'block'; return;
    }
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'sp-item';
      if (item.cls === 'g') {
        // Genus option — shown at top when query matches 2+ species in that genus
        el.innerHTML =
          '<div class="sp-sci">' + item.n + '</div>' +
          '<div class="sp-common sp-genus-tag">all species in this genus</div>';
      } else if (item.cls === 'nvs') {
        // NVS code match
        el.innerHTML =
          '<div class="sp-sci">' + item.sci + '</div>' +
          '<div class="sp-common"><span class="nvs-badge">NVS ' + item.nvscode.toUpperCase() + '</span></div>';
      } else {
        // vernacular entry: show common name + scientific
        // scientific entry: show scientific name only
        const isVern = item.cls === 'v';
        const sci    = isVern ? (item.sci || '') : item.n;
        const common = isVern ? item.n : '';
        el.innerHTML =
          '<div class="sp-sci">' + sci + '</div>' +
          (common ? '<div class="sp-common">' + common + '</div>' : '');
      }
      el.addEventListener('mousedown', e => { e.preventDefault(); selectItem(item); });
      drop.appendChild(el);
    });
    posDrop(); drop.style.display = 'block';
  }

  function hideDrop() { drop.style.display = 'none'; curItems = []; focusIdx = -1; }

  async function selectItem(item) {
    hideDrop();

    // ── Genus selection ───────────────────────────────────────────────────
    if (item.cls === 'g') {
      const genusName = item.n;
      input.value = 'all ' + genusName;
      input.classList.add('sp-active');
      let resolvedKey = null;
      try {
        // Primary: species/match — only accept if it actually returned a GENUS rank
        const r = await fetch('https://api.gbif.org/v1/species/match?verbose=false&rank=GENUS&name=' + encodeURIComponent(genusName));
        if (r.ok) {
          const j = await r.json();
          if (j.usageKey && j.rank === 'GENUS' && j.matchType !== 'NONE') {
            resolvedKey = j.usageKey;
          }
        }
      } catch(e) {}
      if (!resolvedKey) {
        // Fallback: backbone suggest API — look for an exact canonical name match at genus rank
        try {
          const r2 = await fetch('https://api.gbif.org/v1/species/suggest?datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&rank=GENUS&q=' + encodeURIComponent(genusName) + '&limit=10');
          if (r2.ok) {
            const arr = await r2.json();
            const exact = arr.find(x => x.rank === 'GENUS' && x.canonicalName &&
              x.canonicalName.toLowerCase() === genusName.toLowerCase());
            if (exact) resolvedKey = exact.key;
          }
        } catch(e2) {}
      }
      if (typeof window.addSpeciesEntry === 'function') {
        window.addSpeciesEntry('all ' + genusName, resolvedKey, resolvedKey ? null : genusName);
      }
      input.value = ''; input.classList.remove('sp-active'); selectedKey = null;
      return;
    }

    // ── Species selection ─────────────────────────────────────────────────
    // Resolve scientific name
    const sciName = (item.cls === 'v' || item.cls === 'nvs') ? (item.sci || item.n) : item.n;
    const displayName = item.cls === 'nvs'
      ? item.sci + ' (NVS ' + item.nvscode.toUpperCase() + ')'
      : item.n + (item.cls === 'v' && item.sci ? ' (' + item.sci + ')' : '');

    // Show resolving state briefly
    input.value = displayName;
    input.classList.add('sp-active');
    clrBtn.style.display = 'none';

    // Resolve GBIF taxon key
    let resolvedKey = null;
    try {
      const r = await fetch('https://api.gbif.org/v1/species/match?verbose=false&name=' + encodeURIComponent(sciName));
      if (r.ok) {
        const j = await r.json();
        resolvedKey = j.usageKey || j.speciesKey || null;
      }
    } catch(e) {}

    // Add to polygon list as a virtual species entry, then clear the input
    if (typeof window.addSpeciesEntry === 'function') {
      window.addSpeciesEntry(item.n, resolvedKey, resolvedKey ? null : sciName);
    }
    // Reset input ready for next species
    input.value = '';
    input.classList.remove('sp-active');
    selectedKey = null;
  }

  function clearSel() {
    selectedKey = null;
    input.value = '';
    input.classList.remove('sp-active');
    clrBtn.style.display = 'none';
    hideDrop();
    input.focus();
  }

  clrBtn.addEventListener('click', clearSel);

  input.addEventListener('input', () => {
    if (selectedKey) { selectedKey = null; input.classList.remove('sp-active'); clrBtn.style.display = 'none'; }
    const q = input.value.trim();
    if (q.length < 2) { hideDrop(); return; }
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const ok = await ensureData();
      if (!ok) { hideDrop(); return; }
      ensureNvs(); // kick off NVS load if not already loaded (non-blocking)
      const nvsResults  = searchNvs(q);
      const nzorResults = search(q);
      // NVS exact/prefix matches first, then NZOR
      showDrop([...nvsResults, ...nzorResults]);
    }, 200);
  });

  input.addEventListener('keydown', e => {
    const els = drop.querySelectorAll('.sp-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx = Math.min(focusIdx+1, els.length-1); els.forEach((el,i)=>el.classList.toggle('sp-focus',i===focusIdx)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx = Math.max(focusIdx-1,0); els.forEach((el,i)=>el.classList.toggle('sp-focus',i===focusIdx)); }
    else if (e.key === 'Enter' && focusIdx >= 0 && curItems[focusIdx]) { e.preventDefault(); selectItem(curItems[focusIdx]); }
    else if (e.key === 'Escape') hideDrop();
  });

  input.addEventListener('blur', () => setTimeout(hideDrop, 150));
  window.addEventListener('resize', () => { if (drop.style.display !== 'none') posDrop(); });
  document.querySelector('.sidebar').addEventListener('scroll', () => { if (drop.style.display !== 'none') posDrop(); });
})();
