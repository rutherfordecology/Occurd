"""
Rebuild nzor_names.json from raw NZOR API pages (raw_page_*.json), keeping
author citations so that two different taxonomic concepts sharing the same
bare "genus species" string don't silently collide on one dictionary key.

Old (buggy) approach: key = lowercase(partialName) -> last record wins.
New approach:
  - key = lowercase(partialName) as before (this is what the search box types),
    but only written directly when there is exactly ONE nameId that ever
    produces that key.
  - When 2+ DIFFERENT nameIds collide on the same lowercase partialName,
    prefer the one with Status == "Current" (an accepted name) over any
    "Synonym"/"sensu" record. If there's no single "Current" winner, prefer
    "Basionym"/recombination handling is left to NZOR's own acceptedName field.
  - Every collision (resolved or not) is logged to collisions.json for manual
    review, instead of disappearing silently like before.
  - The original "n"/"acc"/"accId"/"id" shape is preserved so the existing
    app code (index.html) doesn't need to change.
"""
import json, glob, sys

def vernacular_link(r):
    """For a Vernacular Name record, find the scientific name it applies to
    (the 'is vernacular for' application), so the app can map common name ->
    Latin name for GBIF lookups. Returns (sci, sciId) or (None, None)."""
    if r.get('class') != 'Vernacular Name':
        return None, None
    for concept in r.get('concepts') or []:
        for app in concept.get('applications') or []:
            if app.get('type') == 'is vernacular for':
                target = (app.get('concept') or {}).get('name') or {}
                if target.get('partialName'):
                    return target['partialName'], target.get('nameId')
    return None, None

def load_all_records():
    records = []
    for fname in sorted(glob.glob('raw_page_*.json')):
        with open(fname, encoding='utf-8') as f:
            page = json.load(f)
        records.extend(page['names'])
    return records

def main():
    records = load_all_records()
    print(f"Loaded {len(records)} raw records", file=sys.stderr)

    # group by lowercase partialName
    by_key = {}
    for r in records:
        partial = r.get('partialName')
        if not partial:
            continue
        key = partial.lower().strip()
        by_key.setdefault(key, []).append(r)

    out = {}
    collisions = []

    for key, recs in by_key.items():
        distinct_ids = {r['nameId'] for r in recs}
        if len(distinct_ids) == 1:
            r = recs[0]
            entry = {'n': r['partialName'], 'id': r['nameId']}
            acc = r.get('acceptedName')
            if acc and acc.get('nameId') != r['nameId']:
                entry['acc'] = acc['partialName']
                entry['accId'] = acc['nameId']
            sci, sciId = vernacular_link(r)
            if sci:
                entry['cls'] = 'v'
                entry['sci'] = sci
                if sciId:
                    entry['sciId'] = sciId
            out[key] = entry
            continue

        # Real collision: 2+ different taxonomic concepts share this bare string.
        current = [r for r in recs if r.get('status') == 'Current']
        chosen = None
        if len(current) == 1:
            chosen = current[0]
        elif len(current) >= 2 and len(current) == len(recs):
            # Every colliding record is "Current" - this is NZOR having a
            # duplicate entry for the same taxon (inconsistent author/year
            # formatting), not two different species. Safe to merge: keep
            # the record with the cleanest citation (has authors, no
            # garbled repeated-year text).
            def score(r):
                authors = r.get('authors') or ''
                full = r.get('fullName') or ''
                garbled = (full.count(', 19') + full.count(', 18')) > 1
                return (1 if authors else 0, 0 if garbled else 1, -len(full))
            chosen = max(current, key=score)
        else:
            # No Current record, or a mix of Current + ambiguous Synonyms -
            # needs a human, not worth guessing.
            chosen = None

        collisions.append({
            'key': key,
            'records': [
                {
                    'nameId': r['nameId'],
                    'fullName': r.get('fullName'),
                    'status': r.get('status'),
                    'authors': r.get('authors'),
                    'acceptedName': (r.get('acceptedName') or {}).get('fullName'),
                } for r in recs
            ],
            'autoResolved': chosen['nameId'] if chosen else None,
        })

        if chosen:
            entry = {'n': chosen['partialName'], 'id': chosen['nameId']}
            acc = chosen.get('acceptedName')
            if acc and acc.get('nameId') != chosen['nameId']:
                entry['acc'] = acc['partialName']
                entry['accId'] = acc['nameId']
            sci, sciId = vernacular_link(chosen)
            if sci:
                entry['cls'] = 'v'
                entry['sci'] = sci
                if sciId:
                    entry['sciId'] = sciId
            out[key] = entry
        # else: leave key out of out[] entirely rather than silently picking
        # one - app will show "No match found" instead of a wrong species,
        # until the override list (overrides.json) fills it in.

    with open('nzor_names_rebuilt.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    with open('collisions.json', 'w', encoding='utf-8') as f:
        json.dump(collisions, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(out)} names to nzor_names_rebuilt.json", file=sys.stderr)
    print(f"{len(collisions)} bare-name collisions found, logged to collisions.json", file=sys.stderr)
    auto = sum(1 for c in collisions if c['autoResolved'])
    print(f"  - {auto} auto-resolved via Status=='Current'", file=sys.stderr)
    print(f"  - {len(collisions) - auto} need manual review / overrides.json entry", file=sys.stderr)

if __name__ == '__main__':
    main()
