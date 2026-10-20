import { OFFICIAL, SOURCES, LAST_KNOWN } from "../config.js";
import { formatNumber, setPageTitle } from "../util.js";
import { icon, breadcrumb } from "../ui.js";

export function renderAbout(root) {
  setPageTitle("Data & privacy");

  const sources = [
    {
      name: "Property Ownership Public",
      city: "Kitchener",
      what: `${formatNumber(LAST_KNOWN.kTotal)} property unit records; ${formatNumber(LAST_KNOWN.kPublic)} carry a public owner name`,
      cadence: "Daily",
      href: SOURCES.kitchenerOwnership.portal,
    },
    {
      name: "Building Permits",
      city: "Kitchener",
      what: "Permit type, work, status, description and construction value",
      cadence: "Daily",
      href: SOURCES.kitchenerPermits.portal,
    },
    {
      name: "Address Points",
      city: "Waterloo",
      what: `${formatNumber(LAST_KNOWN.wAddresses)} civic addresses with ward and coordinates`,
      cadence: "Regularly",
      href: SOURCES.waterlooAddresses.portal,
    },
    {
      name: "Building Permits",
      city: "Waterloo",
      what: "Permit description, work type, status, value, units and bedrooms",
      cadence: "Daily",
      href: SOURCES.waterlooPermits.portal,
    },
  ];

  root.innerHTML = `
    <div class="page">
      <div class="wrap">
        ${breadcrumb([{ label: "Home", href: "#/" }, { label: "The data" }])}
        <header class="about-hero">
          <span class="eyebrow">Data &amp; privacy</span>
          <h1>A public record should be readable.</h1>
          <p>Ledger KW is an independent search layer over property records published by the City of Kitchener and the City of Waterloo. Here is exactly what is included, what is not, and how to get the rest.</p>
          <div class="result-meta" style="margin-top:16px">
            <span>Live queries</span><span class="dot"></span>
            <span>No account</span><span class="dot"></span>
            <span>Open government licences</span>
          </div>
        </header>

        <div class="about-grid">
          <article class="prose">
            <h2 id="what">What this is</h2>
            <p>Ledger KW answers two practical questions: <strong>which properties are attributed to a given name</strong>, and <strong>what does the public record say about a given address</strong>. Every search is sent directly from your browser to the cities' public ArcGIS services. There is no scraped copy, no account, and no paywall.</p>
            <p>The site covers <strong>Kitchener and Waterloo only</strong>. Cambridge and the surrounding townships are not included.</p>

            <h2 id="public">What is public — and what isn't</h2>
            <p>Ontario municipalities must protect personal information under the <strong>Municipal Freedom of Information and Protection of Privacy Act (MFIPPA)</strong>. Kitchener applies that rule to its ownership layer: owner names are published only where the owner is a business, numbered company, institution or government agency. Individual homeowners are labelled <code>PRIVATE</code>.</p>
            <div class="pullquote">“The city's open data can tell you that a property is privately owned. It cannot tell you who the individual is.”
              <cite>How Kitchener publishes its ownership layer</cite>
            </div>
            <p>That means a search for a person's name will usually return nothing — not because the tool is broken, but because the information is not in the open dataset. You can still look up any residential address: the building record and its permits are public even when the owner's name is not. The section below explains the official routes to a residential ownership record.</p>
            <p>Waterloo is different again: the city publishes <strong>civic addresses and building permits</strong>, but it does not publish an ownership layer at all. Waterloo addresses therefore appear here without an owner name.</p>

            <table class="source-table">
              <thead><tr><th>Dataset</th><th>City</th><th>What it covers</th><th>Updates</th></tr></thead>
              <tbody>
                ${sources.map((s) => `<tr>
                  <td>${s.name}</td>
                  <td class="mono">${s.city}</td>
                  <td>${s.what}</td>
                  <td class="mono">${s.cadence}</td>
                </tr>`).join("")}
              </tbody>
            </table>
            <p style="font-size:12px;color:var(--muted)">Counts are the values observed when this guide was written (${LAST_KNOWN.asOf}). The live figures are re-checked each time the site loads. Kitchener and Waterloo publish under their respective open government licences; see the footer for attribution.</p>

            <h2 id="owner">What “owner on file” means</h2>
            <p>The ownership layer is the city's assessment/ownership record — the party the municipality attributes each property unit to. It is <strong>not a registered title</strong>. Recent sales, transfers, mortgages and private agreements are not reflected immediately, and the city's data is not a substitute for a parcel register.</p>
            <p>Two quirks are worth knowing:</p>
            <ul>
              <li><strong>Unit-level records.</strong> A single apartment building can appear as hundreds of rows, one per unit. Ledger KW groups them by civic address and shows the unit count.</li>
              <li><strong>Repeated rows.</strong> The source contains duplicate rows for some property units. Results are de-duplicated by property unit ID and unit number, which is why the “ownership records” count can be higher than the number of buildings or units.</li>
            </ul>

            <h2 id="name-search">How name search works</h2>
            <p>Name search matches against the <strong>published owner name</strong>. It is token-based, case-insensitive, and ignores punctuation and common legal suffixes, so <em>“Drewlo Holdings”</em> matches <em>“DREWLO HOLDINGS INC”</em>. Partial names are fine.</p>
            <ul>
              <li>Search a distinctive word: <em>Drewlo</em>, <em>Boardwalk</em>, <em>Activa</em>.</li>
              <li>For numbered companies, search the digits: <em>1000137516</em>.</li>
              <li>If a name is too common, add a second word.</li>
              <li>Individual people — owners of houses, condos and duplexes — are not published.</li>
            </ul>

            <h2 id="residential">If you need a residential owner</h2>
            <p>There is a lawful route for nearly every property. It usually takes one of these four forms:</p>
            <h3>1. Start with MPAC</h3>
            <p><a href="${OFFICIAL.mpac.href}" target="_blank" rel="noopener">AboutMyProperty</a> gives a property owner free access to the assessment details for their own property, including the roll number. The roll number is the key used by the city and by MPAC. Your tax bill or assessment notice also carries it.</p>
            <h3>2. Pull the parcel register on ONLAND</h3>
            <p><a href="${OFFICIAL.onland.href}" target="_blank" rel="noopener">ONLAND</a> is Ontario's land property records portal, operated for the province by Teranet. A parcel register returns the registered owner, the PIN, title history and registered charges, and you can search by PIN or by address. It costs <b>$36.50</b> for the first page plus $2.56 per additional page (the 2025 provincial tariff), and the same document is what a lawyer pulls before closing a purchase.</p>
            <p>The charge is not ours and not the city's: the provincial government set the fees and, under the <i>Electronic Land Registration Services Act, 2010</i>, granted Teranet a 50-year exclusive licence to run the system. The land registry is funded by the people who search it rather than by general taxes. That is a policy choice, and it is why a free public-record search cannot include an individual's name — while a paid provincial search can.</p>
            <h3>3. Inspect the assessment roll</h3>
            <p>Ontario's assessment roll lists the owner of record for each property, and it is available for inspection at the municipality. Ask at the City Clerk's office — Kitchener City Hall, 200 King Street West, or Waterloo City Hall, 100 Regina Street South — during office hours. You can view the roll; copying and reuse are restricted.</p>
            <h3>4. Ask the municipality in writing</h3>
            <p>A formal freedom-of-information request can be made for city records, but personal information about a homeowner is usually withheld under MFIPPA. Start with <a href="${OFFICIAL.kitchenerClerk.href}" target="_blank" rel="noopener">Kitchener's access to information page</a> or <a href="${OFFICIAL.waterlooClerk.href}" target="_blank" rel="noopener">Waterloo's</a>.</p>

            <h2 id="map">The map</h2>
            <p>Maps on this site are drawn in the browser from the coordinates the city publishes — no Google, Esri, Mapbox or CARTO account, no API key and no tile requests. You get the true relative positions of a portfolio or a single property, with a scale bar and north arrow; the “Open in OpenStreetMap” link takes you to a full street map if you want one.</p>

            <h2 id="permits">Building permits</h2>
            <p>Permit history comes from each city's open building permit dataset and is matched to the property by civic address. It includes permit type, work, status, year and — where published — construction value and a short description.</p>
            <p>Coverage is not complete. Not every permit is published, older records may be missing, and construction value is declared by the applicant. A permit is a record of work authorized by the city, not proof that the work was done or inspected.</p>

            <h2 id="faq">Common questions</h2>
            <h3>Can I search for a house?</h3>
            <p>Yes. Search its civic address in either city, for example <a href="#/search?q=35%20Homewood%20Ave&amp;mode=address&amp;city=all">35 Homewood Ave</a> in Kitchener. You'll get the city's record for the building — units, permits, ward and coordinates — plus the owner's name if it is a business or institution. If the home is individually owned, the owner is listed as <code>PRIVATE</code>.</p>
            <h3>Can I filter for residential buildings?</h3>
            <p>Not reliably. Neither city publishes a building-use or property-class field in these open datasets, so there is no honest way to filter a list to “residential only”. Kitchener's zoning, parcels and assessment data are not open. Search by address for a specific home, or use the city's zoning map and MPAC for class information.</p>
            <h3>Why does the owner's name cost money?</h3>
            <p>Because Ontario does not publish it. The city's open data withholds individual names under MFIPPA, and the authoritative record lives in the provincial land registry, which charges a regulated fee for each search. Ontario moved that registry into a public–private partnership in 1991 and, in 2010, granted a 50-year exclusive licence for a $1 billion upfront payment plus royalties; the provincial tariff is what funds it. Nothing on this site is paid, gated or registered — the $36.50 goes to the province's registry, not to Ledger KW.</p>
            <p>Free routes, in order of convenience: check the <b>assessment roll</b> in person at the City Clerk's office; ask <b>MPAC AboutMyProperty</b> about a property you own; if you rent, the landlord's legal name must appear on your <b>tenancy agreement</b>; and for a business, the owner is usually already in Kitchener's open ownership layer, which this site searches for free.</p>
            <h3>Can I search a person's name?</h3>
            <p>For a business or institution, yes. For an individual homeowner, no — the name is protected and the public dataset does not contain it. To identify the owner of one specific property, pull a parcel register on <a href="https://www.onland.ca/" target="_blank" rel="noopener">ONLAND</a> by address or PIN; it returns the registered owner for $36.50 for the first page. For your own property, MPAC AboutMyProperty is free, and the assessment roll can be inspected at City Hall at no charge.</p>
            <h3>Why does one owner have hundreds of “records”?</h3>
            <p>Apartment buildings are recorded unit by unit, and the source repeats some rows. The portfolio page groups rows into buildings and counts distinct units so the picture stays readable.</p>
            <h3>Is this a title search?</h3>
            <p>No. It is a search over municipal open data. For legal ownership, use a parcel register or a title search through a lawyer or title insurer.</p>
            <h3>How current is the data?</h3>
            <p>Searches are sent live. Kitchener updates its ownership and permit layers daily; Waterloo updates permits daily and addresses regularly. The data you see is the data the city is serving at that moment.</p>
            <h3>Why is a building missing?</h3>
            <p>The property may not be in the city's ownership layer, the owner may be recorded under a different legal name, or the address may be recorded as a range or a new subdivision. Try an address search or a shorter name.</p>
            <h3>Can I reuse this data?</h3>
            <p>Yes, under each city's open licence. See the attribution and links in the footer. This site is independent and is not endorsed by either city.</p>

            <h2 id="disclaimer">Disclaimer</h2>
            <p>Ledger KW is an independent project, not an official record of the City of Kitchener, the City of Waterloo, or MPAC. Data is provided “as is”, without warranties of accuracy, completeness or fitness for a particular purpose. Do not rely on it for legal, financial or title decisions. Verify with the official source.</p>
          </article>

          <aside class="about-aside">
            <div class="callout toc">
              <h3>On this page</h3>
              <a href="#/about?section=what">What this is</a>
              <a href="#/about?section=public">What's public</a>
              <a href="#/about?section=owner">Owner on file</a>
              <a href="#/about?section=name-search">Name search</a>
              <a href="#/about?section=residential">Residential owners</a>
              <a href="#/about?section=map">The map</a>
              <a href="#/about?section=permits">Building permits</a>
              <a href="#/about?section=faq">Common questions</a>
              <a href="#/about?section=disclaimer">Disclaimer</a>
            </div>
            <div class="callout callout--dark">
              <h3>${icon("shield")} Need a legal ownership record?</h3>
              <p>Search the parcel register on ONLAND, or start with MPAC for assessment details on your own property.</p>
              <p><a href="${OFFICIAL.onland.href}" target="_blank" rel="noopener">Open ONLAND →</a></p>
            </div>
            <div class="callout">
              <h3>${icon("external")} Official city data</h3>
              <p><a href="${OFFICIAL.kitchenerData.href}" target="_blank" rel="noopener">Kitchener GeoHub</a><br>
              <a href="${OFFICIAL.waterlooData.href}" target="_blank" rel="noopener">Waterloo Open Data</a><br>
              <a href="${OFFICIAL.mpac.href}" target="_blank" rel="noopener">MPAC</a></p>
              <p>Licences: <a href="${SOURCES.kitchenerOwnership.licenceUrl}" target="_blank" rel="noopener">Kitchener OGL</a> · <a href="${SOURCES.waterlooAddresses.licenceUrl}" target="_blank" rel="noopener">Waterloo terms</a></p>
            </div>
          </aside>
        </div>
      </div>
    </div>`;
}
