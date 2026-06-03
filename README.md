# occurd.

Biodiversity occurrence records, mapped. Draw a polygon, set your filters, fetch from GBIF — no login, no install, no backend.

**[Open occurd.](https://rutherfordecology.github.io/Occurd/)**

---

## What it does

occurd. is a free, browser-based tool for exploring biodiversity occurrence data from [GBIF](https://www.gbif.org/). Draw one or more polygons on the map (or import a KML/KMZ file), set a date range and taxon filter, and retrieve all matching occurrence records for that area. Results appear as clustered points or a heatmap alongside a species checklist and export options — no account, no installation, and no code required.

---

## Features

### Core
- **Draw polygons** directly on the map, or import KML/KMZ files
- **Query GBIF** — live occurrence data, no account needed
- **Multiple polygons** — draw or import several areas and fetch them together
- **Buffer zones** — add 1, 2, 5 or 10 km buffers to any polygon
- **Filter by taxon group** — Birds, Mammals, Reptiles, Amphibians, Fish, Insects, Plants, Fungi, and more
- **Filter by date range** — adjustable start and end dates
- **Points or heatmap** view
- **Species checklist** — grouped by taxon, with record counts per polygon
- **Record photos** — iNaturalist taxon photos; click any occurrence to see the individual record photo where available
- **Export** — Occurrences CSV, Species list CSV, GeoJSON, KML
- **Coordinate precision warning** — flags low-precision records (>1.5 km uncertainty)
- **eDNA filter** — option to exclude eDNA-derived records
- **Mobile friendly** — works on phones and tablets

### NZ Species Search
When the map is centred over New Zealand, a species search field appears:
- Search by **scientific name, common name, or Māori name** using the [NZOR](https://www.nzor.org.nz/) (New Zealand Organisms Register) names database
- Search by **NVS plant code** (National Vegetation Survey) — e.g. type `NOTHSOL` to find *Nothofagus solandri*; preferred synonyms are resolved automatically
- **Genus search** — type a genus name to add all species in that genus as a single search entry
- Selected species are resolved to a GBIF taxon key and added to the search basket

### Tree of life
A full taxonomic browser for navigating the GBIF backbone, available when the map is centred over New Zealand:
- **Miller columns** — three-panel interface showing Kingdom → Phylum/Class → Order/Family/Genus/Species hierarchy
- **NZ occurrence counts** — each taxon shows the number of GBIF records from all time for New Zealand, so you can see data richness at a glance
- **Search** — type any scientific name, common name, Māori name or NVS code to jump directly to any taxon; results ranked by relevance
- **Add to search** — select any taxon at any rank and add it directly to your fetch parameters
- **Back navigation** — navigate up and down the hierarchy with full state preserved

### QEII National Trust covenants (New Zealand)
- Toggle a layer showing [QEII National Trust](https://www.qeii.org.nz/) perpetual covenant boundaries over the map
- When a polygon is drawn, any QEII covenants that intersect it are automatically selected and added to the polygon list

---

## How to use

1. **Define your area** — click the polygon draw tool and draw your study area on the map. For multiple areas, draw each polygon separately. Alternatively, drag and drop a KML or KMZ file onto the drop zone.
2. **Add species (NZ only)** — if the map is centred over New Zealand, use the NZ Species Search field to add specific species or taxa to your search, or open the Tree of life to browse and select taxa by rank.
3. **Set parameters** — adjust the date range, taxon group filter, and eDNA exclusion if needed.
4. **Fetch** — click *Fetch occurrences from GBIF*. A progress indicator appears; fetching can be cancelled at any time.
5. **Explore results** — switch between Points and Heatmap views, click taxon chips to filter by group, or open the species checklist. Click any species to highlight its records on the map and view photos.
6. **Export** — download your results as CSV (occurrences or species list), GeoJSON, or KML.

---

## Data sources

| Source | Used for |
|---|---|
| [GBIF Occurrence Search API](https://www.gbif.org/developer/occurrence) | Occurrence records |
| [GBIF Species API](https://www.gbif.org/developer/species) | Taxonomic backbone, Tree of life |
| [NZOR](https://www.nzor.org.nz/) via [but-is-it-threatened](https://github.com/rutherfordecology/but-is-it-threatened) | NZ common and Māori names |
| [NVS plant codes](https://github.com/rutherfordecology/but-is-it-threatened) via [but-is-it-threatened](https://github.com/rutherfordecology/but-is-it-threatened) | National Vegetation Survey code lookup |
| [QEII National Trust ArcGIS FeatureServer](https://services-ap1.arcgis.com/h9r62GhsQQYscUHs/) | QEII covenant boundaries |
| [iNaturalist Taxa API](https://www.inaturalist.org/pages/api+reference) | Species and record photos |
| OpenStreetMap / Esri World Imagery | Basemap |

All data is fetched live at query time — nothing is stored on any server.

---

## Technical notes

- Runs entirely in the browser — no server, no backend, no build step
- Structured as a main HTML file with separate CSS and JS modules (`style.css`, `species-search.js`, `qeii.js`, `taxonomy.js`)
- Uses [Leaflet](https://leafletjs.com/) for mapping and [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) for polygon drawing
- Queries all APIs directly from the browser — your data never leaves your machine
- Hosted on [GitHub Pages](https://pages.github.com/) — free, no infrastructure required

### Beta channel
Active development happens at [/beta/](https://rutherfordecology.github.io/Occurd/beta/) before changes are promoted to production.

---

## Limitations

- Capped at 10,000 records per fetch — very large areas or broad taxon filters may hit this limit
- NZ species features (NZOR names, Tree of life) are gated to when the map is centred over New Zealand
- GBIF data quality varies; low-precision records are flagged but not excluded
- QEII covenant layer requires an access key

---

## About

Built by [Malcolm Rutherford](https://sites.google.com/view/rutherford-ecology/), Rutherford Ecology, New Zealand.

---

## Licence

[MIT](LICENSE) — free to use, modify and distribute. Credit appreciated.
