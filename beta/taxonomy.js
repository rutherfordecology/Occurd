// ── Taxonomy Browser — Miller Columns ────────────────────────────────────────
// Self-contained IIFE. Relies on globals: map (Leaflet), window.addSpeciesEntry,
// window._nzorSearch, window._nvsSearch (all set by species-search.js).
(function() {
  'use strict';

  // COL XR's own numeric keys for these root taxa (resolved 2026-06-26 against
  // checklistKey 7ddf754f-d193-4cc9-b351-99906754a03b). nubKey is the matching legacy
  // GBIF backbone numeric ID, used only for NZ occurrence-count faceting (getGeoKeys) —
  // that machinery still queries occurrence data via the legacy backbone, which has no
  // concept of COL XR's own internal keys. taxonID is COL's native alphanumeric code,
  // the only form usable as an occurrence taxonKey filter (paired with checklistKey).
  // Bacteria sits under a real DOMAIN rank with newer kingdoms (Bacillati etc.) beneath
  // it in COL XR rather than being a flat kingdom — listed here as a DOMAIN root entry;
  // the generic rank handling (see JUNK_RANKS below) navigates it correctly with no
  // special-casing. It has no legacy nub equivalent, so NZ counts won't show for it.
  const KINGDOMS = [
    { key:296374190, nubKey:1,    taxonID:'N',     name:'Animalia',  rank:'KINGDOM' },
    { key:293994071, nubKey:6,    taxonID:'P',     name:'Plantae',   rank:'KINGDOM' },
    { key:299629601, nubKey:5,    taxonID:'F',     name:'Fungi',     rank:'KINGDOM' },
    { key:299967116, nubKey:4,    taxonID:'C',     name:'Chromista', rank:'KINGDOM' },
    { key:293992559, nubKey:7,    taxonID:'Z',     name:'Protozoa',  rank:'KINGDOM' },
    { key:293990344, nubKey:null, taxonID:'CRRY6', name:'Bacteria',  rank:'DOMAIN'  },
  ];

  const RANK_LABELS = {
    KINGDOM:'Kingdom', PHYLUM:'Phylum', CLASS:'Class', ORDER:'Order',
    FAMILY:'Family',   TRIBE:'Tribe',   GENUS:'Genus', SPECIES:'Species',
    SUBPHYLUM:'Subphylum', SUBCLASS:'Subclass', SUBORDER:'Suborder',
    SUBFAMILY:'Subfamily', SUBGENUS:'Subgenus',
    DOMAIN:'Domain', SUBKINGDOM:'Subkingdom', INFRAKINGDOM:'Infrakingdom',
    SUPERPHYLUM:'Superphylum', INFRAPHYLUM:'Infraphylum', PARVPHYLUM:'Parvphylum',
    SUPERCLASS:'Superclass', INFRACLASS:'Infraclass', PARVCLASS:'Parvclass',
    MEGACLASS:'Megaclass', SUPERORDER:'Superorder', INFRAORDER:'Infraorder',
    PARVORDER:'Parvorder', SUPERFAMILY:'Superfamily', INFRAFAMILY:'Infrafamily',
    SUBTRIBE:'Subtribe', SUBSPECIES:'Subspecies', VARIETY:'Variety', FORM:'Form',
  };

  // Ranks that aren't a real navigable taxon level — everything else is shown as a
  // column, whatever the rank turns out to be. GBIF's full Rank enum (and the extra
  // ranks COL XR uses beyond that enum, e.g. PARVPHYLUM/MEGACLASS) is too large and
  // too likely to grow to maintain as an allowlist — an allowlist also silently breaks
  // navigation the moment a taxon source introduces a rank we didn't list (this is
  // exactly what happened with COL XR's extra vertebrate ranks).
  const JUNK_RANKS = new Set(['UNRANKED', 'OTHER']);

  // Pretty-print a rank we don't have an explicit label for for, e.g. 'PARVPHYLUM' → 'Parvphylum'
  function rankLabel(rank) {
    if (!rank) return '';
    if (RANK_LABELS[rank]) return RANK_LABELS[rank];
    return rank.charAt(0) + rank.slice(1).toLowerCase().replace(/_/g, ' ');
  }

  // Rank sort order — lower number = higher in hierarchy = shown first.
  // Built from GBIF's official Rank enum (already in correct hierarchical order),
  // with COL XR's extra non-enum ranks spliced in at their observed position.
  const GBIF_RANK_ENUM = [
    'DOMAIN','SUPERKINGDOM','KINGDOM','SUBKINGDOM','INFRAKINGDOM','SUPERPHYLUM','PHYLUM',
    'SUBPHYLUM','INFRAPHYLUM','PARVPHYLUM','MEGACLASS','SUPERCLASS','CLASS','SUBCLASS',
    'INFRACLASS','PARVCLASS','SUPERLEGION','LEGION','SUBLEGION','INFRALEGION','SUPERCOHORT',
    'COHORT','SUBCOHORT','INFRACOHORT','MAGNORDER','SUPERORDER','GRANDORDER','ORDER',
    'SUBORDER','INFRAORDER','PARVORDER','SUPERFAMILY','FAMILY','SUBFAMILY','INFRAFAMILY',
    'SUPERTRIBE','TRIBE','SUBTRIBE','INFRATRIBE','SUPRAGENERIC_NAME','GENUS','SUBGENUS',
    'INFRAGENUS','SECTION','SUBSECTION','SERIES','SUBSERIES','INFRAGENERIC_NAME',
    'SPECIES_AGGREGATE','SPECIES','INFRASPECIFIC_NAME','GREX','SUBSPECIES','CULTIVAR_GROUP',
    'CONVARIETY','INFRASUBSPECIFIC_NAME','PROLES','RACE','NATIO','ABERRATION','MORPH',
    'VARIETY','SUBVARIETY','FORM','SUBFORM','PATHOVAR','BIOVAR','CHEMOVAR','MORPHOVAR',
    'PHAGOVAR','SEROVAR','CHEMOFORM','FORMA_SPECIALIS','CULTIVAR','STRAIN',
  ];
  const RANK_ORDER = {};
  GBIF_RANK_ENUM.forEach((r, i) => { RANK_ORDER[r] = i; });

  // Maps a parent rank → the GBIF occurrence facet field for its children
  // e.g. children of a CLASS are ORDERs → facet by orderKey
  const RANK_TO_CHILD_FACET = {
    KINGDOM:'phylumKey', PHYLUM:'classKey',  CLASS:'orderKey',
    ORDER:'familyKey',   FAMILY:'genusKey',  GENUS:'speciesKey',
    SUBPHYLUM:'classKey', SUBCLASS:'orderKey', SUBORDER:'familyKey',
    SUBFAMILY:'genusKey', TRIBE:'genusKey',  SUBGENUS:'speciesKey',
  };

  // ── Loading phrases ───────────────────────────────────────────────────────
  const LOADING_PHRASES = [
    'Speciating your patience…',
    'Loading at a taxonomic rate…',
    'Please remain clade seated…',
    'Genus takes time…',
    'Kingdom come, it\'s loading…',
    'Taxonomizing the situation…',
    'Awaiting peer re-viewing…',
    'Binomially processing…',
    'Cladistically speaking, almost there…',
    'Evolving your results naturally…',
    'This may take a few million years of divergence…',
    'Running a quick phylo-check…',
    'Organising life, one rank at a time…',
    'Hold please — we\'re keying it out…',
    'Currently suffering from classification lag…',
    'Separating the species from the species-like…',
    'One moment while we split some lumpers…',
    'Reticulating phylogenies…',
    'Awaiting spontaneous speciation…',
    'Genetically confirming your request…',
    'Trying to remember where we put the holotype…',
    'This process has been peer reviewed twice…',
    'Warning: taxonomic instability detected…',
    'Reassigning things to a different genus… again…',
    'Calibrating the molecular clock…',
    'Probably not a subspecies anymore…',
    'Resolving ancient arguments between botanists…',
    'Running cladistics at full branch capacity…',
    'One does not simply define a species…',
    'Searching for distinguishing characteristics…',
    'Applying unnecessary Latin…',
    'Updating names you just learned yesterday…',
    'Waiting for the next taxonomic revision…',
    'Synonymising aggressively…',
    'Loading… according to the latest revision…',
    'This could have been a fern…',
    'Asking three taxonomists for four opinions…',
    'Identifying cryptic species the hard way…',
    'Carefully counting stamens…',
    'Busy arguing about whether it\'s really distinct…',
    'Checking if it\'s already been named in 1847…',
    'Please wait while we consult the monograph…',
    'Clade in progress…',
    'Currently evolving a better classification…',
    'It\'s not messy — it\'s taxonomically complex…',
  ];

  let _loadingCount   = 0;
  let _phraseInterval = null;
  let _lastPhraseAt   = 0;
  const PHRASE_CYCLE_MS = 2000;

  function _pickPhrase() {
    _lastPhraseAt = Date.now();
    const el = document.getElementById('taxoLoadingMsg');
    if (!el) return;
    const next = LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
    if (el.style.display === 'none' || !el.textContent) {
      // First show — appear directly
      el.textContent = next;
      el.style.opacity = '0.8';
      el.style.display = '';
    } else {
      // Cycling — fade out, swap text, fade back in
      el.style.opacity = '0';
      setTimeout(() => { el.textContent = next; el.style.opacity = '0.8'; }, 400);
    }
  }

  function showLoadingPhrase() {
    _loadingCount++;
    if (_loadingCount === 1) {
      _pickPhrase();
      _phraseInterval = setInterval(_pickPhrase, PHRASE_CYCLE_MS);
    }
  }

  function hideLoadingPhrase() {
    _loadingCount = Math.max(0, _loadingCount - 1);
    if (_loadingCount > 0) return;
    clearInterval(_phraseInterval);
    _phraseInterval = null;
    // Let the current phrase finish its 2-second slot before hiding
    const delay = Math.max(0, PHRASE_CYCLE_MS - (Date.now() - _lastPhraseAt));
    setTimeout(() => {
      if (_loadingCount === 0) {
        const el = document.getElementById('taxoLoadingMsg');
        if (el) {
          el.style.opacity = '0';
          setTimeout(() => { if (_loadingCount === 0) el.style.display = 'none'; }, 400);
        }
      }
    }, delay);
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const NUM_COLS = 7;    // number of Miller columns

  const taxoCache    = {};   // parentKey → rank-filtered ACCEPTED children, sorted (no geo filter)
  const taxoInFlight = {};   // parentKey → Promise — prevents duplicate fetches without a [] sentinel
  const nzCache      = {};   // 'CC:root' | 'CC:taxonKey' → Map<key,count> or null (CC = country code)

  const NZ_BOUNDS_T    = { minLat: -52, maxLat: -29, minLng: 163, maxLng: 180 };
  const SAMOA_BOUNDS_T = { minLat: -15.0, maxLat: -13.0, minLng: -173.5, maxLng: -168.0 };

  function getActiveCountry() {
    const c = map.getCenter();
    const lng = ((c.lng + 180) % 360 + 360) % 360 - 180;
    if (c.lat >= NZ_BOUNDS_T.minLat && c.lat <= NZ_BOUNDS_T.maxLat &&
        lng    >= NZ_BOUNDS_T.minLng && lng    <= NZ_BOUNDS_T.maxLng) return 'NZ';
    if (c.lat >= SAMOA_BOUNDS_T.minLat && c.lat <= SAMOA_BOUNDS_T.maxLat &&
        lng    >= SAMOA_BOUNDS_T.minLng && lng    <= SAMOA_BOUNDS_T.maxLng) return 'WS';
    return null;
  }

  // ── Taxonomy cache persistence (localStorage, 7-day TTL) ────────────────
  const LS_TAXO_KEY    = 'occurd_taxoCache_v1';
  const LS_TAXO_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  let _taxoSaveTimer   = null;

  function loadTaxoCacheFromStorage() {
    try {
      const raw = localStorage.getItem(LS_TAXO_KEY);
      if (!raw) return;
      const { ts, data } = JSON.parse(raw);
      if (!ts || Date.now() - ts > LS_TAXO_TTL_MS) { localStorage.removeItem(LS_TAXO_KEY); return; }
      Object.entries(data).forEach(([k, v]) => { taxoCache[k] = v; });
    } catch(e) { /* corrupt — ignore */ }
  }

  function saveTaxoCacheToStorage() {
    clearTimeout(_taxoSaveTimer);
    _taxoSaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(LS_TAXO_KEY, JSON.stringify({ ts: Date.now(), data: taxoCache }));
      } catch(e) { /* storage full — ignore */ }
    }, 800); // batch concurrent saves into one write
  }

  // ── NZ cache persistence (localStorage, 30-day TTL) ──────────────────────
  const LS_KEY    = 'occurd_nzCache_v1';
  const LS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  function loadNZCacheFromStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const { ts, data } = JSON.parse(raw);
      if (!ts || Date.now() - ts > LS_TTL_MS) { localStorage.removeItem(LS_KEY); return; }
      // Deserialise: each value is either null or an array of [key, count] pairs
      Object.entries(data).forEach(([k, v]) => {
        nzCache[k] = v === null ? null : new Map(v);
      });
    } catch(e) { /* corrupt entry — ignore */ }
  }

  function saveNZCacheToStorage() {
    try {
      const data = {};
      Object.entries(nzCache).forEach(([k, v]) => {
        data[k] = v === null ? null : [...v.entries()];
      });
      localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch(e) { /* storage full or unavailable — ignore */ }
  }

  loadTaxoCacheFromStorage(); // populate taxoCache from previous session if fresh
  loadNZCacheFromStorage();  // populate nzCache from previous session if fresh
  const navStack = [];   // [{cols, selIdx, selNodes}] for back navigation

  let cols      = [KINGDOMS, ...Array.from({length: NUM_COLS-1}, () => [])];
  let selIdx    = new Array(NUM_COLS).fill(-1);
  let selNodes  = new Array(NUM_COLS).fill(null);
  let jumpAncestry      = [];   // [{key,name,rank}…] set after a search jump, for breadcrumb
  let millerSearchTimer = null; // debounce handle
  let _jumpSeq          = 0;   // incremented on every navigation; stale async ops check this
  let _searchSeq        = 0;   // incremented on each search; stale GBIF callbacks bail out

  // ── Render ────────────────────────────────────────────────────────────────
  const COL_HEADERS = ['Kingdom', 'Phylum', 'Class', 'Order', 'Family', 'Genus', 'Species'];

  // Derive a column header from the actual rank of the items in that column,
  // falling back to the position-based label when the column is empty.
  function colHeaderLabel(ci) {
    const nodes = cols[ci];
    if (nodes && nodes.length > 0 && nodes[0].rank) {
      return rankLabel(nodes[0].rank);
    }
    return COL_HEADERS[ci] || 'Taxa';
  }

  function renderCol(ci) {
    const colEl = document.getElementById('millerCol' + ci);
    if (!colEl) return;
    colEl.innerHTML = '';

    const nodes = cols[ci];
    const hasContent = nodes && nodes.length > 0;

    // Column header: blank for empty columns (e.g. unused left-hand columns when
    // the selected taxon is shallower than the full 7-column depth)
    const hdr = document.createElement('div');
    hdr.className = 'miller-col-hdr';
    hdr.textContent = hasContent ? colHeaderLabel(ci) : '';
    colEl.appendChild(hdr);

    if (!hasContent) {
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

      // Wrap name (+ optional common name) so they stack vertically inside the flex row
      const textGroup = document.createElement('div');
      textGroup.className = 'miller-text';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'miller-name';
      nameSpan.textContent = name;
      textGroup.appendChild(nameSpan);

      // Common name — species only; local names first (NZOR for NZ, Samoa names for WS), fall back to GBIF
      if (node.rank === 'SPECIES') {
        const cc = getActiveCountry();
        let common = '';
        if (cc === 'WS' && typeof window.getSamoaVernacular === 'function')
          common = window.getSamoaVernacular(name);
        if (!common && typeof window.getNzorVernacular === 'function')
          common = window.getNzorVernacular(name);
        // GBIF backbone includes vernacularName on some species — use as fallback
        // Apply ASCII+macron filter so non-English names (é, ñ, etc.) are excluded
        if (!common && node.vernacularName &&
            !/[^\x00-\x7FāēīōūĀĒĪŌŪ]/.test(node.vernacularName))
          common = node.vernacularName;
        if (common) {
          const commonSpan = document.createElement('span');
          commonSpan.className = 'miller-common';
          commonSpan.textContent = common;
          textGroup.appendChild(commonSpan);
        }
      }

      item.appendChild(textGroup);

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

    // Auto-widen the modal when the species (rightmost) column is rendered
    setTimeout(autoWidenModal, 0);
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
      const res = await gbifFetch('https://api.gbif.org/v1/species/' + anchor.key + '/parents');
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

  // Fetch child taxon keys that have occurrence records in the active country (NZ or WS),
  // with their record counts. parentKey=null → root level.
  // Returns a Map<string, number> (key → count), or null on failure / no active country.
  async function getGeoKeys(parentKey, parentRank) {
    const cc = getActiveCountry();
    if (!cc) return null;
    const cacheKey = cc + ':' + (parentKey || 'root');
    if (nzCache[cacheKey] !== undefined) return nzCache[cacheKey];
    let facetField, baseUrl;
    if (!parentKey) {
      facetField = 'kingdomKey';
      baseUrl    = 'https://api.gbif.org/v1/occurrence/search?country=' + cc + '&limit=0';
    } else {
      facetField = RANK_TO_CHILD_FACET[parentRank];
      if (!facetField) { nzCache[cacheKey] = null; return null; }
      baseUrl = 'https://api.gbif.org/v1/occurrence/search?country=' + cc + '&taxonKey=' + parentKey + '&limit=0';
    }
    try {
      const res = await fetch(baseUrl + '&facet=' + facetField + '&facetLimit=1000&facetMincount=1');
      if (!res.ok) throw new Error('HTTP '+res.status);
      const j = await res.json();
      const counts = new Map((j.facets?.[0]?.counts || []).map(c => [String(c.name), c.count]));
      nzCache[cacheKey] = counts;
      saveNZCacheToStorage();
      return counts;
    } catch(e) {
      nzCache[cacheKey] = null;
      return null;
    }
  }

  // Fetch taxonomy children for parentKey — rank-filtered, ACCEPTED, sorted by name.
  // Fast taxonomy API only; no NZ filtering. Results cached in taxoCache.
  // onFirstPage(partial) is called after the first page if more pages remain — lets
  // the caller render immediately without waiting for all pages to complete.
  function fetchTaxoChildren(parentKey, onFirstPage) {
    if (taxoCache[parentKey] !== undefined) return Promise.resolve(taxoCache[parentKey]);
    // Re-use an in-flight promise to avoid duplicate fetches (no [] sentinel needed)
    if (taxoInFlight[parentKey]) return taxoInFlight[parentKey];
    const promise = (async () => {
      try {
        const all = [];
        let offset = 0;
        while (true) {
          // limit=500, not 200 — COL XR's class-rank nodes (e.g. Aves) mix ~40 real orders
          // with ~180 incertae-sedis fossil genera/families placed directly under the class,
          // pushing some columns past 200 children. A second sequential page for one column
          // makes Promise.all (all columns load in parallel) wait on it — confirmed live this
          // roughly doubles that column's load time. 500 fits Aves' ~220 children in one request
          // at the same per-request latency as 200, at no real cost for the common case of fewer.
          const res = await gbifFetch('https://api.gbif.org/v1/species/' + parentKey + '/children?limit=500&offset=' + offset);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const j = await res.json();
          (j.results || []).forEach(x => {
            if (x.rank && !JUNK_RANKS.has(x.rank) &&
                (!x.taxonomicStatus || x.taxonomicStatus === 'ACCEPTED' || x.taxonomicStatus === 'DOUBTFUL'))
              all.push(x);
          });
          // After first page, if more pages remain, surface partial results immediately
          if (offset === 0 && !j.endOfRecords && onFirstPage && all.length > 0) {
            const partial = [...all].sort((a, b) => (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99) || (a.canonicalName || '').localeCompare(b.canonicalName || ''));
            onFirstPage(partial);
          }
          if (j.endOfRecords) break;
          offset += 500;
        }
        // Sort by rank hierarchy first so higher ranks (Phylum) appear before lower (Family/Genus)
        // even when GBIF mixes ranks as direct children (e.g. incertae sedis placements)
        all.sort((a, b) =>
          (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99) ||
          (a.canonicalName || '').localeCompare(b.canonicalName || '')
        );
        taxoCache[parentKey] = all;
        saveTaxoCacheToStorage(); // persist for next session
      } catch(e) { /* don't cache failures — allow retry */ }
      delete taxoInFlight[parentKey];
      return taxoCache[parentKey];
    })();
    taxoInFlight[parentKey] = promise;
    return promise;
  }

  // Apply NZ occurrence filter and attach counts. Falls back to full list if filtering
  // would wipe everything (intermediate ranks like Subfamily don't appear in facets).
  // Matches on nubKey, not key — the facet counts come from occurrence data, which only
  // understands the legacy GBIF backbone, not COL XR's own internal keys. Nodes with no
  // nubKey (no legacy equivalent, e.g. brand-new COL XR taxa) just get no count badge.
  function nzFilterAndCount(children, nzKeys) {
    if (!children) return [];   // guard: fetch may have failed and returned undefined
    if (!nzKeys || !nzKeys.size) {
      children.forEach(c => { c._nzCount = null; });
      return children;
    }
    const filtered = children.filter(c => c.nubKey != null && nzKeys.has(String(c.nubKey)));
    const result = filtered.length > 0 ? filtered : children;
    result.forEach(c => { c._nzCount = (c.nubKey != null && nzKeys.get(String(c.nubKey))) || null; });
    return result;
  }

  // Two-phase column loader:
  //   Phase 1 — taxonomy (fast API, often cached): renders column immediately.
  //   Phase 2 — NZ counts (slow faceted search): runs in background, re-renders
  //             when done. If NZ data is already cached from a prior loadSiblings
  //             call, phase 2 is instant.
  async function loadCol(ci, parentNode) {
    const key    = parentNode.key;
    const nubKey = parentNode.nubKey; // legacy numeric key — for NZ-count faceting only
    const mySeq = _jumpSeq;

    showLoadingPhrase(); // always show on every column click

    // Phase 1 — taxonomy
    let children = taxoCache[key];
    if (children === undefined) {
      // Show loading indicator only when taxonomy isn't cached yet
      const colEl = document.getElementById('millerCol' + ci);
      if (colEl) {
        colEl.innerHTML = '';
        const hdr = document.createElement('div');
        hdr.className = 'miller-col-hdr';
        hdr.textContent = COL_HEADERS[ci] || 'Taxa';
        colEl.appendChild(hdr);
        const msg = document.createElement('div');
        msg.className = 'miller-msg';
        msg.textContent = 'Loading…';
        colEl.appendChild(msg);
      }
      // Pass onFirstPage callback — renders partial names after page 1 if more pages follow
      children = await fetchTaxoChildren(key, (partial) => {
        if (_jumpSeq !== mySeq) return;
        cols[ci] = partial;
        renderCol(ci);
        updateHint();
        updateAddBtn();
      });
      if (_jumpSeq !== mySeq) { hideLoadingPhrase(); return; }
      if (!children) { hideLoadingPhrase(); cols[ci] = []; renderCol(ci); return; }
    }

    // Final render with complete results + geo filter if cached
    const _cc = getActiveCountry();
    const cachedNZ = (_cc && nubKey != null) ? nzCache[_cc + ':' + nubKey] : undefined;
    cols[ci] = (cachedNZ !== undefined) ? nzFilterAndCount(children, cachedNZ) : children;
    renderCol(ci);
    updateHint();
    updateAddBtn();

    // Phase 2 — NZ counts in background (skipped if already cached, or if this node
    // has no legacy equivalent at all — nothing to facet against)
    if (cachedNZ === undefined && nubKey != null) {
      getGeoKeys(nubKey, parentNode.rank).then(nzKeys => {
        hideLoadingPhrase(); // hide after Phase 2 completes
        if (_jumpSeq !== mySeq) return;
        cols[ci] = nzFilterAndCount(children, nzKeys);
        renderCol(ci);
        updateHint();
        updateAddBtn();
      }).catch(() => hideLoadingPhrase());
    } else {
      hideLoadingPhrase(); // everything was cached — hide now (2s minimum still applies)
    }
  }

  // Load the kingdoms column — Phase 1 renders all kingdoms instantly (static list),
  // Phase 2 fetches NZ counts in background and filters to NZ-present kingdoms.
  async function loadKingdoms() {
    const mySeq = _jumpSeq;
    // Phase 1 — render all kingdoms immediately, no counts yet
    cols[0] = KINGDOMS.map(k => ({ ...k, _nzCount: null }));
    renderCol(0);
    updateHint();
    updateBackBtn();
    // Phase 2 — NZ counts in background
    const nzKeys = await getGeoKeys(null, null);
    if (_jumpSeq !== mySeq) return;
    const kingdoms = (nzKeys && nzKeys.size > 0)
      ? KINGDOMS.filter(k => k.nubKey != null && nzKeys.has(String(k.nubKey)))
      : [...KINGDOMS];
    kingdoms.forEach(k => { k._nzCount = (nzKeys && k.nubKey != null) ? (nzKeys.get(String(k.nubKey)) || null) : null; });
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
      // jumpAncestry = [kingdom … parent, target] — already includes target so DON'T
      // append selNodes (that caused full ancestry to appear twice).
      const all = jumpAncestry;
      if (all.length <= 4) {
        all.forEach(n => parts.push(nodeName(n)));
      } else {
        parts.push(nodeName(all[0]));              // Kingdom
        parts.push('…');
        parts.push(nodeName(all[all.length - 2])); // Direct parent
        parts.push(nodeName(all[all.length - 1])); // Target taxon
      }
    } else {
      if (navStack.length > 0) {
        const f0 = navStack[0];
        const anchor = f0.selNodes.find(n => n);
        if (anchor) parts.push(nodeName(anchor));
        if (navStack.length > 1) parts.push('…');
      }
      selNodes.forEach(n => { if (n) parts.push(nodeName(n)); });
    }
    el.textContent = parts.length ? parts.join(' › ') : 'Select a kingdom to start';
  }

  // ── Auto-widen modal to fit species names ────────────────────────────────────
  let _txCanvas = null;
  function _textWidth(str) {
    if (!_txCanvas) _txCanvas = document.createElement('canvas');
    const ctx = _txCanvas.getContext('2d');
    ctx.font = '12px Inter, system-ui, -apple-system, sans-serif';
    return ctx.measureText(str).width;
  }

  function autoWidenModal() {
    const box = document.querySelector('.taxo-box');
    if (!box) return;

    let totalExtra = 0;
    for (let ci = 0; ci < NUM_COLS; ci++) {
      const items = cols[ci];
      if (!items || !items.length) continue;
      const colEl = document.getElementById('millerCol' + ci);
      if (!colEl) continue;

      let maxNameW = 0;
      items.forEach(node => {
        const name = node.canonicalName || node.scientificName || node.name || '';
        maxNameW = Math.max(maxNameW, _textWidth(name));
      });

      // Desired col width = longest name + count badge + arrow + padding
      // Last col gets a slightly larger allowance for the species column
      const overhead = (ci === NUM_COLS - 1) ? 90 : 72;
      const desired = maxNameW + overhead;
      const currentColW = colEl.getBoundingClientRect().width;
      if (desired > currentColW) {
        totalExtra += Math.ceil(desired - currentColW);
      }
    }

    if (totalExtra > 0) {
      const boxW = box.getBoundingClientRect().width;
      const maxW = window.innerWidth * 0.96;
      box.style.width = Math.round(Math.min(boxW + totalExtra, maxW)) + 'px';
    }
  }

  function updateAddBtn() {
    const btn = document.getElementById('taxoAddBtn');
    if (!btn) return;
    const hit = getSelected();
    if (hit) {
      const name = nodeName(hit.node);
      const rank = rankLabel(hit.node.rank) || 'taxon';
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

  // Merge, deduplicate and rank results from multiple sources.
  function _mergeSearchResults(rawResults, q) {
    const seen = new Set();
    const results = [];
    for (const r of rawResults) {
      const dk = r.gbifKey ? String(r.gbifKey) : ('nzor_' + r.display);
      if (!seen.has(dk)) { seen.add(dk); results.push(r); }
    }
    // Second-pass: deduplicate by display name (case-insensitive), keeping the entry
    // with a gbifKey (which carries rank) over a rank-less local entry.
    const byName = new Map();
    for (const r of results) {
      const nl = r.display.toLowerCase();
      const prev = byName.get(nl);
      if (!prev || (!prev.gbifKey && r.gbifKey)) byName.set(nl, r);
    }
    const deduped = results.filter(r => byName.get(r.display.toLowerCase()) === r);
    const ql = q.toLowerCase();
    deduped.sort((a, b) => {
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
    return deduped;
  }

  async function doMillerSearch(q) {
    const mySeq = ++_searchSeq;
    const drop = document.getElementById('millerDrop');
    if (!drop) return;
    drop.innerHTML = '<div class="miller-sug-msg">Searching…</div>';
    drop.style.display = '';

    // Phase 1 — local search (NZOR + NVS + Samoa are in-memory lookups, no network)
    const [nzorResults, nvsResults, samoaResults] = await Promise.all([searchNzor(q), searchNvsForTaxo(q), searchSamoaForTaxo(q)]);
    if (_searchSeq !== mySeq) return;

    const initial = _mergeSearchResults([...samoaResults, ...nzorResults, ...nvsResults], q);
    if (initial.length > 0) showMillerDrop(initial);

    // Phase 2 — GBIF search (network, slower)
    const [gbifResults, gbifFullResults] = await Promise.all([searchGbif(q), searchGbifFull(q)]);
    if (_searchSeq !== mySeq) return;

    const all = _mergeSearchResults([...samoaResults, ...nzorResults, ...nvsResults, ...gbifFullResults, ...gbifResults], q);
    showMillerDrop(all);
  }

  async function searchNvsForTaxo(q) {
    if (typeof window._nvsSearch !== 'function') return [];
    const hits = window._nvsSearch(q).slice(0, 8);
    return hits.map(h => ({
      type:     'scientific',
      display:  h.sci,
      subLabel: 'NVS ' + h.nvscode.toUpperCase(),
      // NVS entries are almost always binomials; only label 2-word names as Species
      rank:     (h.sci && h.sci.trim().split(/\s+/).length === 2) ? 'Species' : '',
      gbifKey:  null,
      nzorData: null,
      nvsSci:   h.sci,
    }));
  }

  async function searchSamoaForTaxo(q) {
    if (typeof window._samoaSearch !== 'function') return [];
    const hits = window._samoaSearch(q).slice(0, 20);
    return hits.map(h => ({
      type:     'vernacular',
      display:  h.samoan || h.english,
      subLabel: h.sci || '',
      rank:     (h.sci && h.sci.trim().split(/\s+/).length === 2) ? 'Species' : '',
      gbifKey:  null,
      nzorData: { cls: 'samoa', n: h.samoan || h.english, sci: h.sci },
    }));
  }

  async function searchNzor(q) {
    if (typeof window._nzorSearch !== 'function') return [];
    const hits = window._nzorSearch(q).slice(0, 20);
    return hits.map(h => ({
      type:     (h.cls === 'v' || h.cls === 'g') ? 'vernacular' : 'scientific',
      display:  h.n,
      subLabel: h.sci || '',
      rank:     '',   // NZOR covers all ranks — don't guess from word count
      gbifKey:  null,
      nzorData: h,
    }));
  }

  async function searchGbif(q) {
    try {
      const url = 'https://api.gbif.org/v1/species/suggest?datasetKey=7ddf754f-d193-4cc9-b351-99906754a03b&q='
                + encodeURIComponent(q) + '&limit=10';
      const res = await fetch(url);
      if (!res.ok) return [];
      const arr = await res.json();
      return arr.map(s => ({
        type:     'scientific',
        display:  s.canonicalName || s.scientificName || s.name || '?',
        subLabel: s.family || s.order || '',
        rank:     rankLabel(s.rank),
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
                + '&datasetKey=7ddf754f-d193-4cc9-b351-99906754a03b&limit=8&status=ACCEPTED';
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
          rank:     rankLabel(s.rank),
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
      // NZOR covers all ranks but its name index carries no rank metadata, so
      // family/order/class hits (e.g. "Psittacidae") show with no badge at first,
      // looking indistinguishable from a typo. Resolve the real rank in the
      // background and patch the badge in once known — this also caches the
      // gbifKey so a click resolves instantly instead of re-matching.
      if (!r.rank && !r.gbifKey && r.nzorData) _lazyResolveRank(row, r);
    });
    drop.style.display = '';
  }

  // Resolve an already-correct scientific name (from NZOR/NVS/Samoa's curated local
  // data, not free-typed user input) to its COL XR node. species/match has no COL XR
  // equivalent (it silently ignores checklistKey/datasetKey), so this uses species/search
  // instead and picks the best exact-canonical-name match — names from these curated
  // sources are already clean/correctly-spelled, so search's lack of fuzzy/typo tolerance
  // (which species/match has) isn't a problem here. Returns the COL XR numeric key (for
  // browsing via /children, /parents — those reject the alphanumeric taxonID form) plus
  // rank and taxonID, or null if nothing matched.
  async function _resolveColXrName(sci) {
    try {
      const url = 'https://api.gbif.org/v1/species/search?q='
                + encodeURIComponent(sci)
                + '&datasetKey=' + COL_XR_CHECKLIST_KEY + '&limit=10&status=ACCEPTED';
      const res = await fetch(url);
      if (!res.ok) return null;
      const j = await res.json();
      const sciLow = sci.toLowerCase();
      const exact = (j.results || []).find(r => (r.canonicalName || '').toLowerCase() === sciLow)
                 || (j.results || [])[0];
      if (!exact || !exact.rank) return null;
      return { key: exact.key, rank: exact.rank, taxonID: exact.taxonID || null };
    } catch(e) { return null; }
  }

  async function _lazyResolveRank(rowEl, result) {
    const sci = result.nzorData.sci || result.nzorData.n;
    if (!sci) return;
    const hit = await _resolveColXrName(sci);
    if (!hit) return;
    result.rank     = rankLabel(hit.rank);
    result.gbifKey  = hit.key;     // cache — resolveAndJump skips re-matching on click
    result.taxonID  = hit.taxonID;
    if (!rowEl.isConnected) return; // dropdown may have closed/re-rendered by now
    let rankEl = rowEl.querySelector('.miller-sug-rank');
    if (!rankEl) {
      rankEl = document.createElement('span');
      rankEl.className = 'miller-sug-rank';
      rowEl.appendChild(rankEl);
    }
    rankEl.textContent = result.rank;
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
      const hit = await _resolveColXrName(sciToResolve);
      if (hit) gbifKey = hit.key;
    }
    if (!gbifKey) return; // can't resolve — nothing to show

    if (inp) inp.value = result.display;
    if (clr) clr.style.display = '';
    await jumpToTaxon(gbifKey);
  }

  // Load the children of parentNode from cache or API, always keeping mustIncludeKey present.
  // Returns a sorted, NZ-filtered children array.
  // Used by drillUp: fetches parent's siblings with NZ filter (both phases together
  // since the result is needed immediately for state update).
  async function loadSiblings(parentNode, mustIncludeKey) {
    if (!parentNode) {
      const nzKeys = await getGeoKeys(null, null);
      const kds = (nzKeys && nzKeys.size > 0)
        ? KINGDOMS.filter(k => k.nubKey != null && nzKeys.has(String(k.nubKey)))
        : [...KINGDOMS];
      kds.forEach(k => { k._nzCount = (nzKeys && k.nubKey != null) ? (nzKeys.get(String(k.nubKey)) || null) : null; });
      return kds;
    }
    const parentKey = parentNode.key;
    const [children, nzKeys] = await Promise.all([
      fetchTaxoChildren(parentKey),
      parentNode.nubKey != null ? getGeoKeys(parentNode.nubKey, parentNode.rank) : Promise.resolve(null),
    ]);
    let result = nzFilterAndCount(children, nzKeys);
    // Always keep must-include key even if NZ filter would remove it
    if (mustIncludeKey && !result.some(c => c.key === mustIncludeKey)) {
      const keep = children.find(c => c.key === mustIncludeKey);
      if (keep) result = [keep, ...result];
    }
    return result;
  }

  async function jumpToTaxon(gbifKey) {
    const mySeq = ++_jumpSeq;
    showLoadingPhrase();
    try {
      const [taxonRes, parentsRes] = await Promise.all([
        gbifFetch('https://api.gbif.org/v1/species/' + gbifKey),
        gbifFetch('https://api.gbif.org/v1/species/' + gbifKey + '/parents'),
      ]);
      if (!taxonRes.ok || !parentsRes.ok) return;
      const taxon   = await taxonRes.json();
      const parents = await parentsRes.json();
      if (_jumpSeq !== mySeq) return;

      jumpAncestry = [...parents, taxon];
      navStack.length = 0;
      cols     = Array.from({length: NUM_COLS}, () => []);
      selIdx   = new Array(NUM_COLS).fill(-1);
      selNodes = new Array(NUM_COLS).fill(null);
      renderAll();

      const depth = parents.length;
      if (!depth) {
        cols[0] = [taxon]; selIdx[0] = 0; selNodes[0] = taxon;
        renderAll(); updateCrumb(); updateAddBtn();
        return;
      }

      // ── Phase 1: taxonomy only (fast) ────────────────────────────────────────
      // For each of the NUM_COLS-1 pre-loaded columns, fetch taxonomy children
      // in parallel without waiting for slow NZ occurrence counts.
      const taxoLoaders = [];
      for (let ci = 0; ci < NUM_COLS - 1; ci++) {
        const srcIdx = depth - NUM_COLS + ci;
        const hiIdx  = depth - NUM_COLS + ci + 1;
        if (hiIdx < 0) { taxoLoaders.push(Promise.resolve(null)); continue; }
        const srcNode = srcIdx < 0 ? null : parents[srcIdx];
        const mustKey = hiIdx < depth ? parents[hiIdx].key : taxon.key;
        if (!srcNode) {
          // No parent → kingdom list
          taxoLoaders.push(Promise.resolve({ nodes: [...KINGDOMS], hiIdx, mustKey, srcNode: null }));
        } else {
          taxoLoaders.push(
            fetchTaxoChildren(srcNode.key).then(nodes => {
              if (!nodes) return null;  // fetch failed — skip this column
              // Ensure the highlighted ancestor is present even if not in the child list
              let result = nodes;
              if (mustKey && !nodes.some(n => n.key === mustKey)) {
                const target = hiIdx < depth ? parents[hiIdx] : taxon;
                result = [target, ...nodes];
              }
              return { nodes: result, hiIdx, mustKey, srcNode };
            }).catch(() => null)
          );
        }
      }

      const loaded = await Promise.all(taxoLoaders);
      if (_jumpSeq !== mySeq) return;

      // Apply selections based on ancestry (no NZ filter yet — columns show full taxonomy)
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

      for (let ci = 0; ci < NUM_COLS - 1; ci++) {
        const colEl = document.getElementById('millerCol' + ci);
        if (colEl) {
          const sel = colEl.querySelector('.miller-item.miller-sel');
          if (sel) setTimeout(() => sel.scrollIntoView({ block: 'center' }), 0);
        }
      }

      // Rightmost column: taxonomy first (fast)
      const lastSrc = selNodes[NUM_COLS - 2];
      if (!lastSrc || !lastSrc.key) return;

      const lastChildren = await fetchTaxoChildren(lastSrc.key);
      if (_jumpSeq !== mySeq) return;

      // Apply cached geo filter if already available (from a prior search of the same taxa)
      const _cc2 = getActiveCountry();
      const cachedLastNZ = (_cc2 && lastSrc.nubKey != null) ? nzCache[_cc2 + ':' + lastSrc.nubKey] : undefined;
      cols[NUM_COLS - 1] = (cachedLastNZ !== undefined)
        ? nzFilterAndCount(lastChildren, cachedLastNZ)
        : lastChildren;
      renderCol(NUM_COLS - 1);

      const highlightInLast = cols[NUM_COLS - 1].findIndex(n => n.key === gbifKey);
      if (highlightInLast >= 0) {
        selIdx[NUM_COLS - 1]   = highlightInLast;
        selNodes[NUM_COLS - 1] = cols[NUM_COLS - 1][highlightInLast];
        renderCol(NUM_COLS - 1);
        updateAddBtn();
        const lastColEl = document.getElementById('millerCol' + (NUM_COLS - 1));
        if (lastColEl) {
          const sel = lastColEl.querySelector('.miller-item.miller-sel');
          if (sel) setTimeout(() => sel.scrollIntoView({ block: 'center' }), 0);
        }
      }

      // ── Phase 2: NZ filter + counts in background ────────────────────────────
      // Each column updates independently as its NZ data arrives.
      for (let ci = 0; ci < NUM_COLS - 1; ci++) {
        const res = loaded[ci];
        if (!res || !res.srcNode) continue;  // skip kingdom cols (srcNode===null)
        const { nodes, hiIdx, mustKey, srcNode } = res;
        ;(async (ci, srcNode, nodes, mustKey) => {
          const nzKeys = srcNode.nubKey != null ? await getGeoKeys(srcNode.nubKey, srcNode.rank) : null;
          if (_jumpSeq !== mySeq) return;
          let displayed = nzFilterAndCount(nodes, nzKeys);
          // Keep the selected ancestor visible even if NZ-filtered-out
          if (mustKey && !displayed.some(n => n.key === mustKey)) {
            const keep = nodes.find(n => n.key === mustKey);
            if (keep) displayed = [keep, ...displayed];
          }
          cols[ci] = displayed;
          const si = displayed.findIndex(n => n.key === mustKey);
          if (si >= 0) { selIdx[ci] = si; selNodes[ci] = displayed[si]; }
          renderCol(ci);
          updateCrumb();
        })(ci, srcNode, nodes, mustKey);
      }

      // NZ for rightmost column
      if (cachedLastNZ === undefined && lastSrc.nubKey != null) {
        ;(async () => {
          const nzKeys = await getGeoKeys(lastSrc.nubKey, lastSrc.rank);
          if (_jumpSeq !== mySeq) return;
          const displayed = nzFilterAndCount(lastChildren, nzKeys);
          cols[NUM_COLS - 1] = displayed;
          const li = displayed.findIndex(n => n.key === gbifKey);
          if (li >= 0) {
            selIdx[NUM_COLS - 1]   = li;
            selNodes[NUM_COLS - 1] = displayed[li];
          }
          renderCol(NUM_COLS - 1);
          updateAddBtn();
        })();
      }

    } catch(e) {
      console.warn('jumpToTaxon error:', e);
    } finally {
      hideLoadingPhrase();
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
    // Reset any auto-widening so the modal returns to its CSS default width
    const box = document.querySelector('.taxo-box');
    if (box) box.style.width = '';
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
        // taxonID (COL XR's native alphanumeric code), not key (COL XR's internal numeric
        // id) — only taxonID works as an occurrence taxonKey filter once paired with
        // checklistKey; the numeric key returns zero records if used the same way.
        window.addSpeciesEntry(nodeName(node), node.taxonID || node.key, null);
      close();
    });
    initSearch();
  });
})();
