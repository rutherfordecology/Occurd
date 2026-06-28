// ── NZ / Samoa species search ───────────────────────────────────────────────
// Thin UI layer (input, dropdown, debounce, region gate) over window.NameResolver.
// The actual name data (NZOR, NVS, Samoa) lives in source plugins registered
// below — a fork wanting its own species list registers another source the
// same way, without touching this file's UI code.
(function() {
  const NZ_BOUNDS    = { minLat: -52, maxLat: -29, minLng: 163, maxLng: 180 };
  const SAMOA_BOUNDS = { minLat: -15.0, maxLat: -13.0, minLng: -173.5, maxLng: -168.0 };
  const NZOR_URL        = 'but-is-it-threatened/nzor_names_v2.json';
  const NVS_URL         = 'but-is-it-threatened/nvs.json';
  const SAMOA_NAMES_URL = 'samoa_names.json';

  const field  = document.getElementById('spField');
  const input  = document.getElementById('spInput');
  const clrBtn = document.getElementById('spClear');

  // Dropdown appended to body to avoid sidebar clipping
  const drop = document.createElement('div');
  drop.id = 'spDrop';
  document.body.appendChild(drop);

  let inSamoa  = false;  // tracks current map position
  let debounce = null;
  let focusIdx = -1;
  let curItems = [];

  // ── NZOR source ──────────────────────────────────────────────────────────
  // Matching itself lives in the shared but-is-it-threatened/nzor-source.js
  // (NZ-specific, used by both apps) — this file just loads it without the
  // NZTCS enrichment (Occurd doesn't need common/Māori name merging) and
  // adds the genus-search affordance, which is Occurd UI, not core matching.
  let nzor         = null;  // { index, ambiguous, search, lookupKey, resolveItem }
  let nzorPromise  = null;
  let nzorLoading  = false;
  let nzorSciIndex = null; // built once: lowercase sci name → [vernacular display names]

  function buildSciIndex() {
    if (nzorSciIndex || !nzor) return;
    nzorSciIndex = {};
    for (const val of nzor.index) {
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
    const uniq = hits.filter((v, i, a) => a.indexOf(v) === i);
    return uniq.slice(0, 2).join(' · ');
  };

  window.ensureNzorLoaded = function() {
    if (nzor) return Promise.resolve(true);
    return ensureNzor();
  };

  window._nzorReady = () => !!nzor;

  async function ensureNzor() {
    if (nzor) return true;
    if (!nzorPromise) {
      nzorLoading = true;
      nzorPromise = window.NzorSource.load({ url: NZOR_URL })
        .then(src => { nzor = src; nzorLoading = false; nzorPromise = null; return true; })
        .catch(e => { console.warn('NZOR load failed:', e); nzor = null; nzorLoading = false; nzorPromise = null; return false; });
    }
    return nzorPromise;
  }

  function normQuery(s) {
    return s.toLowerCase()
      .replace(/[āÃā]/g, 'a').replace(/[ēĒ]/g, 'e')
      .replace(/[īĪ]/g, 'i').replace(/[ōŌ]/g, 'o')
      .replace(/[ūŪ]/g, 'u').trim();
  }

  function searchNzor(q) {
    if (!nzor) return [];
    const results = nzor.search(q).slice(0, 10);

    // Genus option: single-word query that is the first word of 2+ scientific
    // names — Occurd-specific UI affordance (basket-adds the whole genus),
    // not part of the shared matching core.
    const norm = normQuery(q);
    if (!norm.includes(' ') && norm.length >= 3) {
      const genusPrefix = norm + ' ';
      const genusHits = nzor.index.filter(x => x.kd.startsWith(genusPrefix) && x.cls !== 'v');
      if (genusHits.length >= 2) {
        const properGenus = norm.charAt(0).toUpperCase() + norm.slice(1);
        results.unshift({ key: '_genus_' + norm, n: properGenus, cls: 'g' });
      }
    }
    return results;
  }

  // Exposed so the taxonomy browser can use it for common/Māori name lookup
  window._nzorSearch = function(q) { return nzor ? searchNzor(q) : []; };

  window.NameResolver.registerSource({
    key: 'nzor',
    isRelevant: () => !inSamoa,
    ensureLoaded: ensureNzor,
    isLoaded: () => !!nzor,
    search: searchNzor,
    resolve(item) {
      if (item.cls === 'g') return { ambiguous: false, isGenus: true, n: item.n };
      return nzor.resolveItem(item);
    }
  });

  // ── NVS source ───────────────────────────────────────────────────────────
  let nvsData    = null;
  let nvsPromise = null;

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

  function searchNvs(q) {
    if (!nvsData) return [];
    const norm = q.toLowerCase().trim().replace(/\s+/g, '');
    if (norm.length < 2) return [];
    const results = [];
    const seen = new Set();
    function resolveEntry(code) {
      const e = nvsData[code];
      if (!e) return null;
      if (e.pref && nvsData[e.pref]) {
        return { code: e.pref, sci: e.prefSci || nvsData[e.pref].sci || e.sci };
      }
      return { code, sci: e.sci };
    }
    const exact = resolveEntry(norm);
    if (exact && !seen.has(exact.code)) {
      seen.add(exact.code);
      results.push({ cls: 'nvs', n: exact.sci, sci: exact.sci, nvscode: norm, key: norm });
    }
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

  window.NameResolver.registerSource({
    key: 'nvs',
    isRelevant: () => !inSamoa,
    ensureLoaded: ensureNvs,
    isLoaded: () => !!nvsData,
    search: searchNvs,
    resolve: item => ({ ambiguous: false, sci: item.sci, sciId: null })
  });

  // ── Samoa source ─────────────────────────────────────────────────────────
  let samoaData    = null;
  let samoaPromise = null;

  function ensureSamoa() {
    if (samoaData) return Promise.resolve(true);
    if (!samoaPromise) {
      samoaPromise = fetch(SAMOA_NAMES_URL)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => { samoaData = data; samoaPromise = null; return true; })
        .catch(e => { console.warn('Samoa names load failed:', e); samoaPromise = null; return false; });
    }
    return samoaPromise;
  }

  function searchSamoa(q) {
    if (!samoaData) return [];
    const norm = q.toLowerCase().trim();
    if (norm.length < 2) return [];
    const sciStarts = [], sciContains = [], vernStarts = [], vernContains = [];
    for (const [sci, entry] of Object.entries(samoaData)) {
      const sciLow     = sci.toLowerCase();
      const samoan     = (entry.samoan || '').toLowerCase();
      const englishArr = Array.isArray(entry.english) ? entry.english : [entry.english || ''];
      const engLow     = name => name.toLowerCase();
      const sciStart   = sciLow.startsWith(norm);
      const sciContain = !sciStart && sciLow.includes(norm);
      if (sciStart || sciContain) {
        const item = { cls: 'samoa', matchBy: 'sci', n: sci, sci, english: englishArr.join(' / '), samoan: entry.samoan || '' };
        if (sciStart) sciStarts.push(item); else sciContains.push(item);
      } else {
        const vernStart   = samoan.startsWith(norm) || englishArr.some(e => engLow(e).startsWith(norm));
        const vernContain = !vernStart && (samoan.includes(norm) || englishArr.some(e => engLow(e).includes(norm)));
        if (vernStart || vernContain) {
          const item = { cls: 'samoa', matchBy: 'samoan', n: entry.samoan || englishArr[0], sci, english: englishArr.join(' / '), samoan: entry.samoan || '' };
          if (vernStart) vernStarts.push(item); else vernContains.push(item);
        }
      }
    }
    return [...sciStarts, ...vernStarts, ...sciContains, ...vernContains].slice(0, 10);
  }

  window.getSamoaVernacular = function(sciName) {
    if (!samoaData || !sciName) return '';
    const entry = samoaData[sciName.toLowerCase()];
    return entry ? (entry.samoan || entry.english || '') : '';
  };

  window.ensureSamoaLoaded = function() {
    if (samoaData) return Promise.resolve(true);
    return ensureSamoa();
  };

  window._samoaSearch = function(q) { return samoaData ? searchSamoa(q) : []; };

  window.NameResolver.registerSource({
    key: 'samoa',
    isRelevant: () => inSamoa,
    ensureLoaded: ensureSamoa,
    isLoaded: () => !!samoaData,
    search: searchSamoa,
    resolve: item => ({ ambiguous: false, sci: item.sci, sciId: null })
  });

  // ── Region gate ──────────────────────────────────────────────────────────
  function checkNZGate() {
    const c = map.getCenter();
    let lng = ((c.lng + 180) % 360 + 360) % 360 - 180;
    const inNZ     = c.lat >= NZ_BOUNDS.minLat    && c.lat <= NZ_BOUNDS.maxLat    &&
                     lng    >= NZ_BOUNDS.minLng    && lng    <= NZ_BOUNDS.maxLng;
    const nowSamoa = c.lat >= SAMOA_BOUNDS.minLat && c.lat <= SAMOA_BOUNDS.maxLat &&
                     lng    >= SAMOA_BOUNDS.minLng && lng    <= SAMOA_BOUNDS.maxLng;
    inSamoa = nowSamoa;
    field.style.display = (inNZ || nowSamoa) ? 'block' : 'none';
    if (inNZ    && !nzorData  && !nzorLoading) ensureNzor();
    if (inNZ    && !nvsData   && !nvsPromise)  ensureNvs();
    if (nowSamoa && !samoaData && !samoaPromise) ensureSamoa();
  }
  map.on('moveend', checkNZGate);
  map.on('zoomend', checkNZGate);
  setTimeout(checkNZGate, 600);
  setTimeout(checkNZGate, 2500);

  // ── Dropdown rendering ───────────────────────────────────────────────────
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
      drop.innerHTML = '<div class="sp-loading">Loading species names…</div>';
      posDrop(); drop.style.display = 'block'; return;
    }
    items.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'sp-item';
      if (item.cls === 'g') {
        el.innerHTML =
          '<div class="sp-sci">' + item.n + '</div>' +
          '<div class="sp-common sp-genus-tag">all species in this genus</div>';
      } else if (item.cls === 'nvs') {
        el.innerHTML =
          '<div class="sp-sci">' + item.sci + '</div>' +
          '<div class="sp-common"><span class="nvs-badge">NVS ' + item.nvscode.toUpperCase() + '</span></div>';
      } else if (item.cls === 'samoa') {
        if (item.matchBy === 'sci') {
          el.innerHTML =
            '<div class="sp-sci">' + item.sci + '</div>' +
            '<div class="sp-common">' + [item.samoan, item.english].filter(Boolean).join(' · ') + '</div>';
        } else {
          el.innerHTML =
            '<div class="sp-sci">' + item.n + '</div>' +
            '<div class="sp-common">' + item.sci + '</div>';
        }
      } else if (item.ambiguous) {
        el.innerHTML =
          '<div class="sp-sci">' + item.n + '</div>' +
          '<div class="sp-common sp-genus-tag">multiple matches — which one?</div>';
      } else {
        const isVern = item.cls === 'v';
        const isMulti = isVern && item.sciOptions && item.sciOptions.length > 1;
        const sci    = isVern ? (isMulti ? item.n : (item.sci || '')) : item.n;
        const common = isVern && !isMulti ? item.n : '';
        el.innerHTML =
          '<div class="sp-sci">' + sci + '</div>' +
          (common ? '<div class="sp-common">' + common + '</div>' : '') +
          (isMulti ? '<div class="sp-common sp-genus-tag">' + item.sciOptions.length + ' species — which one?</div>' : '');
      }
      el.addEventListener('mousedown', e => { e.preventDefault(); selectItem(item); });
      drop.appendChild(el);
    });
    posDrop(); drop.style.display = 'block';
  }

  function hideDrop() { drop.style.display = 'none'; curItems = []; focusIdx = -1; }

  // ── Disambiguation picker ────────────────────────────────────────────────
  // Shown inline below the input when a selection resolves to 2+ candidates
  // (e.g. "toatoa" -> 4 different plants, or a homonym scientific name under
  // 2 different authorities). Mirrors but-is-it-threatened's "which one?"
  // pattern so the two tools stay visually consistent.
  const pickerBox = document.createElement('div');
  pickerBox.id = 'spAmbigPicker';
  pickerBox.style.display = 'none';
  field.appendChild(pickerBox);

  function showPicker(displayName, options, onPick) {
    pickerBox.innerHTML =
      '<div class="sp-ambig-note">⚠ "' + displayName + '" matches multiple — which one?</div>' +
      '<div class="sp-ambig-picks">' +
        options.map((o, i) =>
          '<button type="button" class="sp-ambig-btn" data-i="' + i + '">' +
            '<em>' + o.sci + '</em>' + (o.label ? ' <span class="sp-ambig-label">' + o.label + '</span>' : '') +
          '</button>'
        ).join('') +
      '</div>';
    pickerBox.style.display = 'block';
    pickerBox.querySelectorAll('.sp-ambig-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const opt = options[parseInt(btn.dataset.i, 10)];
        hidePicker();
        onPick(opt);
      });
    });
  }
  function hidePicker() { pickerBox.style.display = 'none'; pickerBox.innerHTML = ''; }

  // ── Selection / resolution ───────────────────────────────────────────────
  async function selectItem(item) {
    hideDrop();
    hidePicker();

    const resolved = window.NameResolver.resolveItem(item);

    if (resolved.isGenus) {
      await commitGenus(resolved.n);
      return;
    }

    if (resolved.ambiguous) {
      const displayName = item.n || item.sci || '';
      showPicker(displayName, resolved.options, opt => commitSpecies(opt.sci, opt.label || displayName));
      return;
    }

    await commitSpecies(resolved.sci, item.n);
  }

  async function commitGenus(genusName) {
    input.value = 'all ' + genusName;
    input.classList.add('sp-active');
    let resolvedKey = null;
    try {
      const r = await gbifFetch('https://api.gbif.org/v2/species/match?rank=GENUS&scientificName=' + encodeURIComponent(genusName) + '&checklistKey=' + COL_XR_CHECKLIST_KEY);
      if (r.ok) {
        const j = await r.json();
        if (j.usage && j.usage.key && j.usage.rank === 'GENUS' && j.diagnostics && j.diagnostics.matchType !== 'NONE') {
          resolvedKey = j.usage.key;
        }
      }
    } catch(e) {}
    if (!resolvedKey) {
      try {
        const r2 = await gbifFetch('https://api.gbif.org/v1/species/search?datasetKey=' + COL_XR_CHECKLIST_KEY + '&rank=GENUS&q=' + encodeURIComponent(genusName) + '&limit=10&status=ACCEPTED');
        if (r2.ok) {
          const j2 = await r2.json();
          const exact = (j2.results || []).find(x => x.canonicalName &&
            x.canonicalName.toLowerCase() === genusName.toLowerCase());
          if (exact) resolvedKey = exact.taxonID || exact.key;
        }
      } catch(e2) {}
    }
    if (typeof window.addSpeciesEntry === 'function') {
      window.addSpeciesEntry('all ' + genusName, resolvedKey, genusName);
    }
    input.value = ''; input.classList.remove('sp-active');
  }

  async function commitSpecies(sciName, displayLabel) {
    input.value = displayLabel || sciName;
    input.classList.add('sp-active');
    clrBtn.style.display = 'none';

    let resolvedKey = null;
    try {
      const r = await gbifFetch('https://api.gbif.org/v2/species/match?scientificName=' + encodeURIComponent(sciName) + '&checklistKey=' + COL_XR_CHECKLIST_KEY);
      if (r.ok) {
        const j = await r.json();
        if (j.usage) resolvedKey = (j.usage.status === 'SYNONYM' && j.acceptedUsage) ? j.acceptedUsage.key : j.usage.key;
      }
    } catch(e) {}

    if (typeof window.addSpeciesEntry === 'function') {
      window.addSpeciesEntry(displayLabel || sciName, resolvedKey, sciName);
    }
    input.value = '';
    input.classList.remove('sp-active');
  }

  function clearSel() {
    input.value = '';
    input.classList.remove('sp-active');
    clrBtn.style.display = 'none';
    hideDrop();
    hidePicker();
    input.focus();
  }

  clrBtn.addEventListener('click', clearSel);

  input.addEventListener('input', () => {
    hidePicker();
    if (input.classList.contains('sp-active')) { input.classList.remove('sp-active'); clrBtn.style.display = 'none'; }
    const q = input.value.trim();
    if (q.length < 2) { hideDrop(); return; }
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const ctx = { inSamoa };
      const items = await window.NameResolver.search(q, ctx);
      showDrop(items);
    }, 200);
  });

  input.addEventListener('keydown', e => {
    const els = drop.querySelectorAll('.sp-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx = Math.min(focusIdx+1, els.length-1); els.forEach((el,i)=>el.classList.toggle('sp-focus',i===focusIdx)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx = Math.max(focusIdx-1,0); els.forEach((el,i)=>el.classList.toggle('sp-focus',i===focusIdx)); }
    else if (e.key === 'Enter' && focusIdx >= 0 && curItems[focusIdx]) { e.preventDefault(); selectItem(curItems[focusIdx]); }
    else if (e.key === 'Escape') { hideDrop(); hidePicker(); }
  });

  input.addEventListener('blur', () => setTimeout(hideDrop, 150));
  window.addEventListener('resize', () => { if (drop.style.display !== 'none') posDrop(); });
  document.querySelector('.sidebar').addEventListener('scroll', () => { if (drop.style.display !== 'none') posDrop(); });
})();
