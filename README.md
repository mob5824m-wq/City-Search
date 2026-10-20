# Ledger KW

**Search public property records in Kitchener and Waterloo by owner name or address.**

Ledger KW is a small, dependency-free web app that queries the cities' public open-data
services directly from the browser. Search a business, institution or government owner to
see every property attributed to it, or look up an address to see the owner on file (where
public) and its building permit history.

It is honest about what Ontario actually publishes: **individual homeowner names are
privacy-protected** and are not in the open data. The app explains that up front and links
to the official routes for a residential ownership record (MPAC, ONLAND, city clerks).

---

## What it does

- **Owner portfolios** — search a name → every building and unit linked to it, grouped by
  address, with a map, sorting, CSV export and printing.
- **Address records** — search a civic address in either city → city, ward, units, owner
  (where published), permit history, coordinates and official reference links.
- **Two cities** — Kitchener ownership + permits; Waterloo addresses + permits.
- **Built for real use** — live data with in-memory caching, debounced autocomplete,
  keyboard navigation, shareable URLs, saved records in `localStorage`, responsive layout
  and print styles.
- **No map key, no tiles** — the map is drawn locally as inline SVG from the real
  coordinates: graticule, scale bar, north arrow, drag-to-pan and zoom. It makes no network
  request at all, so it works offline, inside a sandboxed iframe, and behind any map
  provider's key wall. Links out to OpenStreetMap are optional anchors.
- **Graceful failure** — if the city services are unreachable, the app switches to a small,
  clearly labelled sample of real records and offers a retry.

## Data sources

| Dataset | City | Used for | Update |
| --- | --- | --- | --- |
| [Property Ownership Public](https://open-kitchenergis.opendata.arcgis.com/) | Kitchener | Owner names (business/institution/government only), civic address, unit, property unit ID, coordinates | Daily |
| [Building Permits](https://open-kitchenergis.opendata.arcgis.com/) | Kitchener | Permit type, work, status, date, description, construction value | Daily |
| [Address Points](https://data.waterloo.ca/) | Waterloo | Civic address, street, ward, coordinates | Regularly |
| [Building Permits](https://data.waterloo.ca/) | Waterloo | Permit description, work, status, value, units | Daily |

All requests go directly from the browser to the cities' ArcGIS FeatureServer endpoints
(`services1.arcgis.com` and `services.arcgis.com`). There is no backend, API key, database
or scraper — and no basemap provider, since the map is drawn locally. If you later want
street tiles, `assets/js/basemap.js` is the single place to add them (and their key).

### Privacy

Kitchener's ownership layer marks individual owners as `PRIVATE` under Ontario's Municipal
Freedom of Information and Protection of Privacy Act (MFIPPA). Only business, numbered
company, institutional and government owners are named. Waterloo does not publish an
ownership layer at all. Ledger KW displays exactly what is published and does not attempt to
re-identify anyone.

**This is not a title search.** For legal ownership, use a parcel register (ONLAND) or a
title search through a lawyer or title insurer.

## Run it

```bash
python3 server.py          # http://localhost:8000
# or
npm start
```

No install step, no build step. Python 3 is the only requirement for the server; the app
itself is plain HTML, CSS and ES modules.

For tests:

```bash
npm test        # node --test tests/*.test.mjs
```

The suite is dependency-free: pure-function tests for parsing, SQL predicates,
deduplication, grouping and CSV, plus static checks that every local asset,
module import and SVG icon referenced by the app actually exists. The optional
`tests/*.local.mjs` harnesses need `happy-dom` (not committed) and render views in
a simulated DOM:

```bash
npm install --no-save happy-dom
node tests/dom-smoke.local.mjs     # every view, live-shaped API stubs
node tests/sample-dom.local.mjs    # every view against the offline sample
node tests/boot.local.mjs          # real index.html + router + nav states
OFFLINE=1 node tests/boot.local.mjs  # same, with the network down
node tests/saved.local.mjs         # save/unsave + badge state
node tests/map.local.mjs           # local map: projection, pan/zoom, zero requests
node tests/propertymap.local.mjs   # property page renders the map offline
node tests/e2e-served.local.mjs    # boots the served index.html end to end
```

## Project structure

```
index.html                 app shell, inline SVG icon sprite
assets/css/app.css         design system + components + responsive + print
assets/fonts/              self-hosted Fraunces & Inter (woff2)
assets/js/
  app.js                   bootstrap + hash router
  config.js                data source registry, official links, limits
  data.js                  live/sample mode facade
  api.js                   ArcGIS REST client, normalizers, caching
  sample.js                small real-data extract for offline fallback
  util.js                  pure helpers (parsing, grouping, CSV, formatting)
  store.js                 saved records (localStorage)
  basemap.js               self-contained SVG map (no tiles, no key)
  ui.js                    search combobox, tags, toasts, shared components
  views/                   home, search, owner, property, saved, about
server.py                  small static server (0.0.0.0, PORT)
tests/                     node:test unit tests + static asset checks
```

### Notes on the data model

- The ownership layer contains duplicate rows and records each unit separately. Ledger KW
  de-duplicates by property unit ID + unit and groups rows by civic address.
- Name matching is token-based and tolerant: “Drewlo Holdings” matches
  “DREWLO HOLDINGS INC”. Punctuation and legal suffixes are ignored.
- Permits are matched by civic address. Coverage varies by year; construction values are
  declared by applicants.

## Limitations

- Kitchener and Waterloo only (not Cambridge or the townships).
- Residential owner names are not available in the open data. The authoritative record is a
  provincial parcel register ($36.50 for the first page, set by Ontario's tariff, not by this
  site); free alternatives are an in-person assessment-roll inspection, MPAC AboutMyProperty
  for a property you own, and a tenancy agreement if you rent.
- Waterloo has no public ownership layer; its pages link to MPAC/ONLAND.
- The live services must be reachable from the browser. If they are not, the sample fallback
  is shown and labelled.
- The map shows property positions on a locally drawn grid, not street geometry. Use the
  "Open in OpenStreetMap" link for a street basemap.
- Records are provided “as is”. Verify with the official source.

## Licence

Code: MIT. Data: Open Government Licence — The Corporation of the City of Kitchener, and the
City of Waterloo Open Data licence. Ledger KW is an independent project and is not endorsed
by either city or by MPAC.
