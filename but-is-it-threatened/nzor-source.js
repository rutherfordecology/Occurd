// ── NZOR name-matching source ───────────────────────────────────────────────
// Shared NZ Organisms Register matching core, used by both but-is-it-threatened
// and Occurd's NZ species search. This is NZ-specific (unlike the generic
// name-resolver.js at the repo root), which is why it lives here rather than
// at the root — a fork adding a different country's species list would write
// an equivalent module for its own data, not touch this one.
//
// window.NzorSource.load(opts) -> Promise<{ index, ambiguous, search, lookupKey, resolveItem }>
//   opts.url       - nzor_names_*.json URL (default 'nzor_names_v2.json')
//   opts.nztcsData - optional NZTCS dataset to merge in common/Māori names
//                     and cross-source ambiguity (but-is-it-threatened only;
//                     Occurd's species search omits this)
//
// Doesn't register itself with window.NameResolver — each caller does that
// explicitly (wrapping isRelevant/ensureLoaded/etc. to taste), since two
// callers both auto-registering a 'nzor' source would double up results.
(function() {
  function norm(s) { return s ? s.toLowerCase().replace(/\s+/g, ' ').trim() : ''; }
  function normDia(s) { return norm(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  async function load(opts) {
    opts = opts || {};
    const url = opts.url || 'nzor_names_v2.json';
    const nztcsData = opts.nztcsData || null;

    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const nzorData = await res.json();

    const index = [];
    for (const [key, val] of Object.entries(nzorData)) {
      index.push({ key, kd: normDia(key), ...val });
    }

    // Merge NZTCS common/Māori names — NZ-specific enrichment, only applied
    // when the caller supplies NZTCS data (but-is-it-threatened; Occurd's
    // species search doesn't need it). NZTCS takes priority over an existing
    // NZOR vernacular entry that links to a different species.
    if (nztcsData) {
      const indexByKey = new Map(index.map((x, i) => [x.key, i]));
      for (const [nztcsKey, val] of Object.entries(nztcsData)) {
        const sciName = val.n || capFirst(nztcsKey);
        for (const cn of [val.cn, val.mn]) {
          if (!cn) continue;
          const key = norm(cn);
          if (!key) continue;
          const newEntry = { key, kd: normDia(key), n: cn, cls: 'v', sci: sciName };
          if (indexByKey.has(key)) {
            const idx = indexByKey.get(key);
            const cur = index[idx];
            if (cur.cls === 'v' && norm(cur.sci || '') !== norm(sciName)) index[idx] = newEntry;
          } else {
            indexByKey.set(key, index.length);
            index.push(newEntry);
          }
        }
      }
    }
    index.sort((a, b) => a.key < b.key ? -1 : 1);

    // Ambiguous vernacular names: key -> [{sci, id?}]. Sourced from the
    // 'is vernacular for' links nzor_rebuild/build_index.py captures
    // (single sci, or sciOptions for names that genuinely apply to 2+
    // concepts, e.g. "toatoa"), plus NZTCS common/Māori names when supplied.
    const collect = new Map();
    const add = (key, sci, id) => {
      if (!key || !sci) return;
      if (!collect.has(key)) collect.set(key, []);
      const list = collect.get(key);
      const sn = norm(sci);
      if (!list.some(x => norm(x.sci) === sn)) list.push({ sci, id });
    };
    for (const [key, val] of Object.entries(nzorData)) {
      if (val.cls !== 'v') continue;
      if (val.sciOptions) val.sciOptions.forEach(o => add(key, o.sci, o.sciId));
      else if (val.sci) add(key, val.sci, val.sciId);
    }
    if (nztcsData) {
      for (const val of Object.values(nztcsData)) {
        if (!val.n) continue;
        for (const cn of [val.cn, val.mn]) {
          if (!cn) continue;
          add(norm(cn), val.n);
        }
      }
    }
    // Resolve to accepted names before judging ambiguity, so a name and its
    // own synonym don't falsely look like two different species.
    const accepted = {};
    for (const [key, val] of Object.entries(nzorData)) { if (val.acc) accepted[norm(key)] = norm(val.acc); }
    if (nztcsData) for (const val of Object.values(nztcsData)) { if (val.n) accepted[norm(val.n)] = norm(val.n); }
    const resolveAccepted = sn => accepted[norm(sn)] || norm(sn);

    const ambiguous = {};
    for (const [key, list] of collect) {
      if (list.length < 2) continue;
      const resolved = new Set(list.map(x => resolveAccepted(x.sci)));
      if (resolved.size >= 2) ambiguous[key] = list;
    }

    function search(q) {
      if (!index.length) return [];
      const qd = normDia(q);
      if (qd.length < 2) return [];
      const prefix = [], contains = [];
      for (const item of index) {
        if (item.kd.startsWith(qd)) prefix.push(item);
        else if (contains.length < 10 && item.kd.includes(qd)) contains.push(item);
      }
      return [...prefix, ...contains];
    }

    // Exact-key lookup via binary search (index is sorted by key), with a
    // diacritic-normalised fallback — used by batch matching where every
    // input is expected to be a single specific name, not a live-typed query.
    function lookupKey(rawName) {
      const key = norm(rawName);
      if (!key) return null;
      const kd = normDia(key);
      let lo = 0, hi = index.length - 1, item = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (index[mid].key === key)      { item = index[mid]; break; }
        else if (index[mid].key < key)   lo = mid + 1;
        else                              hi = mid - 1;
      }
      if (!item) item = index.find(x => x.kd === kd) ?? null;
      return item;
    }

    function resolveItem(item) {
      if (!item) return { ambiguous: false, sci: null };
      if (item.cls === 'v' && ambiguous[item.key]) {
        return { ambiguous: true, options: ambiguous[item.key] };
      }
      if (item.sciOptions && item.sciOptions.length > 1) {
        return { ambiguous: true, options: item.sciOptions.map(o => ({ sci: o.sci, id: o.sciId })) };
      }
      if (item.ambiguous && Array.isArray(item.options)) {
        return { ambiguous: true, options: item.options.map(o => ({ sci: o.sci, id: o.id, label: o.status })) };
      }
      const sci = item.cls === 'v' ? (item.sci || item.n) : item.n;
      return { ambiguous: false, sci, sciId: item.sciId || null };
    }

    return { index, ambiguous, search, lookupKey, resolveItem };
  }

  window.NzorSource = { load };
})();
