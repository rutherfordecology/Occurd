/* ────────────────────────────────────────────────────────────────────────────
   Mermaids Near Me — the verdicts
   ────────────────────────────────────────────────────────────────────────────
   There are no mermaids. This is the list of things that have been mistaken for
   one, or were named after them by someone in a hopeful mood, and a note on
   each explaining exactly how it fails to be a mermaid.

   Matched by ancestry, so a verdict written for the seals covers every seal
   without naming all thirty-odd. Checked most specific first.
   ──────────────────────────────────────────────────────────────────────────── */

/* iNaturalist taxon ids, in the order they are tested. Anything more specific
   must come before the group it sits inside. */
const VERDICTS = [
  { id: 46311, name: 'Dugong dugon',
    line: 'A dugong. The order is called Sirenia, after the sirens, which tells you how long this mistake has been running.',
    verdict: 'Not a mermaid. Pretty though.' },

  { id: 46306, name: 'Sirenia',
    line: 'A manatee, or its cousin. Columbus logged three mermaids off Hispaniola in 1493 and recorded, a little sourly, that they were not half as beautiful as they are painted. He was looking at these.',
    verdict: 'Not a mermaid. Historically responsible, though.' },

  { id: 41461, name: 'Delphinapterus leucas',
    line: 'A beluga. White, sociable, and vocal enough that whalers called it the sea canary. It can also turn its head, which almost nothing else in the sea can do — hence a great many double takes.',
    verdict: 'Not a mermaid. Uncannily expressive, though.' },

  { id: 246411, name: 'Architeuthis',
    line: 'A giant squid. You have the wrong legend entirely — this one is the kraken.',
    verdict: 'Not a mermaid. Arguably better, though.' },

  { id: 47511, name: 'Regalecus',
    line: 'An oarfish. Ten metres of silver ribbon with a red crest, which is where a respectable share of sea-serpent reports come from.',
    verdict: 'Not a mermaid. Spectacular, though.' },

  { id: 48408, name: 'Rajidae',
    line: 'A skate. Its egg case is a mermaid’s purse, which is the closest anything on this list comes to owning actual mermaid property.',
    verdict: 'Not a mermaid. Adjacent, though.' },

  { id: 59718, name: 'Acetabularia',
    line: 'Mermaid’s wineglass. A single cell, several centimetres tall, that grows itself a stem and a little parasol. One cell.',
    verdict: 'Not a mermaid. Frankly more impressive, though.' },

  { id: 51428, name: 'Chaetomorpha',
    line: 'Mermaid’s hair. Fine green filaments in tangled masses, and the name is entirely fair.',
    verdict: 'Not a mermaid. Good hair, though.' },

  { id: 27855, name: 'Sirenidae',
    line: 'A siren — an eel-shaped salamander that never bothered growing out of its gills, and kept the front legs only. Named after the same myth by someone who had clearly had enough.',
    verdict: 'Not a mermaid. Committed to the bit, though.' },

  { id: 156562, name: 'Proserpinaca',
    line: 'Mermaidweed. A marsh plant. The name is doing almost all of the work here.',
    verdict: 'Not a mermaid. Pretty though.' },

  /* Seals last, being the biggest group and the catch-all for the legend. */
  { id: 372843, name: 'Pinnipedia',
    line: 'A seal. A round face at the waterline, a long look back at you, and months at sea with poor rations — this is where selkie stories come from, and most mermaid sightings besides.',
    verdict: 'Not a mermaid. Pretty though.' }
];

/* Fallback for anything that slips through the taxon net. */
const DEFAULT_VERDICT = {
  line: 'Something in the water that is not a mermaid, because nothing is.',
  verdict: 'Not a mermaid. Pretty though.'
};

/* Resolve using the ancestry iNaturalist returns with every result, so one
   entry covers a whole group. */
function verdictFor(taxonId, ancestorIds) {
  const ids = ancestorIds || [];
  for (const v of VERDICTS) {
    if (taxonId === v.id || ids.indexOf(v.id) !== -1) return v;
  }
  return DEFAULT_VERDICT;
}

/* Every taxon the app searches, as one comma-separated list. */
const SEARCH_TAXA = VERDICTS.map(v => v.id).join(',');

window.MermaidVerdicts = { VERDICTS, DEFAULT_VERDICT, verdictFor, SEARCH_TAXA };
