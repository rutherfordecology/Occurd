/* ────────────────────────────────────────────────────────────────────────────
   Lizards Near Me — when each species is findable
   ────────────────────────────────────────────────────────────────────────────
   New Zealand's herpetofauna splits along genus lines almost perfectly, so this
   is a short genus table rather than 110 species entries. Nine genera cover
   virtually every record in the country.

   when:
     'day'    out and active in daylight — basking skinks, green geckos in
              shrubs. Shown in the DAY list only.
     'night'  out after dark, found with a torch on trunks, walls and rock.
              Shown in the NIGHT list, and also in the day list when it is
              realistically findable under cover (see byDay).
     (absent) unknown; shown under both, badged.

   byDay    true for nocturnal species that are routinely found in daylight
            under rocks, bark or debris — which is how most gecko surveying is
            actually done. It is what stops the night species vanishing from
            the daytime list, when in practice a daytime rock-turn is the
            commonest way people find them.

   WHY THIS IS NOT DERIVED FROM THE DATA: observation timestamps look like they
   should give this for free, and 99% of records carry one. They don't. Tested
   against five species, nocturnal geckos returned only 17–22% night-time
   observations against 4–13% for diurnal species — because nocturnal geckos are
   mostly found by day, under cover, and photographed then. The timestamp
   records how people survey, not when the animal is active.
   ──────────────────────────────────────────────────────────────────────────── */

const GENUS_ACTIVITY = {
  // ── Skinks: diurnal, bask in the open ────────────────────────────────────
  Oligosoma:     { when: 'day', byDay: true,
                   tip: 'Skinks. Bask in the open on warm mornings — rock, driftwood, coastal scrub. Move slowly and watch for the flicker.' },
  Lampropholis:  { when: 'day', byDay: true,
                   tip: 'Rainbow skink. Introduced and abundant round Auckland gardens, compost heaps and paths.' },
  Emoia:         { when: 'day', byDay: true },

  // ── Green geckos: the diurnal exception among geckos ─────────────────────
  Naultinus:     { when: 'day', byDay: true,
                   tip: 'Green geckos, and the only geckos out by day. Slow-moving in mānuka, kānuka and divaricating shrubs. Heavily poached, so their records are location-obscured.' },

  // ── Brown geckos: nocturnal, but found by day under cover ────────────────
  Woodworthia:   { when: 'night', byDay: true,
                   tip: 'Common geckos. Out on rock and trunks after dark; by day, under stones and loose bark.' },
  Mokopirirakau: { when: 'night', byDay: true,
                   tip: 'Forest geckos. Nocturnal and well camouflaged — a torch after dark is far more productive than searching by day.' },
  Dactylocnemis: { when: 'night', byDay: true,
                   tip: 'Pacific geckos. Nocturnal, on rock stacks and in coastal forest.' },
  Hoplodactylus: { when: 'night', byDay: true,
                   tip: "Duvaucel's gecko, New Zealand's largest. Essentially confined to predator-free islands." },
  Toropuku:      { when: 'night', byDay: true, tip: 'Striped geckos. Rare and cryptic.' },
  Tukutuku:      { when: 'night', byDay: true, tip: 'Harlequin gecko. Stewart Island, in low scrub.' },

  // ── Introduced house geckos ──────────────────────────────────────────────
  Hemidactylus:  { when: 'night', byDay: false, tip: 'Introduced house gecko. Around buildings and lights after dark.' },
  Tarentola:     { when: 'night', byDay: false, tip: 'Introduced wall gecko.' },
  Gehyra:        { when: 'night', byDay: false },
  Lepidodactylus:{ when: 'night', byDay: false },

  // ── Not a lizard, but everyone wants to know ─────────────────────────────
  Sphenodon:     { when: 'night', byDay: true, notLizard: 'Tuatara — not a lizard at all, but the sole survivor of its own order.',
                   tip: 'Emerges at dusk and after dark, though it basks at burrow entrances by day. Sanctuaries and offshore islands.' },

  // ── Introduced oddities ──────────────────────────────────────────────────
  Intellagama:   { when: 'day', byDay: true, tip: 'Eastern water dragon. Introduced, very localised.' },

  /* ── Snakes ───────────────────────────────────────────────────────────────
     New Zealand has no land snakes at all. What it does get is the occasional
     sea snake carried down on warm currents and washed ashore — eleven records
     in the country. Timing is not really the point for a beach-cast animal, so
     both are listed under either mode. */
  Hydrophis:     { when: 'day', byDay: true, venomous: true,
                   tip: 'Yellow-bellied sea snake. A rare vagrant, almost always found washed up. Highly venomous — do not handle it, alive or dead, and report it to DOC on 0800 362 468.' },
  Laticauda:     { when: 'day', byDay: true, venomous: true,
                   tip: 'Sea krait. An extremely rare vagrant. Highly venomous — do not handle it, alive or dead, and report it to DOC on 0800 362 468.' }
};

/* Species-level overrides, for anything that departs from its genus. Empty for
   now — New Zealand's genera behave consistently. Add here as exceptions turn
   up; a species entry always beats the genus rule. */
const SPECIES_ACTIVITY = {};

/* Marine turtles arrive under Reptilia but are neither lizards nor snakes, and
   turn up only as beach-cast or at-sea records. Sea snakes are deliberately NOT
   excluded — they are the only snakes New Zealand gets, and the front page
   promises them. */
const NOT_LIZARDS = new Set([
  'Chelonia', 'Lepidochelys', 'Dermochelys', 'Eretmochelys', 'Caretta',  // marine turtles
  'Trachemys'                                                            // feral pet slider
]);

function isExcluded(scientificName) {
  return NOT_LIZARDS.has(String(scientificName || '').split(/\s+/)[0]);
}

/* Resolve a name to an activity record.
   basis is 'species' | 'genus' | 'unknown'. */
function activityFor(scientificName) {
  const name = (scientificName || '').trim();

  const exact = SPECIES_ACTIVITY[name];
  if (exact) return Object.assign({ basis: 'species' }, exact);

  const genus = name.split(/\s+/)[0];
  const byGenus = GENUS_ACTIVITY[genus];
  if (byGenus) return Object.assign({ basis: 'genus' }, byGenus);

  return { when: null, byDay: null, tip: null, basis: 'unknown' };
}

/* Should this species show in the chosen mode?
   Night shows everything nocturnal. Day shows the diurnal species, plus the
   nocturnal ones that a daytime rock-turn realistically finds. Unknowns always
   show, badged, rather than being silently dropped. */
function inMode(act, mode) {
  if (act.basis === 'unknown') return true;
  if (mode === 'night') return act.when === 'night';
  return act.when === 'day' || act.byDay === true;
}

window.LizardActivity = {
  GENUS_ACTIVITY, SPECIES_ACTIVITY, NOT_LIZARDS,
  activityFor, inMode, isExcluded
};
