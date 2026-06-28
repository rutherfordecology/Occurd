// ── Name resolver ────────────────────────────────────────────────────────────
// Generic, app-agnostic common-name -> scientific-name lookup. Knows nothing
// about Occurd's map, GBIF, or UI — it just orchestrates a set of pluggable
// "sources" (NZOR, Samoa names, NVS codes, or a fork's own species list) and
// hands back candidates / disambiguation options for the caller to render.
//
// Source plugin shape:
//   {
//     key:          string, unique id (e.g. 'nzor')
//     isRelevant(ctx):    optional — false hides this source for the given
//                         context (e.g. map center outside its region)
//     ensureLoaded():     optional async — load data on first use
//     isLoaded():         optional — skip search() until true
//     search(query):      returns an array of candidate items. Each item is
//                          opaque to the resolver except for a `_source` tag
//                          (added automatically) used to route resolve().
//     resolve(item):       given a selected candidate, return either
//                            { ambiguous:false, sci, sciId }
//                          or
//                            { ambiguous:true, options:[{sci,sciId,label?}] }
//   }
(function() {
  const sources = [];

  function registerSource(src) {
    if (!src || !src.key) throw new Error('NameResolver: source needs a unique `key`');
    sources.push(src);
  }

  function relevantSources(ctx) {
    return sources.filter(s => !s.isRelevant || s.isRelevant(ctx));
  }

  async function ensureLoaded(ctx) {
    const active = relevantSources(ctx);
    await Promise.all(active.map(s => s.ensureLoaded ? s.ensureLoaded() : true));
    return active;
  }

  // Merged candidates from every relevant, loaded source.
  async function search(query, ctx) {
    const active = await ensureLoaded(ctx);
    let out = [];
    for (const s of active) {
      if (s.isLoaded && !s.isLoaded()) continue;
      const items = (s.search ? s.search(query) : []) || [];
      out = out.concat(items.map(it => Object.assign({ _source: s.key }, it)));
    }
    return out;
  }

  // Resolve a selected candidate to a scientific name, or a disambiguation
  // option list if the source flags it as ambiguous.
  function resolveItem(item) {
    const src = sources.find(s => s.key === item._source);
    if (src && src.resolve) return src.resolve(item);
    return { ambiguous: false, sci: item.sci || item.n, sciId: item.sciId || null };
  }

  window.NameResolver = { registerSource, search, resolveItem };
})();
