// ── NZTCS name resolution ───────────────────────────────────────────────────
// A field-written or searched name rarely spells NZTCS's own name the same
// way: authorities sit inside it, ranks are dropped or added, macrons and
// quotes drift, genera get transferred, subspecies get typed as bare
// binomials. Comparing raw strings invents differences that aren't real and
// hides matches that are.
//
// Ported from qeii-nztcs/lib/names.js — see that project's MATCHING.md for
// the full spec and worked examples. Only Layer 1 (name → taxon) comes
// across; Layer 2 (choosing a subspecies by location) doesn't apply here —
// this tool is never told where a searched or batch-pasted name came from.
//
// Nine passes, weakest last, each refusing to guess: a hand-checked
// correction, exact, canonical, variant (rank markers / quotes / macrons
// folded), prefix (this is how authorities are handled — never strippable by
// rule, so registered instead as a prefix every sharing key agrees on),
// nominate (a bare binomial that NZTCS only assesses at infraspecific rank
// takes the subspecies repeating the epithet — never "most threatened"),
// subsequence, one-letter typo (with transposition), Latin gender, and
// finally dropping to the parent species where NZTCS lists nothing else
// infraspecific under it.
//
// window.NztcsResolver.build(nztcsData, corrections) -> {
//   resolve(raw) -> nztcsData-shaped entry ({n,s,c,y,cn?,mn?}) plus `via`,
//                   or null if nothing resolved
//   isGenusOnly(name) -> bool
// }
(function() {
  const RANK = /^(subsp|ssp|var|f|forma|cv)\.?$/;

  // Informal or undescribed. These resolve by exact match only: "Melicytus
  // aff. alpinus" is not Melicytus alpinus, and the tag letters exist
  // precisely to tell such taxa apart.
  const isInformal = n => /(^|\s)(aff|cf|sp|spp|agg|nov)\b\.?/.test(n);

  const foldMacrons = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const stripQuotes = s => s.replace(/["']/g, '').replace(/\s+/g, ' ').trim();

  // Lowercase, collapse whitespace, straighten quotes and dashes, decode
  // HTML entities. Deliberately does NOT touch rank markers or authorities —
  // the lookup wants first refusal on the fullest form of the name.
  function normalise(name) {
    return (name || '')
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[‐-―]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // Progressively weaker forms of the same written name.
  function variants(name) {
    const n = normalise(name);
    const out = [];
    const push = v => { if (v && !out.includes(v)) out.push(v); };
    push(n);
    push(n.replace(/\b(subsp|ssp|var|f|forma|cv)\.?\s+/g, ''));
    push(stripQuotes(n));
    push(foldMacrons(n));
    push(stripQuotes(foldMacrons(n)));
    return out;
  }

  const words = s => s.split(' ').filter(Boolean);

  // Damerau-Levenshtein, bailing out as soon as it exceeds max. Transposition
  // counts as one edit because it's the commonest typing slip of all.
  function within(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return false;
    const rows = [Array.from({ length: b.length + 1 }, (_, i) => i)];
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      const prev = rows[i - 1], prev2 = rows[i - 2];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
        }
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return false;
      rows[i] = cur;
    }
    return rows[a.length][b.length] <= max;
  }

  // Latin gender endings stripped from every epithet, genus left alone.
  function foldGender(n) {
    const w = n.split(' ');
    return w.map((t, i) => (i === 0 || RANK.test(t) ? t : t.replace(/(us|um|is|es|os|on|a|e|i)$/, ''))).join(' ');
  }

  // Are a's tokens an in-order subsequence of b's? Used to see past an
  // authority sitting inside a name.
  function isSubsequence(a, b) {
    let i = 0;
    for (const t of b) if (i < a.length && a[i] === t) i++;
    return i === a.length;
  }

  // A genus on its own resolves to no taxon — it may span Not Threatened to
  // Nationally Critical — but the record itself is still real.
  const isGenusOnly = name => {
    const n = String(name || '').trim();
    return !!n && !/\s/.test(n);
  };

  function build(nztcsData, corrections) {
    const overrides = new Map();
    for (const rec of (corrections || [])) overrides.set(normalise(rec.written), rec);

    // Every spelling NZTCS offers, in one place: its own keys (which carry
    // authorities and synonyms) plus the accepted names inside them.
    const lookupTable = new Map();
    const addForm = (form, v) => { if (form && !lookupTable.has(form)) lookupTable.set(form, v); };
    for (const [key, v] of Object.entries(nztcsData)) {
      if (!v || !v.n) continue;
      for (const f of [key, normalise(key), stripQuotes(normalise(key)), foldMacrons(normalise(key)),
                       stripQuotes(foldMacrons(normalise(key)))]) addForm(f, v);
      const cn = normalise(v.n);
      for (const f of [cn, stripQuotes(cn), foldMacrons(cn), stripQuotes(foldMacrons(cn))]) addForm(f, v);
    }

    // prefix -> accepted taxon, only where the prefix is unambiguous.
    const byPrefix = new Map();
    {
      const seen = new Map();
      for (const [form, v] of lookupTable) {
        const w = words(form);
        for (let len = 2; len < w.length; len++) {
          if (RANK.test(w[len - 1])) continue; // never end a prefix on "subsp."
          const p = w.slice(0, len).join(' ');
          let s = seen.get(p);
          if (!s) seen.set(p, s = new Set());
          s.add(v.n);
        }
      }
      for (const [p, s] of seen) {
        if (s.size === 1 && !lookupTable.has(p)) {
          byPrefix.set(p, lookupTable.get(normalise([...s][0])) || { n: [...s][0] });
        }
      }
    }

    // Candidates for the one-letter and gender passes, bucketed so a typo
    // search never scans the whole table.
    const fuzzy = new Map();
    const byGenus = new Map();
    const byGender = new Map();
    for (const [form, v] of lookupTable) {
      if (isInformal(form)) continue;
      const w = words(form);
      const b = form[0] + ':' + w.length;
      let a = fuzzy.get(b);
      if (!a) fuzzy.set(b, a = []);
      a.push([form, v]);
      let g = byGenus.get(w[0]);
      if (!g) byGenus.set(w[0], g = []);
      g.push([form, v]);
      const gf = foldGender(form);
      let s = byGender.get(gf);
      if (!s) byGender.set(gf, s = new Map());
      s.set(v.n, v);
    }

    const direct = t => lookupTable.get(t) || (isInformal(t) ? null : byPrefix.get(t)) || null;

    // The nominate infraspecific taxon of a bare binomial, spelled every way
    // NZTCS might write it. Refuses to answer if the spellings disagree about
    // which taxon they mean.
    function nominateOf(t) {
      const [g, s] = words(t);
      const found = new Map();
      for (const form of [`${g} ${s} ${s}`, `${g} ${s} subsp. ${s}`, `${g} ${s} var. ${s}`, `${g} ${s} f. ${s}`]) {
        const hit = direct(form);
        if (hit) found.set(hit.n, hit);
      }
      return found.size === 1 ? [...found.values()][0] : null;
    }

    // The written name is the candidate with an authority (or similar)
    // spliced into the middle of it. Unique matches only.
    function subsequenceOf(t) {
      const w = words(t);
      const bucket = byGenus.get(w[0]) || [];
      const found = new Map();
      for (const [form, v] of bucket) {
        const fw = words(form);
        if (fw.length <= w.length || fw.length > w.length + 2) continue;
        if (isSubsequence(w, fw)) found.set(v.n, v);
      }
      return found.size === 1 ? [...found.values()][0] : null;
    }

    function oneLetterOf(t) {
      const bucket = fuzzy.get(t[0] + ':' + words(t).length) || [];
      const found = new Map();
      for (const [form, v] of bucket) if (within(t, form, 1)) found.set(v.n, v);
      // A genus-only or two-letter difference is not a typo, it's a guess.
      return found.size === 1 ? [...found.values()][0] : null;
    }

    // Every NZTCS taxon sitting under a two-word stem, found from both ends:
    // keys that begin with it, and accepted names that begin with the same
    // two words. Both are needed, because a genus transfer means the written
    // name and the accepted name can share no prefix at all. Used only to
    // guard the parent-species drop below.
    const underStem = new Map();
    {
      const put = (st, v) => {
        let m = underStem.get(st);
        if (!m) underStem.set(st, m = new Map());
        if (!m.has(v.n)) m.set(v.n, v);
      };
      for (const [key, v] of Object.entries(nztcsData)) {
        if (!v || !v.n) continue;
        for (const form of [normalise(key), normalise(v.n)]) {
          const w = words(form);
          if (w.length >= 3) put(w.slice(0, 2).join(' '), v);
        }
      }
    }

    function lookup(raw) {
      // A genus on its own resolves to nothing, before anything else runs.
      if (isGenusOnly(raw)) return null;
      const ov = overrides.get(normalise(raw));
      if (ov) {
        const target = nztcsData[normalise(ov.nztcs_name)] || lookupTable.get(normalise(ov.nztcs_name));
        if (target) return { v: target, via: 'name override' };
        if (ov.status) {
          return { v: { n: ov.nztcs_name, s: ov.status, c: ov.category, y: ov.year }, via: 'name override' };
        }
        console.warn(`nztcs-resolver: correction "${ov.written}" points at "${ov.nztcs_name}", which NZTCS does not have and no status was given`);
        return null;
      }
      const tried = variants(raw);
      for (let i = 0; i < tried.length; i++) {
        const hit = lookupTable.get(tried[i]);
        if (hit) return { v: hit, via: i === 0 ? 'exact' : 'variant' };
      }
      for (const t of tried) {
        if (isInformal(t)) continue;
        const hit = byPrefix.get(t);
        if (hit && hit.n) return { v: hit, via: 'prefix' };
      }
      for (const t of tried) {
        if (isInformal(t) || words(t).length !== 2) continue;
        const hit = nominateOf(t);
        if (hit) return { v: hit, via: 'nominate' };
      }
      for (const t of tried) {
        if (isInformal(t) || words(t).length < 2) continue;
        const hit = subsequenceOf(t);
        if (hit) return { v: hit, via: 'subsequence' };
      }
      for (const t of tried) {
        if (isInformal(t) || words(t).length < 2) continue;
        const hit = oneLetterOf(t);
        if (hit) return { v: hit, via: 'one letter' };
      }
      for (const t of tried) {
        if (isInformal(t) || words(t).length < 2) continue;
        const s = byGender.get(foldGender(t));
        if (s && s.size === 1) return { v: [...s.values()][0], via: 'gender' };
      }
      // A trinomial NZTCS assesses at species rank. Dropping the epithet is
      // safe ONLY where NZTCS lists nothing infraspecific under that
      // binomial — otherwise it discards the one thing telling subspecies
      // apart, which is how a Chatham Island form reaches the mainland.
      for (const t of tried) {
        if (isInformal(t)) continue;
        const w = words(t).filter(x => !RANK.test(x));
        if (w.length < 3) continue;
        const bi = w.slice(0, 2).join(' ');
        const parent = lookupTable.get(bi) || byPrefix.get(bi);
        if (!parent || !parent.n) continue;
        // "Nothing infraspecific under it" means no OTHER taxon, not no
        // other string: an accepted-name-with-authority trinomial is the
        // same animal as the parent and must not block the rule.
        const under = underStem.get(bi);
        if (under && [...under.values()].some(v => v.n !== parent.n)) continue;
        return { v: parent, via: 'parent species' };
      }
      return null;
    }

    return {
      isGenusOnly,
      isInformal,
      // nztcsData-shaped entry ({n,s,c,y,cn?,mn?}) plus `via`, or null.
      resolve(raw) {
        const r = lookup(raw);
        return r ? { ...r.v, via: r.via } : null;
      },
    };
  }

  window.NztcsResolver = { build, normalise, isGenusOnly, isInformal };
})();
