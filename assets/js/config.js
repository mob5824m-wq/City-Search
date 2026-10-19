/**
 * Ledger KW — configuration & data source registry
 *
 * All data is queried directly from the cities' public ArcGIS REST
 * services from the browser. No API key, no backend, no scraping.
 */

export const APP = {
  name: "Ledger KW",
  tagline: "Public property records for Kitchener & Waterloo",
  updated: "2026",
};

export const SOURCES = {
  kitchenerOwnership: {
    id: "k-owner",
    label: "City of Kitchener — Property Ownership Public",
    short: "Kitchener ownership",
    city: "kitchener",
    url: "https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Property_Ownership_Public/FeatureServer/0",
    licence: "Open Government Licence — The Corporation of the City of Kitchener",
    licenceUrl: "https://www.kitchener.ca/council-and-city-administration/data-and-maps/open-data-licence/",
    portal: "https://open-kitchenergis.opendata.arcgis.com/",
    cadence: "Updated daily",
    coverage: "Every property unit in Kitchener. Owner names are shown only for businesses, institutions, numbered companies and government agencies; residential owners are marked PRIVATE under MFIPPA.",
  },
  kitchenerPermits: {
    id: "k-permits",
    label: "City of Kitchener — Building Permits",
    short: "Kitchener permits",
    city: "kitchener",
    url: "https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/Building_Permits/FeatureServer/0",
    licence: "Open Government Licence — The Corporation of the City of Kitchener",
    licenceUrl: "https://www.kitchener.ca/council-and-city-administration/data-and-maps/open-data-licence/",
    portal: "https://open-kitchenergis.opendata.arcgis.com/",
    cadence: "Updated daily",
    coverage: "Building permits issued by the City of Kitchener, including permit type, work, status, construction value and description.",
  },
  waterlooAddresses: {
    id: "w-addresses",
    label: "City of Waterloo — Address Points",
    short: "Waterloo addresses",
    city: "waterloo",
    url: "https://services.arcgis.com/ZpeBVw5o1kjit7LT/arcgis/rest/services/Addresses/FeatureServer/0",
    licence: "City of Waterloo Open Data Licence",
    licenceUrl: "https://www.waterloo.ca/council-and-city-administration/open-data-and-maps/",
    portal: "https://data.waterloo.ca/",
    cadence: "Updated regularly",
    coverage: "Every valid civic address in Waterloo with ward, latitude and longitude. Waterloo does not publish owner names in its open data.",
  },
  waterlooPermits: {
    id: "w-permits",
    label: "City of Waterloo — Building Permits",
    short: "Waterloo permits",
    city: "waterloo",
    url: "https://services.arcgis.com/ZpeBVw5o1kjit7LT/arcgis/rest/services/City_of_Waterloo_Building_Permits/FeatureServer/0",
    licence: "City of Waterloo Open Data Licence",
    licenceUrl: "https://www.waterloo.ca/council-and-city-administration/open-data-and-maps/",
    portal: "https://data.waterloo.ca/",
    cadence: "Updated daily",
    coverage: "Permits issued, completed or occupancy-final in Waterloo, with work type, description, construction value and units.",
  },
};

export const CITY = {
  kitchener: { id: "kitchener", label: "Kitchener", short: "Kitchener" },
  waterloo: { id: "waterloo", label: "Waterloo", short: "Waterloo" },
};

export const LAST_KNOWN = {
  kTotal: 144931,
  kPublic: 12327,
  wAddresses: 55847,
  asOf: "October 2026",
};

export const OFFICIAL = {
  kitchenerProperty: {
    label: "City of Kitchener — property assessments",
    description: "How assessment and property taxes work in Kitchener",
    href: "https://www.kitchener.ca/taxes-utilities-and-finance/property-taxes/property-assessments/",
  },
  waterlooProperty: {
    label: "City of Waterloo — property taxes & assessment",
    description: "Waterloo's property tax and assessment information",
    href: "https://www.waterloo.ca/water-and-tax-billing/tax-billing/check-property-tax-rates/",
  },
  mpac: {
    label: "MPAC — AboutMyProperty",
    description: "Free assessment details for your own property; the starting point for an assessment roll request",
    href: "https://www.aboutmyproperty.ca/",
  },
  onland: {
    label: "ONLAND — Ontario Land Property Records Portal",
    description: "Search parcel registers and registered ownership for a fee",
    href: "https://www.onland.ca/",
  },
  kitchenerData: {
    label: "Kitchener GeoHub",
    description: "Browse the source ownership dataset",
    href: "https://open-kitchenergis.opendata.arcgis.com/",
  },
  waterlooData: {
    label: "Waterloo Open Data",
    description: "Browse Waterloo's address and permit datasets",
    href: "https://data.waterloo.ca/",
  },
  kitchenerClerk: {
    label: "City of Kitchener — access to information",
    description: "Request records, including assessment information, from the City",
    href: "https://www.kitchener.ca/council-and-city-administration/transparency/freedom-of-information/freedom-of-information-requests/",
  },
  waterlooClerk: {
    label: "City of Waterloo — access to information",
    description: "Request records from the City of Waterloo",
    href: "https://www.waterloo.ca/council-and-city-administration/freedom-of-information-request/",
  },
};

/**
 * Basemap. OpenStreetMap's tile server needs no key or account, which keeps
 * the app working without third-party credentials. If you outgrow it, point
 * `tiles` at a hosted provider (and add its key) here — nothing else changes.
 * If tiles fail, the map falls back to a coordinate-true canvas, never an
 * error from the provider.
 */
export const MAP = {
  tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  maxZoom: 19,
  note: "Street basemap unavailable — markers keep their real positions",
};

export const LIMITS = {
  suggestOwners: 6,
  suggestAddresses: 6,
  ownerResults: 45,
  ownerRowsPerPage: 2000,
  ownerMaxPages: 12,
  addressRows: 800,
  permits: 14,
  unitList: 60,
};

export const QUERY_TIMEOUT = 12000;
export const CACHE_TTL = 10 * 60 * 1000;

export const STORAGE = {
  saved: "ledgerkw.saved.v1",
};
