// ── Taxonomy Browser — Miller Columns ────────────────────────────────────────
// Self-contained IIFE. Relies on globals: map (Leaflet), window.addSpeciesEntry,
// window._nzorSearch, window._nvsSearch (all set by species-search.js).
(function() {
  'use strict';

  const KINGDOMS = [
    { key:1, name:'Animalia',  rank:'KINGDOM' },
    { key:6, name:'Plantae',   rank:'KINGDOM' },
    { key:5, name:'Fungi',     rank:'KINGDOM' },
    { key:4, name:'Chromista', rank:'KINGDOM' },
    { key:7, name:'Protozoa',  rank:'KINGDOM' },
    { key:3, name:'Bacteria',  rank:'KINGDOM' },
  ];

  const RANK_LABELS = {
    KINGDOM:'Kingdom', PHYLUM:'Phylum', CLASS:'Class', ORDER:'Order',
    FAMILY:'Family', TRIBE:'Tribe', GENUS:'Genus', SPECIES:'Species',
    SUBPHYLUM:'Subphylum', SUBCLASS:'Subclass', SUBORDER:'Suborder',
    SUBFAMILY:'Subfamily', SUBGENUS:'Subgenus',
  };
  const VALID_RANKS = new Set(Object.keys(RANK_LABELS));

  // Maps a parent rank → the GBIF occurrence facet field for its children
  // e.g. children of a CLASS are ORDERs → facet by orderKey
  const RANK_TO_CHILD_FACET = {
    KINGDOM:'phylumKey', PHYLUM:'classKey',  CLASS:'orderKey',
    ORDER:'familyKey',   FAMILY:'genusKey',  GENUS:'speciesKey',
    SUBPHYLUM:'classKey', SUBCLASS:'orderKey', SUBORDER:'familyKey',
    SUBFAMILY:'genusKey', TRIBE:'genusKey',  SUBGENUS:'speciesKey',
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const NUM_COLS = 7;    // number of Miller columns

  const cache    = {};   // taxon key → NZ-filtered [children]
  const nzCache  = {};   // 'root' | taxonKey → Map<key,count> or null
  const navStack = [];   // [{cols, selIdx, selNodes}] for back navigation

  let cols      = [KINGDOMS, ...Array.from({length: NUM_COLS-1}, () => [])];
  let selIdx    = new Array(NUM_COLS).fill(-1);
  let selNodes  = new Array(NUM_COLS).fill(null);
  let jumpAncestry      = [];   // [{key,name,rank}…] set after a search jump, for breadcrumb
  let millerSearchTimer = null; // debounce handle
  let _jumpSeq          = 0;   // incremented on every navigation; stale async ops check this

  // ── Render ────────────────────────────────────────────────────────────────
  const COL_HEADERS = ['Kingdom', 'Phylum', 'Class', 'Order', 'Family', 'Genus', 'Species'];

  // Derive a column header from the actual rank of the items in that column,
  // falling back to the position-based label when the column is empty.
  function colHeaderLabel(ci) {
    const nodes = cols[ci];
    if (nodes && nodes.length > 0 && nodes[0].rank) {
      return RANK_LABELS[nodes[0].rank] || nodes[0].rank;
    }
    return COL_HEADERS[ci] || 'Taxa';
  }

  function renderCol(ci) {
    const colEl = document.getElementById('millerCol' + ci);
    if (!colEl) return;
    colEl.innerHTML = '';

    // Column header derived from actual content rank
    const hdr = document.createElement('div');
    hdr.className = 'miller-col-hdr';
    hdr.textContent = colHeaderLabel(ci);
    colEl.appendChild(hdr);

    const nodes = cols[ci];
    if (!nodes || nodes.length === 0) {
      if (ci > 0 && selIdx[ci-1] >= 0) {
        const msg = document.createElement('div');
        msg.className = 'miller-msg';
        msg.textContent = 'No sub-taxa found';
        colEl.appendChild(msg);
      }
      return;
    }

    nodes.forEach((node, i) => {
      const name = node.canonicalName || node.scientificName || node.name || '?';
      const isSel = selIdx[ci] === i;
      const hasKids = node.numDescendants == null || node.numDescendants > 0;

      const item = document.createElement('div');
      item.className = 'miller-item' + (isSel ? ' miller-sel' : '');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'miller-name';
      nameSpan.textContent = name;
      item.appendChild(nameSpan);

      if (node._nzCount != null) {
        const cntSpan = document.createElement('span');
        cntSpan.className = 'miller-count';
        cntSpan.title = node._nzCount.toLocaleString() + ' GBIF records from all time for NZ';
        cntSpan.textContent = node._nzCount >= 1000
          ? '(' + (node._nzCount / 1000).toFixed(node._nzCount >= 10000 ? 0 : 1) + 'k)'
          : '(' + node._nzCount + ')';
        item.appendChild(cntSpan);
      }

      // rank badge removed — column header already shows the rank

      if (hasKids) {
        const arr = document.createElement('span');
        arr.className = 'miller-arr';
        arr.textContent = '›';
        item.appendChild(arr);
      }

      item.addEventListener('click', () => onItemClick(ci, i, node));
      colEl.appendChild(item);

      // Scroll selected item into view
      if (isSel) setTimeout(() => item.scrollIntoView({ block:'nearest' }), 0);
    });
  }

  function renderAll() {
    for (let ci = 0; ci < NUM_COLS; ci++) renderCol(ci);
    updateHint();
    updateBackBtn();
  }

  function updateHint() {
    const el = document.getElementById('millerHint');
    if (!el) return;
    const note = ' · Numbers are GBIF records from all time for NZ';
    const last = NUM_COLS - 1;
    if (cols[last] && cols[last].length > 0 && selIdx[last-1] >= 0) {
      el.textContent = 'Click any item in the right column to drill deeper ›' + note;
    } else if (selIdx[0] < 0) {
      el.textContent = 'Select a kingdom to begin · click any item to drill in' + note;
    } else {
      el.textContent = note.trim();
    }
  }

  function updateBackBtn() {
    const btn = document.getElementById('taxoBackBtn');
    if (btn) btn.disabled = navStack.length === 0;
  }

  // ── Drill up ─────────────────────────────────────────────────────────────
  // Shift all columns one level higher: col-0 anchor moves to col 1, its parent
  // fills col 0. Works all the way up to kingdoms. Pushes current state to navStack.
  async function drillUp() {
    const anchor = selNodes[0];
    if (!anchor || !anchor.key) return;

    const mySeq = ++_jumpSeq;

    try {
      const res = await fetch('https://api.gbif.org/v1/species/' + anchor.key + '/parents');
      if (!res.ok || _jumpSeq !== mySeq) return;
      const parents = await res.json();
      if (_jumpSeq !== mySeq) return;

      const directParent = parents[parents.length - 1];  // immediate parent of anchor
      const grandParent  = parents[parents.length - 2];  // parent of directParent (may be null)

      if (!directParent) return;  // already at kingdom; can't go higher

      // Load the new col-0 = directParent's siblings (grandParent's children, or kingdoms)
      const col0nodes = await loadSiblings(grandParent || null, directParent.key);
      if (_jumpSeq !== mySeq) return;

      // Push current state so Back can restore it
      navStack.push({
        cols:     cols.map(c => [...c]),
        selIdx:   [...selIdx],
        selNodes: [...selNodes],
      });

      const c0i = col0nodes.findIndex(n => n.key === directParent.key);

      // Shift: old col[k] → new col[k+1], rightmost col is dropped; new col[0] = loaded parent
      const prevCols     = cols.map(c => [...c]);
      const prevSelIdx   = [...selIdx];
      const prevSelNodes = [...selNodes];

      cols[0]     = col0nodes;
      selIdx[0]   = c0i >= 0 ? c0i : 0;
      selNodes[0] = c0i >= 0 ? col0nodes[c0i] : directParent;

      for (let k = 1; k < NUM_COLS; k++) {
        cols[k]     = prevCols[k-1];
        selIdx[k]   = prevSelIdx[k-1];
        selNodes[k] = prevSelNodes[k-1];
      }

      renderAll();
      updateCrumb();
      updateAddBtn();

      for (let ci = 0; ci < NUM_COLS; ci++) {
        const colEl = document.getElementById('millerCol' + ci);
        if (colEl) {
          const sel = colEl.querySelector('.miller-item.miller-sel');
          if (sel) setTimeout(() => sel.scrollIntoView({ block: 'center' }), 0);
        }
      }
    } catch(e) {
      console.warn('drillUp error:', e);
    }
  }

  // ── Interaction ───────────────────────────────────────────────────────────
  async function onItemClick(ci, i, node) {
    jumpAncestry = [];   // manual navigation clears any search-jump ancestry
    _jumpSeq++;          // invalidate any in-flight jumpToTaxon async operations
    // Clicking the already-selected item in col 0 drills up one taxonomy level —
    // fetches the anchor's parent and shifts the columns so the anchor moves to col 1.
    // Use key comparison rather than index — selIdx can drift after a drillUp.
    if (ci === 0 && selNodes[0] && selNodes[0].key === node.key) {
      await drillUp();
      return;
    }
    if (ci === NUM_COLS - 1) {
      // Drill in from the rightmost column: shift all cols left, load new rightmost
      const savedSelIdx   = [...selIdx];
      const savedSelNodes = [...selNodes];
      savedSelIdx[ci]   = i;
      savedSelNodes[ci] = node;
      navStack.push({
        cols:     cols.map(c => [...c]),
        selIdx:   savedSelIdx,
        selNodes: savedSelNodes,
      });
      for (let k = 0; k < NUM_COLS - 1; k++) {
        cols[k]     = cols[k + 1];
        selIdx[k]   = selIdx[k + 1];
        selNodes[k] = selNodes[k + 1];
      }
      // The drilled-into item is now at the second-from-right position
      selIdx[NUM_COLS - 2]   = i;
      selNodes[NUM_COLS - 2] = node;
      cols[NUM_COLS - 1]     = [];
      selIdx[NUM_COLS - 1]   = -1;
      selNodes[NUM_COLS - 1] = null;
      renderAll();
      updateCrumb();
      updateAddBtn();
      await loadCol(NUM_COLS - 1, node);
    } else {
      // Select: show children in next column, clear all deeper columns
      selIdx[ci]   = i;
      selNodes[ci] = node;
      for (let d = ci + 1; d < NUM_COLS; d++) {
        selIdx[d]   = -1;
        cols[d]     = [];
        selNodes[d] = null;
      }
      renderAll();
      updateCrumb();
      updateAddBtn();
      if (ci < NUM_COLS - 1) await loadCol(ci + 1, node);
    }
  }

  // Fetch child taxon keys that have NZ occurrence records, with their record counts.
  // parentKey=null → root level (uses kingdomKey facet with no taxon filter).
  // Returns a Map<string, number> (key → NZ occurrence count), or null on failure.
  async function getNZKeys(parentKey, parentRank) {
    const cacheKey = parentKey || 'root';
    if (nzCache[cacheKey] !== undefined) return nzCache[cacheKey];
    let facetField, baseUrl;
    if (!parentKey) {
      facetField = 'kingdomKey';
      baseUrl    = 'https://api.gbif.org/v1/occurrence/search?country=NZ&limit=0';
    } else {
      facetField = RANK_TO_CHILD_FACET[parentRank];
      if (!facetField) { nzCache[cacheKey] = null; return null; }
      baseUrl = 'https://api.gbif.org/v1/occurrence/search?country=NZ&taxonKey='+parentKey+'&limit=0';
    }
    try {
      const res = await fetch(baseUrl + '&facet=' + facetField + '&facetLimit=1000&facetMincount=1');
      if (!res.ok) throw new Error('HTTP '+res.status);
      const j = await res.json();
      const counts = new Map((j.facets?.[0]?.counts || []).map(c => [String(c.name), c.count]));
      nzCache[cacheKey] = counts;
      return counts;
    } catch(e) {
      nzCache[cacheKey] = null; // fallback: no filter
      return null;
    }
  }

  async function loadCol(ci, parentNode) {
    const key = parentNode.key;
    if (!cache[key]) {
      // Show loading indicator while both API calls run
      const colEl = document.getElementById('millerCol' + ci);
      if (colEl) {
        colEl.innerHTML = '';
        const hdr = document.createElement('div');
        hdr.className = 'miller-col-hdr';
        hdr.textContent = COL_HEADERS[ci] || 'Taxa';  // updated after load
        colEl.appendChild(hdr);
        const msg = document.createElement('div');
        msg.className = 'miller-msg';
        msg.textContent = 'Loading…';
        colEl.appendChild(msg);
      }
      try {
        // Fetch taxonomy children and NZ occurrence facets in parallel
        const [taxoRes, nzKeys] = await Promise.all([
          fetch('https://api.gbif.org/v1/species/'+key+'/children?limit=200'),
          getNZKeys(key, parentNode.rank),
        ]);
        if (!taxoRes.ok) throw new Error('HTTP '+taxoRes.status);
        const j = await taxoRes.json();
        let children = (j.results || []).filter(x =>
          x.rank && VALID_RANKS.has(x.rank) &&
          (!x.taxonomicStatus || x.taxonomicStatus === 'ACCEPTED' || x.taxonomicStatus === 'DOUBTFUL')
        );
        // Filter to NZ-present taxa only and attach NZ occurrence counts.
        // Fall back to unfiltered children if filtering wipes everything out — this
        // happens when direct children are intermediate ranks (Subfamily, Tribe, etc.)
        // that don't appear in GBIF occurrence facets (which only go down to genusKey).
        if (nzKeys && nzKeys.size > 0) {
          const filtered = children.filter(c => nzKeys.has(String(c.key)));
          if (filtered.length > 0) children = filtered;
          // else: keep unfiltered; intermediate-rank children can't be matched by occurrence facets
        }
        children.forEach(c => { c._nzCount = nzKeys ? (nzKeys.get(String(c.key)) || null) : null; });
        children.sort((a,b) => (a.canonicalName||'').localeCompare(b.canonicalName||''));
        cache[key] = children;
      } catch(e) {
        cache[key] = [];
      }
    }
    cols[ci] = cache[key];
    renderCol(ci);
    updateHint();
    updateAddBtn();
  }

  // Load the kingdoms column filtered to those with NZ occurrences
  async function loadKingdoms() {
    const colEl = document.getElementById('millerCol0');
    if (colEl) {
      colEl.innerHTML = '';
      const hdr = document.createElement('div');
      hdr.className = 'miller-col-hdr';
      hdr.textContent = 'Kingdom';
      colEl.appendChild(hdr);
      const msg = document.createElement('div');
      msg.className = 'miller-msg';
      msg.textContent = 'Loading…';
      colEl.appendChild(msg);
    }
    const nzKeys = await getNZKeys(null, null);
    let kingdoms = (nzKeys && nzKeys.size > 0)
      ? KINGDOMS.filter(k => nzKeys.has(String(k.key)))
      : [...KINGDOMS];
    kingdoms.forEach(k => { k._nzCount = nzKeys ? (nzKeys.get(String(k.key)) || null) : null; });
    cols[0] = kingdoms;
    renderCol(0);
    updateHint();
    updateBackBtn();
  }

  function goBack() {
    if (!navStack.length) return;
    jumpAncestry = [];   // back navigation clears search-jump ancestry
    _jumpSeq++;          // invalidate any in-flight jumpToTaxon async operations
    const prev = navStack.pop();
    cols      = prev.cols;
    selIdx    = prev.selIdx;
    selNodes  = prev.selNodes;
    renderAll();
    updateCrumb();
    updateAddBtn();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getSelected() {
    for (let ci = NUM_COLS - 1; ci >= 0; ci--) {
      if (selNodes[ci]) return { node: selNodes[ci], ci };
    }
    return null;
  }

  function nodeName(node) {
    return node ? (node.canonicalName || node.scientificName || node.name || '?') : '?';
  }

  function updateCrumb() {
    const el = document.getElementById('taxoCrumb');
    if (!el) return;
    const parts = [];
    if (jumpAncestry.length > 0) {
      // Show ancestry path from the search jump (exclude the last entry = the taxon itself,
      // which is shown via selNodes below)
      const ancestors = jumpAncestry.slice(0, -1);
      if (ancestors.length <= 3) {
        ancestors.forEach(n => parts.push(nodeName(n)));
      } else {
        parts.push(nodeName(ancestors[0]));
        parts.push('…');
        parts.push(nodeName(ancestors[ancestors.length - 1]));
      }
    } else if (navStack.length > 0) {
      const f0 = navStack[0];
      const anchor = f0.selNodes.find(n => n);
      if (anchor) parts.push(nodeName(anchor));
      if (navStack.length > 1) parts.push('…');
    }
    selNodes.forEach(n => { if (n) parts.push(nodeName(n)); });
    el.textContent = parts.length ? parts.join(' › ') : 'Select a kingdom to start';
  }

  function updateAddBtn() {
    const btn = document.getElementById('taxoAddBtn');
    if (!btn) return;
    const hit = getSelected();
    if (hit) {
      const name = nodeName(hit.node);
      const rank = RANK_LABELS[hit.node.rank] || hit.node.rank || 'taxon';
      btn.textContent = 'Add ' + name + ' (' + rank + ') to search';
      btn.disabled    = false;
      btn._taxoNode   = hit.node;
    } else {
      btn.textContent = 'Select a taxon to add to search';
      btn.disabled    = true;
      btn._taxoNode   = null;
    }
  }

  // ── Search bar ────────────────────────────────────────────────────────────
  function initSearch() {
    const inp = document.getElementById('millerSearchIn');
    const clr = document.getElementById('millerSearchX');
    if (!inp) return;

    inp.addEventListener('input', () => {
      const q = inp.value.trim();
      clr.style.display = q ? '' : 'none';
      clearTimeout(millerSearchTimer);
      if (!q) { hideMillerDrop(); return; }
      millerSearchTimer = setTimeout(() => doMillerSearch(q), 280);
    });

    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        inp.value = ''; clr.style.display = 'none'; hideMillerDrop();
      }
    });

    clr.addEventListener('click', () => {
      inp.value = ''; clr.style.display = 'none'; hideMillerDrop(); inp.focus();
    });

    // Close dropdown when clicking outside the search wrap
    document.addEventListener('click', e => {
      const wrap = document.querySelector('.miller-search-wrap');
      if (wrap && !wrap.contains(e.target)) hideMillerDrop();
    }, true);
  }

  function hideMillerDrop() {
    const drop = document.getElementById('millerDrop');
    if (drop) { drop.style.display = 'none'; drop.innerHTML = ''; }
  }

  async function doMillerSearch(q) {
    const drop = document.getElementById('millerDrop');
    if (!drop) return;
    drop.innerHTML = '<div class="miller-sug-msg">Searching…</div>';
    drop.style.display = '';

    const [nzorResults, nvsResults, gbifResults, gbifFullResults] = await Promise.all([
      searchNzor(q),
      searchNvsForTaxo(q),
      searchGbif(q),
      searchGbifFull(q),
    ]);

    // Merge and deduplicate: NZOR vernacular → NVS codes → GBIF full-text → GBIF suggest (scientific)
    const seen = new Set();
    const results = [];
    for (const r of [...nzorResults, ...nvsResults, ...gbifFullResults, ...gbifResults]) {
      const dk = r.gbifKey ? String(r.gbifKey) : ('nzor_' + r.display);
      if (!seen.has(dk)) { seen.add(dk); results.push(r); }
    }
    // Rank: exact match → vernacular starts-with → scientific starts-with → contains
    const ql = q.toLowerCase();
    results.sort((a, b) => {
      const adl = a.display.toLowerCase();
      const bdl = b.display.toLowerCase();
      const aExact = adl === ql ? 0 : 1;
      const bExact = bdl === ql ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aVern = a.type === 'vernacular' ? 0 : 1;
      const bVern = b.type === 'vernacular' ? 0 : 1;
      if (aVern !== bVern) return aVern - bVern;
      const aStart = adl.startsWith(ql) ? 0 : 1;
      const bStart = bdl.startsWith(ql) ? 0 : 1;
      return aStart - bStart;
    });
    showMillerDrop(results);
  }

  // Infer a display rank from a scientific name — good enough for NZOR/NVS results
  // that don't carry rank metadata. 1 word = Genus, 2 words = Species, 3+ = Subspecies.
  function inferRankLabel(sciName) {
    if (!sciName) return '';
    const words = sciName.trim().split(/\s+/);
    if (words.length === 1) return 'Genus';
    if (words.length === 2) return 'Species';
    return 'Subspecies';
  }

  async function searchNvsForTaxo(q) {
    if (typeof window._nvsSearch !== 'function') return [];
    const hits = window._nvsSearch(q).slice(0, 8);
    return hits.map(h => ({
      type:     'scientific',
      display:  h.sci,
      subLabel: 'NVS ' + h.nvscode.toUpperCase(),
      rank:     inferRankLabel(h.sci),
      gbifKey:  null,
      nzorData: null,
      nvsSci:   h.sci,
    }));
  }

  async function searchNzor(q) {
    if (typeof window._nzorSearch !== 'function') return [];
    const hits = window._nzorSearch(q).slice(0, 20);
    return hits.map(h => ({
      type:     (h.cls === 'v' || h.cls === 'g') ? 'vernacular' : 'scientific',
      display:  h.n,
      subLabel: h.sci || '',
      rank:     inferRankLabel(h.sci || (h.cls === 'v' || h.cls === 'g' ? '' : h.n)),
      gbifKey:  null,
      nzorData: h,
    }));
  }

  async function searchGbif(q) {
    try {
      const url = 'https://api.gbif.org/v1/species/suggest?datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&q='
                + encodeURIComponent(q) + '&limit=10';
      const res = await fetch(url);
      if (!res.ok) return [];
      const arr = await res.json();
      return arr.map(s => ({
        type:     'scientific',
        display:  s.canonicalName || s.scientificName || s.name || '?',
        subLabel: s.family || s.order || '',
        rank:     RANK_LABELS[s.rank] || s.rank || '',
        gbifKey:  s.key,
        nzorData: null,
      }));
    } catch(e) { return []; }
  }

  // GBIF full-text search (species/search) — catches vernacular names not in NZOR
  async function searchGbifFull(q) {
    try {
      const url = 'https://api.gbif.org/v1/species/search?q='
                + encodeURIComponent(q)
                + '&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&limit=8&status=ACCEPTED';
      const res = await fetch(url);
      if (!res.ok) return [];
      const j = await res.json();
      const ql = q.toLowerCase();
      return (j.results || []).map(s => {
        const canonical = (s.canonicalName || '').toLowerCase();
        // If the canonical name doesn't contain the query it matched via vernacular name
        const isVernMatch = !canonical.includes(ql);
        return {
          type:     isVernMatch ? 'vernacular' : 'scientific',
          display:  isVernMatch
            ? (s.vernacularName || s.canonicalName || s.scientificName || '?')
            : (s.canonicalName || s.scientificName || '?'),
          subLabel: isVernMatch
            ? (s.canonicalName || '')
            : (s.family || s.order || ''),
          rank:     RANK_LABELS[s.rank] || s.rank || '',
          gbifKey:  s.key,
          nzorData: null,
        };
      });
    } catch(e) { return []; }
  }

  function showMillerDrop(results) {
    const drop = document.getElementById('millerDrop');
    if (!drop) return;
    drop.innerHTML = '';
    if (!results.length) {
      drop.innerHTML = '<div class="miller-sug-msg">No results found</div>';
      drop.style.display = '';
      return;
    }
    results.forEach(r => {
      const row = document.createElement('div');
      row.className = 'miller-sug';
      const rankHtml = r.rank ? `<span class="miller-sug-rank">${r.rank}</span>` : '';
      const mainClass = r.type === 'vernacular' ? 'vern' : 'sci';
      row.innerHTML =
        `<div class="miller-sug-info">` +
          `<div class="miller-sug-main ${mainClass}">${r.display}</div>` +
          (r.subLabel ? `<div class="miller-sug-sub">${r.subLabel}</div>` : '') +
        `</div>` + rankHtml;
      row.addEventListener('click', () => resolveAndJump(r));
      drop.appendChild(row);
    });
    drop.style.display = '';
  }

  async function resolveAndJump(result) {
    hideMillerDrop();
    const inp = document.getElementById('millerSearchIn');
    const clr = document.getElementById('millerSearchX');

    // Resolve a GBIF backbone key for NZOR/NVS results that don't have one yet
    let gbifKey = result.gbifKey;
    const sciToResolve = (!gbifKey && result.nvsSci)  ? result.nvsSci
                       : (!gbifKey && result.nzorData) ? (result.nzorData.sci || result.nzorData.n)
                       : null;
    if (!gbifKey && sciToResolve) {
      const sci = sciToResolve;
      try {
        const url = 'https://api.gbif.org/v1/species/match?name='
                  + encodeURIComponent(sci)
                  + '&datasetKey=d7dddbf4-2cf0-4f39-9b2a-bb099caae36c&verbose=false';
        const res = await fetch(url);
        if (res.ok) {
          const j = await res.json();
          if (j.matchType !== 'NONE' && j.usageKey) gbifKey = j.usageKey;
        }
      } catch(e) {}
    }
    if (!gbifKey) return; // can't resolve — nothing to show

    if (inp) inp.value = result.display;
    if (clr) clr.style.display = '';
    await jumpToTaxon(gbifKey);
  }

  // Load the children of parentNode from cache or API, always keeping mustIncludeKey present.
  // Returns a sorted, NZ-filtered children array.
  async function loadSiblings(parentNode, mustIncludeKey) {
    if (!parentNode) {
      // No parent — fall back to kingdoms
      const nzKeys = await getNZKeys(null, null);
      return (nzKeys && nzKeys.size > 0)
        ? KINGDOMS.filter(k => nzKeys.has(String(k.key)))
        : [...KINGDOMS];
    }
    const parentKey = parentNode.key;
    if (cache[parentKey]) return cache[parentKey];
    const [childrenRes, nzKeys] = await Promise.all([
      fetch('https://api.gbif.org/v1/species/' + parentKey + '/children?limit=200'),
      getNZKeys(parentKey, parentNode.rank),
    ]);
    if (!childrenRes.ok) return [];
    const cj = await childrenRes.json();
    let children = (cj.results || []).filter(x =>
      x.rank && VALID_RANKS.has(x.rank) &&
      (!x.taxonomicStatus || x.taxonomicStatus === 'ACCEPTED' || x.taxonomicStatus === 'DOUBTFUL')
    );
    if (nzKeys && nzKeys.size > 0) {
      const filtered = children.filter(c => nzKeys.has(String(c.key)));
      // Always keep the must-include key even if NZ filter would drop it
      if (mustIncludeKey && !filtered.some(c => c.key === mustIncludeKey)) {
        const keep = children.find(c => c.key === mustIncludeKey);
        if (keep) filtered.unshift(keep);
      }
      // Fall back to unfiltered if filtering wipes everything out — intermediate ranks
      // (Subfamily, Tribe, etc.) don't appear in GBIF occurrence facets
      if (filtered.length > 0) children = filtered;
    }
    children.forEach(c => { c._nzCount = nzKeys ? (nzKeys.get(String(c.key)) || null) : null; });
    children.sort((a,b) => (a.canonicalName||'').localeCompare(b.canonicalName||''));
    cache[parentKey] = children;
    return children;
  }

  async function jumpToTaxon(gbifKey) {
    const mySeq = ++_jumpSeq;  // snapshot; if user navigates before we finish, bail
    try {
      const [taxonRes, parentsRes] = await Promise.all([
        fetch('https://api.gbif.org/v1/species/' + gbifKey),
        fetch('https://api.gbif.org/v1/species/' + gbifKey + '/parents'),
      ]);
      if (!taxonRes.ok || !parentsRes.ok) return;
      const taxon   = await taxonRes.json();
      const parents = await parentsRes.json();  // kingdom-first, direct parent last
      if (_jumpSeq !== mySeq) return;

      jumpAncestry = [...parents, taxon];

      // Reset navigation state (keep API cache)
      navStack.length = 0;
      cols     = Array.from({length: NUM_COLS}, () => []);
      selIdx   = new Array(NUM_COLS).fill(-1);
      selNodes = new Array(NUM_COLS).fill(null);
      renderAll();

      const depth = parents.length;

      if (!depth) {
        // Taxon is a kingdom — show it alone in col 0
        cols[0] = [taxon]; selIdx[0] = 0; selNodes[0] = taxon;
        renderAll(); updateCrumb(); updateAddBtn();
        return;
      }

      // General formula for NUM_COLS columns:
      //   col[ci] (ci = 0..NUM_COLS-2) shows children of parents[srcIdx],
      //   with parents[hiIdx] highlighted.
      //   srcIdx = depth - NUM_COLS + ci   (negative → null = kingdom list)
      //   hiIdx  = depth - NUM_COLS + ci + 1
      //   col[NUM_COLS-1] is loaded via loadCol from selNodes[NUM_COLS-2].
      //
      // This ensures that for a species with N ancestors, the leftmost column
      // always shows the N-(NUM_COLS-1)th ancestor's children — so even taxa
      // with intermediate ranks (Subfamily, Tribe) keep the Family visible.

      const colLoaders = [];
      for (let ci = 0; ci < NUM_COLS - 1; ci++) {
        const srcIdx = depth - NUM_COLS + ci;       // index of the source parent
        const hiIdx  = depth - NUM_COLS + ci + 1;   // index of the child to highlight
        if (hiIdx < 0) {
          colLoaders.push(Promise.resolve(null));
          continue;
        }
        const srcNode = srcIdx < 0 ? null : parents[srcIdx];
        const mustKey = hiIdx < depth ? parents[hiIdx].key : taxon.key;
        colLoaders.push(
          loadSiblings(srcNode, mustKey)
            .then(nodes => ({ nodes, hiIdx, mustKey }))
            .catch(() => null)
        );
      }

      const loaded = await Promise.all(colLoaders);
      if (_jumpSeq !== mySeq) return;

      for (let ci = 0; ci < NUM_COLS - 1; ci++) {
        const res = loaded[ci];
        if (!res || !res.nodes.length) continue;
        const { nodes, hiIdx, mustKey } = res;
        const highlightNode = hiIdx < depth ? parents[hiIdx] : taxon;
        const si = nodes.findIndex(n => n.key === mustKey);
        cols[ci]     = nodes;
        selIdx[ci]   = si >= 0 ? si : 0;
        selNodes[ci] = si >= 0 ? nodes[si] : highlightNode;
      }

      renderAll();
      updateCrumb();
      updateAddBtn();

      // Scroll all pre-loaded selections into view
      for (let ci = 0; ci < NUM_COLS - 1; ci++) {
        const colEl = document.getElementById('millerCol' + ci);
        if (colEl) {
          const sel = colEl.querySelector('.miller-item.miller-sel');
          if (sel) setTimeout(() => sel.scrollIntoView({ block: 'center' }), 0);
        }
      }

      // Load the rightmost column from the deepest pre-loaded selection
      const lastSrc = selNodes[NUM_COLS - 2];
      if (!lastSrc) return;
      await loadCol(NUM_COLS - 1, lastSrc);

      if (_jumpSeq !== mySeq) return;

      // Highlight the target taxon in the rightmost column
      const lastIdx = cols[NUM_COLS - 1].findIndex(n => n.key === gbifKey);
      if (lastIdx >= 0) {
        selIdx[NUM_COLS - 1]   = lastIdx;
        selNodes[NUM_COLS - 1] = cols[NUM_COLS - 1][lastIdx];
        renderCol(NUM_COLS - 1);
        updateAddBtn();
        const lastColEl = document.getElementById('millerCol' + (NUM_COLS - 1));
        if (lastColEl) {
          const sel = lastColEl.querySelector('.miller-item.miller-sel');
          if (sel) setTimeout(() => sel.scrollIntoView({ block: 'center' }), 0);
        }
      }

    } catch(e) {
      console.warn('jumpToTaxon error:', e);
    }
  }

  // ── Open / close ──────────────────────────────────────────────────────────
  function reset() {
    navStack.length = 0;
    cols         = Array.from({length: NUM_COLS}, () => []);  // col 0 loaded async via loadKingdoms()
    selIdx       = new Array(NUM_COLS).fill(-1);
    selNodes     = new Array(NUM_COLS).fill(null);
    jumpAncestry = [];
    clearTimeout(millerSearchTimer);
    const inp = document.getElementById('millerSearchIn');
    const clr = document.getElementById('millerSearchX');
    if (inp) inp.value = '';
    if (clr) clr.style.display = 'none';
    hideMillerDrop();
  }

  async function open() {
    if (window.innerWidth < 700) return; // not available on small screens
    reset();
    const modal = document.getElementById('taxoBrowser');
    if (!modal) return;
    modal.style.display = 'flex';
    renderAll();
    updateCrumb();
    updateAddBtn();
    await loadKingdoms();  // fetches NZ-filtered kingdoms then renders col 0
  }

  function close() {
    const modal = document.getElementById('taxoBrowser');
    if (modal) modal.style.display = 'none';
  }

  window.openTaxoBrowser = open;

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('taxoBrowseBtn')    ?.addEventListener('click', open);
    document.getElementById('taxoBrowserClose') ?.addEventListener('click', close);
    document.getElementById('taxoBackBtn')      ?.addEventListener('click', goBack);
    document.getElementById('taxoBrowser')      ?.addEventListener('click', e => {
      if (e.target === document.getElementById('taxoBrowser')) close();
    });
    document.getElementById('taxoAddBtn')?.addEventListener('click', () => {
      const btn  = document.getElementById('taxoAddBtn');
      const node = btn?._taxoNode;
      if (!node) return;
      if (typeof window.addSpeciesEntry === 'function')
        window.addSpeciesEntry(nodeName(node), node.key, null);
      close();
    });
    initSearch();
  });
})();
