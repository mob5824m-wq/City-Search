import { getSaved, removeOwner, removeProperty } from "../store.js";
import { escapeHtml, formatDate, buildOwnerHref, buildPropertyHref, setPageTitle, ownerType, ownerTypeLabel } from "../util.js";
import { icon, breadcrumb, emptyState, toast } from "../ui.js";

export function renderSaved(root) {
  setPageTitle("Saved records");
  const saved = getSaved();
  const owners = saved.owners || [];
  const properties = saved.properties || [];

  root.innerHTML = `
    <div class="page">
      <div class="wrap">
        ${breadcrumb([{ label: "Home", href: "#/" }, { label: "Saved" }])}
        <div class="page-head">
          <span class="eyebrow">Your records</span>
          <h1>Saved</h1>
          <p class="sub">Owners and properties you've bookmarked. Everything stays in this browser — no account, no sync, no tracking.</p>
        </div>

        <div class="saved-grid">
          <section class="saved-col" aria-labelledby="saved-owners-heading">
            <h2 id="saved-owners-heading">${icon("building", "ico--sm")} Owners <span>${owners.length}</span></h2>
            <div data-saved-owners></div>
          </section>
          <section class="saved-col" aria-labelledby="saved-properties-heading">
            <h2 id="saved-properties-heading">${icon("pin", "ico--sm")} Properties <span>${properties.length}</span></h2>
            <div data-saved-properties></div>
          </section>
        </div>

        ${owners.length + properties.length === 0 ? `<div style="margin-top:34px">${emptyState({
          iconName: "bookmark",
          title: "Nothing saved yet",
          body: "Open an owner portfolio or a property record and press Save. Your list will appear here the next time you visit.",
          actions: `<a class="btn btn--primary" href="#/">Search the records</a>`,
        })}</div>` : ""}
      </div>
    </div>`;

  const ownersHost = root.querySelector("[data-saved-owners]");
  const propsHost = root.querySelector("[data-saved-properties]");

  if (!owners.length) {
    ownersHost.innerHTML = `<div class="saved-empty">No saved owners yet.</div>`;
  } else {
    ownersHost.innerHTML = owners.map((o) => `<div class="saved-item" data-owner="${escapeHtml(o.name)}">
      <span class="owner-mono" style="width:38px;height:38px;font-size:14px;border-radius:8px">${escapeHtml(initials(o.name))}</span>
      <div class="saved-item__main">
        <a class="saved-item__name" href="${buildOwnerHref(o.name)}">${escapeHtml(o.name)}</a>
        <div class="saved-item__meta">Saved ${formatDate(o.savedAt)} · ${escapeHtml(ownerTypeLabel(ownerType(o.name)))}</div>
      </div>
      <button class="icon-btn" type="button" data-remove-owner="${escapeHtml(o.name)}" aria-label="Remove ${escapeHtml(o.name)}">${icon("close", "ico--sm")}</button>
    </div>`).join("");
  }

  if (!properties.length) {
    propsHost.innerHTML = `<div class="saved-empty">No saved properties yet.</div>`;
  } else {
    propsHost.innerHTML = properties.map((p) => `<div class="saved-item">
      <span class="result-row__icon" style="width:38px;height:38px;border-radius:8px">${icon("pin", "ico--sm")}</span>
      <div class="saved-item__main">
        <a class="saved-item__name" href="${buildPropertyHref(p)}">${escapeHtml(p.address)}</a>
        <div class="saved-item__meta">${p.city === "waterloo" ? "Waterloo" : "Kitchener"} · saved ${formatDate(p.savedAt)}</div>
      </div>
      <button class="icon-btn" type="button" data-remove-property="${escapeHtml(p.address)}" data-city="${escapeHtml(p.city)}" aria-label="Remove ${escapeHtml(p.address)}">${icon("close", "ico--sm")}</button>
    </div>`).join("");
  }

  ownersHost.querySelectorAll("[data-remove-owner]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeOwner(btn.dataset.removeOwner);
      toast("Removed from saved records");
      renderSaved(root);
    });
  });

  propsHost.querySelectorAll("[data-remove-property]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeProperty({ city: btn.dataset.city, address: btn.dataset.removeProperty });
      toast("Removed from saved records");
      renderSaved(root);
    });
  });
}

function initials(name) {
  return String(name || "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "—";
}
