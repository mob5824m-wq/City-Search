import { getStats, getTopOwners, isSample } from "../data.js";
import { escapeHtml, formatNumber, ownerType, ownerTypeLabel, buildOwnerHref, setPageTitle, pluralize } from "../util.js";
import { mountSearch, icon, typeTag, emptyState } from "../ui.js";

export async function renderHome(root, params, ctx = {}) {
  setPageTitle(null);
  root.innerHTML = `
    <section class="hero">
      <div class="wrap hero__inner">
        <div class="hero__copy">
          <div class="eyebrow-row">
            <span class="eyebrow">Public records · Kitchener + Waterloo</span>
            <span class="rule" aria-hidden="true"></span>
            <span class="eyebrow">No paywall</span>
          </div>
          <h1>Who owns<br><span class="accent">what</span> in KW.</h1>
          <p class="lede">Search public property records by owner name or address. See every property linked to a business, institution or agency — and pull the permit history for any building.</p>

          <div data-search-slot></div>

          <div class="hero__meta">
            <span>${icon("shield")} Residential owner names are protected by Ontario privacy law</span>
            <a href="#/about">How this works</a>
          </div>
        </div>

        <aside class="specimen-wrap" aria-label="Example ownership record">
          <a class="specimen" href="${buildOwnerHref("DREWLO HOLDINGS INC")}" data-specimen>
            <div class="specimen__top">
              <span>RECORD / 000704</span>
              <span class="tag tag--city">Kitchener</span>
            </div>
            <p class="specimen__label">Owner on file</p>
            <p class="specimen__name" data-specimen-name>Drewlo Holdings Inc</p>
            <dl class="specimen__rows">
              <div class="specimen__row"><dt>Property records</dt><dd data-specimen-count>704</dd></div>
              <div class="specimen__row"><dt>Owner type</dt><dd data-specimen-type>Business</dd></div>
              <div class="specimen__row"><dt>City</dt><dd>Kitchener</dd></div>
              <div class="specimen__row"><dt>Source</dt><dd>City open data</dd></div>
            </dl>
            <div class="specimen__foot">
              <span class="go">Open portfolio ${icon("arrow-right", "ico--sm")}</span>
              <span class="eyebrow">Example</span>
            </div>
            <span class="specimen__stamp">Public data</span>
          </a>
          <p class="specimen__note">A real record from the city's open ownership layer. Open it to see every address linked to the name.</p>
        </aside>
      </div>
    </section>

    <section class="stat-strip" aria-label="Records at a glance">
      <div class="wrap stat-strip__inner">
        <div class="stat">
          <b data-stat="kTotal">—</b>
          <span>Property records</span>
          <small>Kitchener ownership layer</small>
        </div>
        <div class="stat">
          <b data-stat="kPublic">—</b>
          <span>With a public owner</span>
          <small>Business, institution, government</small>
        </div>
        <div class="stat">
          <b data-stat="wAddresses">—</b>
          <span>Waterloo addresses</span>
          <small>Owner names not published</small>
        </div>
        <div class="stat">
          <b>Daily</b>
          <span>City updates</span>
          <small>Queried live, never cached in a warehouse</small>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div class="section-head__copy">
            <span class="eyebrow">By the numbers</span>
            <h2>Largest owners on file</h2>
            <p>The business, institutional and government owners with the most property records in Kitchener's public data.</p>
          </div>
          <button class="btn" type="button" data-focus-search>Search a name ${icon("arrow-right", "ico--sm")}</button>
        </div>
        <ol class="rank-list" data-rank-list aria-live="polite">
          ${Array.from({ length: 6 }, () => '<div class="skeleton skeleton--row" style="margin:7px 0;height:52px"></div>').join("")}
        </ol>
        ${isSample() ? `<p class="sample-note" style="margin-top:16px">${icon("info")} Showing the offline sample extract — only a handful of owners are available.</p>` : ""}
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap">
        <div class="section-head">
          <div class="section-head__copy">
            <span class="eyebrow">What you can do</span>
            <h2>Records that answer real questions</h2>
          </div>
        </div>
        <div class="feature-grid">
          <article class="feature">
            <div class="feature__icon">${icon("building", "ico--lg")}</div>
            <h3>Every property linked to a name</h3>
            <p>Open an owner portfolio to see all buildings and units on file, grouped by address. Export the whole list as a CSV in one click.</p>
            <a class="feature__link" href="#/owner?name=CITY%20OF%20KITCHENER">See an example ${icon("arrow-right", "ico--sm")}</a>
          </article>
          <article class="feature">
            <div class="feature__icon">${icon("doc", "ico--lg")}</div>
            <h3>Permit history on the record</h3>
            <p>Each property page shows building permits published by the city — type of work, status, year and construction value.</p>
            <a class="feature__link" href="#/search?q=200%20King%20St%20W&mode=address&city=kitchener">Look up an address ${icon("arrow-right", "ico--sm")}</a>
          </article>
          <article class="feature">
            <div class="feature__icon">${icon("shield", "ico--lg")}</div>
            <h3>Privacy, stated plainly</h3>
            <p>Ontario hides residential owner names. We show exactly what the cities publish — and the official route when you need more.</p>
            <a class="feature__link" href="#/about">Read the data guide ${icon("arrow-right", "ico--sm")}</a>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="privacy-panel">
          <div>
            <span class="eyebrow">Privacy &amp; access</span>
            <h2>Homeowner names are private. <em>Business owners aren't.</em></h2>
            <p>Under Ontario's Municipal Freedom of Information and Protection of Privacy Act (MFIPPA), Kitchener publishes owner names only for businesses, institutions, numbered companies and government agencies. Individual homeowners appear as “Private”.</p>
            <a class="btn" href="#/about">Read the data guide ${icon("arrow-right", "ico--sm")}</a>
          </div>
          <div class="privacy-panel__steps">
            <div class="step">
              <span class="step__no">01</span>
              <div>
                <h3>Search what is public</h3>
                <p>Find a company, numbered company, school, hospital or agency and see every property attributed to it.</p>
              </div>
            </div>
            <div class="step">
              <span class="step__no">02</span>
              <div>
                <h3>Search by address</h3>
                <p>Get the owner on file where it is public, plus permits and the city's own reference links.</p>
              </div>
            </div>
            <div class="step">
              <span class="step__no">03</span>
              <div>
                <h3>Need a residential owner?</h3>
                <p>Use MPAC's AboutMyProperty or an ONLAND parcel register search. The data guide walks through both.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const search = mountSearch(root.querySelector("[data-search-slot]"), {
    mode: "name",
    city: "all",
    autofocus: false,
    signal: ctx.signal,
  });

  root.querySelector("[data-focus-search]")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => search?.focus(), 260);
  });

  // Fill stats (uses known-good fallbacks if the live service is unavailable).
  getStats().then((stats) => {
    if (ctx.signal && ctx.signal.aborted) return;
    const set = (key, value) => {
      const el = root.querySelector(`[data-stat="${key}"]`);
      if (el) el.textContent = formatNumber(value);
    };
    set("kTotal", stats.kTotal);
    set("kPublic", stats.kPublic);
    set("wAddresses", stats.wAddresses);
  }).catch(() => {});

  // Fill the rank list with the largest public owners.
  try {
    const owners = await getTopOwners({ limit: 7, signal: ctx.signal });
    if (ctx.signal && ctx.signal.aborted) return;
    const list = root.querySelector("[data-rank-list]");
    if (!list) return;

    if (!owners.length) {
      list.outerHTML = emptyState({
        iconName: "building",
        title: "No owner records available",
        body: "The city's ownership service did not return records. Try again in a moment.",
        actions: `<a class="btn btn--primary" href="#/">Back to search</a>`,
      });
      return;
    }

    list.innerHTML = owners.map((owner, i) => `<li>
      <a class="rank" href="${buildOwnerHref(owner.name)}">
        <span class="rank__no">${String(i + 1).padStart(2, "0")}</span>
        <span class="rank__name">${escapeHtml(owner.name)}</span>
        <span class="rank__type">${typeTag(owner.name)}</span>
        <span class="rank__count">${pluralize(owner.count, "record")}</span>
        <span class="rank__arrow">${icon("arrow-right", "ico--sm")}</span>
      </a>
    </li>`).join("");

    // Use a real, mid-sized portfolio as the specimen card.
    const featured = owners.find((o) => /DREWLO|BOARDWALK|KILLAM|HOLDINGS/i.test(o.name)) || owners[1] || owners[0];
    if (featured) {
      const card = root.querySelector("[data-specimen]");
      if (card) {
        card.href = buildOwnerHref(featured.name);
        const nameEl = card.querySelector("[data-specimen-name]");
        const countEl = card.querySelector("[data-specimen-count]");
        const typeEl = card.querySelector("[data-specimen-type]");
        if (nameEl) nameEl.textContent = featured.name;
        if (countEl) countEl.textContent = formatNumber(featured.count);
        if (typeEl) typeEl.textContent = ownerTypeLabel(ownerType(featured.name));
      }
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
    const list = root.querySelector("[data-rank-list]");
    if (list) {
      list.outerHTML = `<div class="inline-error">${icon("info")}<div><strong>The ranking could not be loaded</strong>${escapeHtml(err.message)}</div></div>`;
    }
  }
}
