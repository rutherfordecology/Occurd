/* ────────────────────────────────────────────────────────────────────────────
   Nudis Near Me — depth / habitat lookup
   ────────────────────────────────────────────────────────────────────────────
   This file is the ONLY place the rockpool-vs-dive split is decided. Nothing in
   the app infers depth from the occurrence records themselves, because neither
   iNaturalist nor GBIF carries a usable depth field for these species (WoRMS
   returns no depth attributes for them either — checked).

   It is deliberately a plain, hand-editable table. Add to it freely.

   zone:
     'rockpool'  reaches the intertidal and is realistically findable at low
                 tide; shown in BOTH lists
     'both'      spans intertidal into the subtidal; shown in BOTH lists
     'dive'      subtidal only; shown ONLY in the diving list
     (absent)    unknown; shown in both lists with a "depth unknown" badge and
                 sorted below the known species

   min / max     metres. best[] is the depth band it is commonest at, if known.
   src           where the figure came from, so future editors can judge it:
                   'gisborne-doc'  Rutherford Ecology's Gisborne rock-pool
                                   document (depth figures summarised there)
                   'genus'         genus-level default from GENUS_ZONES below
                   'general'       widely-reported natural history

   ──────────────────────────────────────────────────────────────────────────── */

const SPECIES_ZONES = {
  // ── Confirmed from Gisborne rock-pool records ────────────────────────────
  'Doris wellingtonensis':      { zone: 'rockpool', min: 0,   max: 20, best: [0, 3],   src: 'gisborne-doc',
                                  tip: "New Zealand's largest nudibranch. Commonest in the top few metres, so a good low-tide prospect." },
  'Ceratosoma amoenum':         { zone: 'both',     min: 0,   max: 40, best: [5, 15],  src: 'gisborne-doc',
                                  tip: 'The clown nudibranch. Reaches the lowest intertidal but is more often seen by divers.' },
  'Alloiodoris lanuginata':     { zone: 'rockpool', min: 0,   max: 17, best: null,     src: 'gisborne-doc',
                                  tip: 'Nocturnal — retreats under stones by day, so turn rocks over (and put them back).' },
  'Dendrodoris krusensternii':  { zone: 'rockpool', min: 0,   max: 20, best: null,     src: 'gisborne-doc',
                                  tip: 'The gem doris. Frequently crawls in the open during the day.' },
  'Baeolidia australis':        { zone: 'rockpool', min: 0,   max: 10, best: null,     src: 'gisborne-doc',
                                  tip: 'Camouflaged on large brown kelp fronds, feeding on the anemone Cricophorus nutrix.' },
  'Doriopsis granulosa':        { zone: 'rockpool', min: 0,   max: 15, best: null,     src: 'general',
                                  tip: 'Glandular dorid. Shallow, often on and under rocks.' },
  'Fiona pinnata':              { zone: 'rockpool', min: 0,   max: 5,  best: null,     src: 'general',
                                  tip: 'Feather aeolid — rafts on floating debris and goose barnacles, so it turns up as drift rather than a resident.' },
  'Tenellia scintillans':       { zone: 'rockpool', min: 0,   max: 10, best: null,     src: 'general',
                                  tip: 'Tiny. Look on hydroids rather than bare rock.' },

  // ── Recorded in the region, intertidal-capable ───────────────────────────
  'Rostanga muscula':           { zone: 'rockpool', min: 0,   max: 2,  best: [0, 1],   src: 'gisborne-doc',
                                  tip: 'Almost exclusively intertidal — one of the few you are more likely to find than a diver is. On red sponges.' },
  'Dendrodoris nigra':          { zone: 'rockpool', min: 0,   max: 5,  best: [0, 1],   src: 'gisborne-doc',
                                  tip: 'Sheltered shores only, never exposed coasts.' },
  'Dendrodoris citrina':        { zone: 'rockpool', min: 0,   max: 11, best: [0, 1],   src: 'gisborne-doc',
                                  tip: 'Tolerates being stranded by the tide, so it survives in pools that dry down.' },
  'Carminodoris nodulosa':      { zone: 'rockpool', min: 0,   max: 12, best: [0, 1],   src: 'gisborne-doc',
                                  tip: 'Commonest intertidally.' },
  'Goniobranchus aureomarginatus': { zone: 'both',  min: 0,   max: 24, best: [5, 10],  src: 'gisborne-doc',
                                  tip: 'Reaches the low intertidal but is commonest well below it.' },
  'Aphelodoris luctuosa':       { zone: 'both',     min: 0,   max: 40, best: [10, 20], src: 'gisborne-doc',
                                  tip: 'More often subtidal, but does reach the shore.' },
  'Cadlina willani':            { zone: 'both',     min: 0,   max: 25, best: [10, 18], src: 'gisborne-doc',
                                  tip: "Willan's nudibranch. More frequent intertidally in the South Island." },

  // ── Subtidal specialists ─────────────────────────────────────────────────
  'Jason mirabilis':            { zone: 'dive',     min: 3,   max: 30, best: [5, 20],  src: 'general',
                                  tip: 'Lives on the hydroid Solanderia. A dive species — not a rock-pool find.' },
  'Tambja verconis':            { zone: 'dive',     min: 5,   max: 40, best: null,     src: 'general',
                                  tip: 'Bright yellow and blue, on bryozoans. Subtidal.' },
  'Tambja morosa':              { zone: 'dive',     min: 5,   max: 40, best: null,     src: 'general',
                                  tip: 'Dark blue-black. Subtidal, on bryozoans.' },
  'Pleurobranchaea maculata':   { zone: 'dive',     min: 2,   max: 250,best: null,      src: 'general',
                                  tip: 'Not a true nudibranch (a side-gilled slug) and can carry tetrodotoxin — do not handle, and keep dogs away from beach-cast animals.' }
};

/* Genus-level fallback, used when a species is not listed above. Kept short and
   only where the whole genus behaves consistently in New Zealand waters. */
const GENUS_ZONES = {
  Rostanga:      { zone: 'rockpool', tip: 'Intertidal, on red sponges.' },
  Onchidoris:    { zone: 'rockpool', tip: 'Small intertidal dorids.' },
  Aeolidiella:   { zone: 'rockpool', tip: 'Shallow, around anemones.' },
  Dendrodoris:   { zone: 'rockpool', tip: 'Shallow dorids that reach the intertidal.' },
  Doris:         { zone: 'both' },
  Alloiodoris:   { zone: 'both' },
  Doriopsis:     { zone: 'both' },
  Aphelodoris:   { zone: 'both' },
  Cadlina:       { zone: 'both' },
  Carminodoris:  { zone: 'both' },
  Goniobranchus: { zone: 'both' },
  Ceratosoma:    { zone: 'both' },
  Baeolidia:     { zone: 'both' },
  Tenellia:      { zone: 'both' },
  Polycera:      { zone: 'both' },
  Okenia:        { zone: 'both' },
  Jason:         { zone: 'dive',     tip: 'On hydroids, subtidal.' },
  Tambja:        { zone: 'dive',     tip: 'On bryozoans, subtidal.' },
  Janolus:       { zone: 'dive',     tip: 'Subtidal, on bryozoans.' },
  Tritonia:      { zone: 'dive',     tip: 'Subtidal, on soft corals.' },
  Marionia:      { zone: 'dive' },
  Bornella:      { zone: 'dive' },
  Melibe:        { zone: 'dive' },
  Phyllodesmium: { zone: 'dive' },
  Thecacera:     { zone: 'dive' },
  Trapania:      { zone: 'dive' }
};

/* Resolve a scientific name to a habitat record.
   Returns { zone, min, max, best, tip, basis } where basis is
   'species' | 'genus' | 'unknown'. */
function habitatFor(scientificName) {
  const name = (scientificName || '').trim();
  const exact = SPECIES_ZONES[name];
  if (exact) return Object.assign({ basis: 'species' }, exact);

  const genus = name.split(/\s+/)[0];
  const byGenus = GENUS_ZONES[genus];
  if (byGenus) return Object.assign({ min: null, max: null, best: null, basis: 'genus' }, byGenus);

  return { zone: null, min: null, max: null, best: null, tip: null, basis: 'unknown' };
}

/* Should this species appear in the given mode?
   Diving shows everything — anything in a rock pool is also reachable on a dive.
   Rockpooling hides the subtidal specialists. Unknowns are always shown, badged. */
function inMode(hab, mode) {
  if (mode === 'dive') return true;
  return hab.zone !== 'dive';
}

window.NudiDepths = { SPECIES_ZONES, GENUS_ZONES, habitatFor, inMode };
