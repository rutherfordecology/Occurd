# occurd. — 2026 GBIF Ebbe Nielsen Challenge
## Abstract and rationale

Biodiversity occurrence data held by GBIF represents one of the most comprehensive records of life on Earth, yet access to that data in practical, decision-relevant forms remains unnecessarily difficult for the people who most need it. Ecologists writing reports, consultants assessing development sites, conservation managers planning restoration — these practitioners routinely need species lists and occurrence records for specific geographic areas. Today, getting that information from GBIF requires either navigating a complex web interface designed for researchers, or writing code against an API that most practitioners cannot use. occurd. was built to eliminate that barrier entirely.

occurd. is a free, open-source, browser-based tool that lets any user draw a polygon on a map and retrieve all matching GBIF occurrence records for that area in seconds — with no account, no installation, and no technical knowledge required. The entire application runs client-side in a single browser session; no data is transmitted to any server beyond the live GBIF API query itself. It is hosted on GitHub Pages and accessible to anyone with a web browser.

**What it does**

Users begin by defining a study area — either by drawing one or more polygons directly on the map using a point-and-click interface, or by importing an existing KML or KMZ boundary file. They can optionally filter by taxon group (Birds, Mammals, Plants, Fungi, Insects, and more), date range, and eDNA exclusion. Clicking *Fetch occurrences from GBIF* retrieves all matching records via the GBIF Occurrence Search API and renders them as clustered points or a heatmap. A species checklist appears alongside the map, grouped by taxon group and showing record counts per polygon. Any species in the checklist can be clicked to highlight its records on the map and view associated photos from iNaturalist. Results can be exported as CSV, GeoJSON, or KML for use in GIS tools or reports.

Buffer zones (1, 2, 5, or 10 km) can be added to any polygon, and multiple polygons can be fetched simultaneously — useful for comparing sites or combining survey boundaries.

**New Zealand integrations**

occurd. was developed primarily for use in New Zealand and includes several integrations that demonstrate how the GBIF backbone can be enriched with national biodiversity infrastructure. When the map is centred over New Zealand, two additional features become available.

The first is an NZ Species Search field that allows users to search by scientific name, common name, or Māori name using names sourced from the New Zealand Organisms Register ([NZOR](https://www.nzor.org.nz/)), delivered via the [but-is-it-threatened](https://github.com/rutherfordecology/but-is-it-threatened) application. Users can also search by National Vegetation Survey (NVS) plant codes, a standardised plant coding system widely used in New Zealand ecological survey work, also served through the same pipeline. Selected species are matched to their GBIF taxon key and added to the spatial query, so occurrence records can be retrieved for specific species within a drawn area.

The second is the Tree of life — a full taxonomic browser built on the GBIF species backbone. Using a Miller columns interface (three scrollable panels), users can navigate the taxonomic hierarchy from Kingdom down to Species level. Each taxon shows the total number of GBIF occurrence records from New Zealand, giving users an immediate sense of data availability at any rank. A search function allows users to jump directly to any taxon by scientific name, common name, Māori name, or NVS code. Any taxon at any rank can be selected and added directly to a spatial fetch — making it straightforward to retrieve, for example, all records of a particular family within a given polygon without needing to type a scientific name.

A third NZ-specific layer shows QEII National Trust perpetual covenant boundaries, sourced from the QEII ArcGIS FeatureServer. When a polygon is drawn on the map, any QEII covenants that intersect it are automatically identified and listed, supporting conservation planning and land assessment workflows.

**Why it matters to GBIF communities**

GBIF data is openly licensed and freely available, but its utility to non-technical users is limited by the access pathway. occurd. makes GBIF data genuinely usable for the practitioners, consultants, educators, and community groups who generate and use biodiversity data every day but are not equipped to work with APIs or data science tools. Every interaction with occurd. is a direct query to GBIF — the tool creates no intermediate data layer, no cached copy, and no proprietary format. It is transparent about its data source and links back to GBIF throughout.

The NZ-specific integrations illustrate a broader principle: the GBIF backbone becomes more useful when connected to national names authorities and regional datasets. The same approach — linking GBIF taxon keys to vernacular names, indigenous language names, and regional coding systems — could be replicated for any country with comparable infrastructure.

**Openness**

occurd. is released under the MIT licence. The full source code is publicly available at [https://github.com/rutherfordecology/Occurd](https://github.com/rutherfordecology/Occurd). The application requires no backend infrastructure and can be run locally by opening `index.html` in any modern browser, or accessed directly via GitHub Pages. All external data sources used (GBIF, NZOR, NVS, QEII, iNaturalist) are publicly accessible. Development began on 15 May 2026 and proceeded entirely within the challenge period, with over 300 commits across 10 days of active development documented in the public repository.
