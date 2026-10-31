// The per-service landing pages: distinct, truthful, linked and in the sitemap.
import { read, load } from "./helpers/repo.mjs";
import { suite } from "./helpers/harness.mjs";

const { ok, eq, done } = suite("servicePages");
const { SERVICE_PAGES, servicePath } = await load("utils/servicePages.js");
const pricing = await load("utils/pricing.js");
const seo = await load("utils/seo.js");

ok("there are service pages", SERVICE_PAGES.length >= 5);

// Not doorway pages: every one has its own title, description, h1 and copy.
for (const key of ["slug", "title", "description", "h1"]) {
  const vals = SERVICE_PAGES.map((p) => p[key]);
  eq(`every ${key} is unique`, new Set(vals).size, vals.length);
}
const intros = SERVICE_PAGES.map((p) => p.intro.join(" "));
eq("every intro is unique", new Set(intros).size, intros.length);

for (const p of SERVICE_PAGES) {
  ok(`${p.slug}: slug is url-safe`, /^[a-z0-9-]+$/.test(p.slug));
  ok(`${p.slug}: title names the city`, /las vegas/i.test(p.title));
  ok(`${p.slug}: description fits a search snippet`, p.description.length <= 160, String(p.description.length));
  ok(`${p.slug}: has questions`, p.faq.length >= 3);
  for (const k of p.services) ok(`${p.slug}: ${k} is a real, bookable service`, pricing.SERVICES[k] && !pricing.SERVICES[k].legacy);
  if (p.preselect?.service) ok(`${p.slug}: the Book link preselects a real service`, !!pricing.SERVICES[p.preselect.service]);
}

// Prices in the copy come from pricing.js, so they must match it.
{
  const gx = SERVICE_PAGES.find((p) => p.slug.startsWith("gel-x"));
  ok("gel-x page quotes the real starting price", gx.title.includes(pricing.formatPrice(pricing.SERVICES["Gel-X"].lengths[0])));
}

// The client-facing promises that tests/policy.test.mjs guards elsewhere.
{
  const src = read("utils/servicePages.js");
  ok("no service page promises a refund", !/is refundable|will be refunded/i.test(src));
  ok("no service page promises a credit", !/credit toward|carries over as credit/i.test(src));
  ok("no fabricated ratings on service pages", !/aggregateRating|ratingValue/i.test(src + read("pages/nails/[slug].jsx")));
}

// Linked and mapped.
{
  const sitemap = read("pages/sitemap.xml.js");
  ok("sitemap includes the service pages", /SERVICE_PAGES\.map/.test(sitemap));
  ok("homepage links to every service page", /SERVICE_PAGES\.map/.test(read("pages/index.js")));
  ok("prices page links to every service page", /SERVICE_PAGES\.map/.test(read("pages/services.jsx")));
  const config = read("next.config.js");
  ok("service pages are not noindexed", !config.includes("'/nails"));
  for (const p of SERVICE_PAGES) ok(`${servicePath(p)} lives under /nails/`, servicePath(p) === `/nails/${p.slug}`);
}

// One h1, and it's the page's own.
{
  const tpl = read("pages/nails/[slug].jsx").replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  eq("the template has exactly one <h1>", (tpl.match(/<h1[\s>]/g) || []).length, 1);
  ok("the h1 is the page's h1", /<h1[^>]*>\{page\.h1\}<\/h1>/.test(tpl));
}

// Structured data ties each service to the salon and serves both cities.
{
  const svc = seo.serviceJsonLd({ name: "Gel-X", description: "x", path: "/nails/gel-x-las-vegas", minCents: 6000 });
  ok("service points at the salon by @id", svc.provider["@id"].endsWith("/#salon"));
  eq("service min price is a dollar string", svc.offers.priceSpecification.minPrice, "60.00");
  const salon = seo.salonJsonLd("2026-11-01");
  const areas = salon.areaServed.map((a) => a.name).join(",");
  ok("salon serves Henderson", areas.includes("Henderson"));
  ok("salon serves Las Vegas", areas.includes("Las Vegas"));
}

done();
