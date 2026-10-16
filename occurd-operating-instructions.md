## How to use occurd.

1. **Open the map.** Go to https://rutherfordecology.github.io/Occurd/ — no login or installation needed.

2. **Define your area.** Use the polygon draw tool to draw your study area directly on the map. To query several areas at once, draw each one separately. If you already have a boundary file, drag and drop a KML or KMZ file onto the map instead of drawing.

3. **Add a buffer (optional).** Add a 1, 2, 5, or 10 km buffer around any polygon if you want to check for nearby records as well as records inside the boundary.

4. **Search for species (New Zealand and Samoa).** If the map is centred over New Zealand, a species search field appears, letting you search by scientific name, common name, Māori name, or NVS plant code to add specific species or genera to your search; you can also open the Tree of life to browse and select taxa by rank, and toggle on the QEII National Trust covenant layer — drawing over a covenant automatically adds it to your area list. If the map is centred over Samoa, a similar species search field appears instead, populated as far as possible with Samoan names alongside English and scientific names, so you can search in whichever you know.

5. **Set your filters.** Adjust the date range, choose a taxon group to narrow your search (birds, mammals, reptiles, plants, fungi, insects, and more), and tick the box to exclude eDNA-derived records if you don't want them included.

6. **Fetch the data.** Click *Fetch occurrences from GBIF*. A progress indicator shows while records are retrieved; you can cancel at any time. If your search is too large for a live query, you'll be prompted to switch to **Big Data Mode**, which sends an asynchronous download request to GBIF's download API instead — this takes longer, since GBIF prepares the file in the background, but it isn't capped the way a live search is.

7. **Explore the results.** Switch between Points, Heatmap, and Timeline views. Timeline view shows a chart of records by year, which can be filtered to a date range, coloured by year, or normalised against overall recording effort to separate genuine trends from simply more people recording in recent years. Use the taxon chips to filter the results by group, or open the species checklist to see every species found, grouped by taxon, with a record count for each polygon. Click any species to highlight its records on the map and view its photos.

8. **Check data quality and conservation status.** Records with low coordinate precision (more than 1.5 km of uncertainty) are flagged in the results rather than hidden — use your own judgement about whether to rely on them. In the species checklist, you can also turn on IUCN Red List status badges (sourced from GBIF's species data) and filter the checklist down to species in a particular threat category; coverage is partial and reflects global, not local, status, so treat it as a starting point rather than a definitive local assessment.

9. **Export your results.** Download the occurrence records or species list as CSV, or the data as GeoJSON or KML, for use in other software.

10. **Send species to a quiz (optional).** From the species checklist, select one or more species and click through to LookLike (a photo-ID quiz) or WhatDat (a general ID quiz) to test yourself on the species actually found in your area.
