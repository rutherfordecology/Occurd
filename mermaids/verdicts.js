/* ────────────────────────────────────────────────────────────────────────────
   Mermaids Near Me — the verdicts
   ────────────────────────────────────────────────────────────────────────────
   There are no mermaids. This is the list of things that have been mistaken for
   one, or were named after them by somebody in a hopeful mood, and a note on
   each explaining exactly how it fails to qualify.

   Two layers. SPECIES covers the thirty-odd animals that carry nearly all the
   records worldwide and gets its own line each. Anything else falls through to
   GROUPS, matched on iNaturalist's ancestry, so one entry covers a whole family
   without naming every member of it.

   The natural history is real throughout. Only the conclusions are a joke.
   ──────────────────────────────────────────────────────────────────────────── */

const SPECIES = {
  // ── The seals, which account for most sightings and all of the selkies ────
  'Phoca vitulina': {
    line: 'The commonest mermaid on earth, by reported sightings. Hauls out on a rock, watches you for an uncomfortably long time, then slides off without explanation.',
    verdict: 'Not a mermaid. Unnervingly attentive, though.' },
  'Halichoerus grypus': {
    line: 'Halichoerus grypus means hook-nosed sea pig — surely the least romantic name ever given to an animal people keep mistaking for a beautiful woman.',
    verdict: 'Not a mermaid. Named accordingly.' },
  'Zalophus californianus': {
    line: 'Barks. Mermaids, by every account we have, sing.',
    verdict: 'Not a mermaid. Louder, though.' },
  'Eumetopias jubatus': {
    line: 'Named for Georg Steller, who described it in 1741 and in the same decade also described a sea cow, a sea eagle and a sea ape. Only one of those turned out to be imaginary.',
    verdict: 'Not a mermaid. Well documented, though.' },
  'Otaria flavescens': {
    line: 'An enormous mane and the face of a thoroughly disappointed bouncer.',
    verdict: 'Not a mermaid. Imposing, though.' },
  'Arctocephalus pusillus': {
    line: 'The species name pusillus means very small. It reaches 360 kilograms. Taxonomy is not always a triumph.',
    verdict: 'Not a mermaid. Misnamed, though.' },
  'Arctocephalus forsteri': {
    line: 'New Zealand’s default seal, and a connoisseur of sleeping positions that suggest it was dropped from a height.',
    verdict: 'Not a mermaid. Comfortable, though.' },
  'Mirounga angustirostris': {
    line: 'Two tonnes, a pendulous nose, and a bellow audible a kilometre off. Whoever first floated this one had been at sea a very long time.',
    verdict: 'Not a mermaid. Not remotely.' },
  'Mirounga leonina': {
    line: 'The largest carnivore on earth. Four tonnes of it, asleep on a beach, making a noise like a blocked drain.',
    verdict: 'Not a mermaid. Impossible to miss, though.' },
  'Hydrurga leptonyx': {
    line: 'Three metres of predator with a reptilian head and a fixed grin. Anyone mistaking this for a mermaid was having a bad voyage.',
    verdict: 'Not a mermaid. Do not approach.' },
  'Leptonychotes weddellii': {
    line: 'Sings. Genuinely sings — long descending trills beneath the ice that carry for kilometres. Of everything here, this is the closest.',
    verdict: 'Not a mermaid. Closest yet, though.' },
  'Erignathus barbatus': {
    line: 'Spirals its song downward underwater for a minute at a stretch, and can be heard through a boat’s hull. Also has a beard.',
    verdict: 'Not a mermaid. Bearded, though.' },
  'Lobodon carcinophaga': {
    line: 'The crabeater seal eats no crabs. It strains krill through teeth shaped like a sieve.',
    verdict: 'Not a mermaid. Misnamed twice over.' },
  'Neomonachus schauinslandi': {
    line: 'Fewer than sixteen hundred remain. If you have seen one, you have had a better day than most people ever will.',
    verdict: 'Not a mermaid. Rarer, though.' },
  'Phocarctos hookeri': {
    line: 'One of the rarest sea lions in the world, and much given to sleeping well inland — in gardens, on footpaths, and with some regularity on golf courses.',
    verdict: 'Not a mermaid. Lost, occasionally.' },
  'Odobenus rosmarus': {
    line: 'Two tonnes, tusks and a moustache. Somewhere, at some point, in poor light, someone squinted.',
    verdict: 'Not a mermaid. Magnificent, though.' },
  'Zalophus wollebaeki': {
    line: 'Sprawls across the same beaches Darwin worked, entirely unbothered, and is no more a mermaid now than it was then.',
    verdict: 'Not a mermaid. Historically significant, though.' },
  'Arctocephalus gazella': {
    line: 'Hunted down to a few hundred animals, and now back to millions. One of the great recoveries, and still not a mermaid.',
    verdict: 'Not a mermaid. Back from the brink, though.' },
  'Pagophilus groenlandicus': {
    line: 'Born on sea ice and white for a fortnight, then not. The face is doing a great deal of the work here.',
    verdict: 'Not a mermaid. Devastating, though.' },
  'Callorhinus ursinus': {
    line: 'A small head, enormous rear flippers, and the bearing of something entirely aware it is being watched.',
    verdict: 'Not a mermaid. Self-possessed, though.' },
  'Neophoca cinerea': {
    line: 'Breeds on a seventeen-and-a-half month cycle, so its colonies drift permanently out of step with each other and with the year.',
    verdict: 'Not a mermaid. Contrary, though.' },
  'Arctocephalus australis': {
    line: 'Rides the Humboldt current up the edge of a desert, which is a stranger life than the legend was ever offering.',
    verdict: 'Not a mermaid. Better travelled, though.' },
  'Arctocephalus tropicalis': {
    line: 'Subantarctic, despite the name, and turns up thousands of kilometres off course with some regularity.',
    verdict: 'Not a mermaid. Badly named, though.' },

  // ── Sirenians: the order is literally named after the sirens ──────────────
  'Trichechus manatus': {
    line: 'Columbus logged three mermaids off Hispaniola in January 1493, and recorded a little sourly that they were not half as beautiful as they are painted. He was looking at these.',
    verdict: 'Not a mermaid. Historically responsible, though.' },
  'Dugong dugon': {
    line: 'Grazes seagrass, surfaces to breathe, and holds its calf against its chest. The order is called Sirenia, which tells you how long this mistake has been running.',
    verdict: 'Not a mermaid. The original error, though.' },

  // ── The rest ─────────────────────────────────────────────────────────────
  'Delphinapterus leucas': {
    line: 'Whalers called it the sea canary. It is white, it is sociable, and unlike almost anything else in the ocean it can turn its head — which explains a great many double takes.',
    verdict: 'Not a mermaid. Uncannily expressive, though.' },
  'Architeuthis dux': {
    line: 'Eyes the size of dinner plates, ten metres of arms, and almost never seen alive. You have the wrong legend entirely: this one is the kraken.',
    verdict: 'Not a mermaid. Arguably better, though.' },
  'Regalecus glesne': {
    line: 'Ten metres of silver ribbon with a scarlet crest, swimming vertically. A respectable share of all sea-serpent reports trace back to this fish.',
    verdict: 'Not a mermaid. Spectacular, though.' },
  'Raja clavata': {
    line: 'Lays its eggs in a black leathery case with a horn at each corner. Beachcombers call it a mermaid’s purse — the only mermaid property known to exist.',
    verdict: 'Not a mermaid. Its landlord, arguably.' },
  'Acetabularia acetabulum': {
    line: 'Mermaid’s wineglass. A single cell, several centimetres tall, that builds itself a stalk and a fluted parasol. One cell.',
    verdict: 'Not a mermaid. Frankly more impressive, though.' },
  'Siren lacertina': {
    line: 'A metre of eel-shaped salamander that kept its gills, kept its front legs, and dispensed with the back pair. Somebody named it after the myth regardless.',
    verdict: 'Not a mermaid. Committed to the bit, though.' },
  'Proserpinaca palustris': {
    line: 'Marsh mermaidweed. Grows in ditches, and changes its leaf shape completely depending on whether it is above or below the water — which is the most mermaid thing about it.',
    verdict: 'Not a mermaid. Adaptable, though.' }
};

/* Group fallbacks, by iNaturalist taxon id, checked most specific first. */
const GROUPS = [
  { id: 46311, line: 'A dugong. The order is called Sirenia, after the sirens, which tells you how long this mistake has been running.',
    verdict: 'Not a mermaid. The original error, though.' },
  { id: 46306, line: 'A manatee, or one of its cousins. This is the animal Columbus logged as a mermaid in 1493, and was disappointed by.',
    verdict: 'Not a mermaid. Historically responsible, though.' },
  { id: 41461, line: 'A beluga. White, sociable, and vocal enough that whalers called it the sea canary.',
    verdict: 'Not a mermaid. Uncannily expressive, though.' },
  { id: 246411, line: 'A giant squid. Wrong legend — you want the kraken.',
    verdict: 'Not a mermaid. Arguably better, though.' },
  { id: 47511, line: 'An oarfish. Long, silver, and responsible for a good share of sea-serpent reports.',
    verdict: 'Not a mermaid. Spectacular, though.' },
  { id: 48408, line: 'A skate. Its egg case is a mermaid’s purse, which is as close as anything gets to owning actual mermaid property.',
    verdict: 'Not a mermaid. Adjacent, though.' },
  { id: 59718, line: 'Mermaid’s wineglass. A single cell that grows itself a stem and a little parasol.',
    verdict: 'Not a mermaid. Frankly more impressive, though.' },
  { id: 51428, line: 'Mermaid’s hair. Fine green filaments in tangled masses, and the name is entirely fair.',
    verdict: 'Not a mermaid. Good hair, though.' },
  { id: 27855, line: 'A siren — an eel-shaped salamander that never grew out of its gills. Named after the same myth by someone who had clearly had enough.',
    verdict: 'Not a mermaid. Committed to the bit, though.' },
  { id: 156562, line: 'Mermaidweed. A marsh plant. The name is doing almost all of the work here.',
    verdict: 'Not a mermaid. Pretty though.' },
  { id: 372843, line: 'A seal. A round face at the waterline, a long look back at you, and months at sea on poor rations — this is where the selkies come from, and most mermaid sightings besides.',
    verdict: 'Not a mermaid. Pretty though.' }
];

const DEFAULT_VERDICT = {
  line: 'Something in the water that is not a mermaid, on account of nothing being one.',
  verdict: 'Not a mermaid. Pretty though.'
};

/* Species first, then the group it belongs to, then the catch-all. */
function verdictFor(name, taxonId, ancestorIds) {
  const exact = SPECIES[(name || '').trim()];
  if (exact) return exact;

  const ids = ancestorIds || [];
  for (const g of GROUPS) {
    if (taxonId === g.id || ids.indexOf(g.id) !== -1) return g;
  }
  return DEFAULT_VERDICT;
}

/* Every taxon the app searches, as one comma-separated list. */
const SEARCH_TAXA = GROUPS.map(g => g.id).join(',');

window.MermaidVerdicts = { SPECIES, GROUPS, DEFAULT_VERDICT, verdictFor, SEARCH_TAXA };
