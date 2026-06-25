# occurd.

Biodiversity occurrence records, mapped. Draw a polygon, set your filters, fetch from GBIF — no login, no install, no backend.

**[Open occurd.](https://rutherfordecology.github.io/Occurd/)**

---

## What it does

occurd. is a free, browser-based tool for exploring biodiversity occurrence data from [GBIF](https://www.gbif.org/). Draw one or more polygons on the map, or import a KML/KMZ file, then set a date range and taxon filter and retrieve every matching occurrence record for that area. Results appear as clustered points or a heatmap alongside a species checklist and export options. There's no account, nothing to install, and no code required — everything runs in the browser, and queries go straight from your machine to GBIF.

## Features

At its core, occurd. lets you draw polygons directly on the map or import them from KML/KMZ, draw or import several areas and fetch them together, and add 1, 2, 5 or 10 km buffers around any polygon. Queries can be filtered by taxon group (birds, mammals, reptiles, amphibians, fish, insects, plants, fungi, and more), by date range, and optionally to exclude eDNA-derived records. Results can be viewed as points or a heatmap, browsed as a species checklist grouped by taxon with record counts per polygon, and inspected record-by-record — click any occurrence to see its photo where available, sourced from iNaturalist taxon photos as a fallback. Low-precision records (more than 1.5 km of coordinate uncertainty) are flagged rather than hidden, so you can judge data quality for yourself. Results export as occurrence CSV, species list CSV, GeoJSON, or KML, and the whole interface works on phones and tablets as well as desktop.

When the map is centred over New Zealand, three extra tools appear. A species search field lets you search by scientific name, common name, Māori name, or NVS plant code (the National Vegetation Survey code system — typing `NOTHSOL`, for instance, finds *Nothofagus solandri*, with preferred synonyms resolved automatically) against the [NZOR](https://www.nzor.org.nz/) names database; typing a genus name adds every species in that genus as a single search entry, and selected species resolve to a GBIF taxon key and drop straight into your search basket. A full taxonomic browser, the Tree of life, lets you navigate the GBIF backbone through a three-panel Miller-column interface from Kingdom down to Species, with each taxon showing its all-time New Zealand occurrence count so you can gauge data richness at a glance; it's also searchable by scientific name, common name, Māori name, or NVS code, and any taxon at any rank can be added directly to your fetch parameters. Finally, a toggleable layer shows [QEII National Trust](https://www.qeii.org.nz/) perpetual covenant boundaries, and any covenant that intersects a polygon you've drawn is automatically selected and added to your list of areas.

## How to use

Start by defining your area: draw a polygon with the draw tool (draw each one separately for multiple areas), or drag and drop a KML/KMZ file onto the drop zone. If you're working in New Zealand, you can also add specific species or taxa to your search using the NZ Species Search field, or browse and select by rank in the Tree of life. From there, set your date range, taxon group filter, and eDNA exclusion as needed, then click *Fetch occurrences from GBIF* — a progress indicator appears, and the fetch can be cancelled at any time. Once results are in, switch between Points and Heatmap views, use the taxon chips to filter by group, or open the species checklist and click any species to highlight its records on the map and view its photos. When you're done, export your results as CSV, GeoJSON, or KML.

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

## Technical notes

occurd. runs entirely in the browser, with no server, backend, or build step: a main HTML file with separate CSS and JS modules (`style.css`, `species-search.js`, `qeii.js`, `taxonomy.js`), using [Leaflet](https://leafletjs.com/) for mapping and [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) for polygon drawing. Every API call is made directly from your browser, so your data never passes through a server of ours, and the whole thing is hosted free on [GitHub Pages](https://pages.github.com/). Active development happens at [/beta/](https://rutherfordecology.github.io/Occurd/beta/) before changes are promoted to production.

## Limitations

Fetches are capped at 10,000 records, so very large areas or broad taxon filters may hit that limit. The NZ-specific features (NZOR names, Tree of life) only appear when the map is centred over New Zealand. GBIF data quality varies — low-precision records are flagged but not excluded — and the QEII covenant layer requires an access key to display.

## About

Built by [Malcolm Rutherford](https://sites.google.com/view/rutherford-ecology/), Rutherford Ecology, New Zealand.

## Licence

[MIT](LICENSE) — free to use, modify and distribute. Credit appreciated.
