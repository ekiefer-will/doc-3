/* Build QR PNGs + manifest from docs with `qr: true` */
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const matter = require("gray-matter");
const { globby } = require("globby");
const QRCode = require("qrcode");

/** Configure these if needed */
const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://ekiefer-will.github.io/documentation";
const DOCS_BASE = process.env.DOCS_BASE || "/docs"; // Docusaurus default
const DOCS_DIR = path.join(process.cwd(), "docs");
const OUT_DIR = path.join(process.cwd(), "static", "qr");

function toRouteFromFile(fileAbs) {
  const rel = path.posix.join(...path.relative(DOCS_DIR, fileAbs).split(path.sep));
  const noExt = rel.replace(/\.(md|mdx)$/i, "");
  // If the doc has an absolute slug in front matter, we'll use that instead.
  return `${DOCS_BASE}/${noExt}`.replace(/\/index$/i, "/");
}

(async () => {
  await fsp.mkdir(OUT_DIR, { recursive: true });
  const files = await globby(["**/*.md", "**/*.mdx"], { cwd: DOCS_DIR, absolute: true });

  const items = [];
  for (const file of files) {
    const raw = await fsp.readFile(file, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data || {};
    if (fm.qr !== true) continue;

    const title = fm.title || fm.id || path.basename(file);
    let urlPath;
    if (typeof fm.slug === "string" && fm.slug.startsWith("/")) {
      // absolute slug wins (e.g., /cms/my-page)
      urlPath = fm.slug;
    } else if (typeof fm.slug === "string") {
      urlPath = `${DOCS_BASE}/${fm.slug.replace(/^\/+/, "")}`;
    } else {
      urlPath = toRouteFromFile(file);
    }

    const absoluteUrl = SITE_ORIGIN.replace(/\/+$/, "") + urlPath;
    const safeName = urlPath.replace(/[^a-z0-9/_-]+/gi, "-").replace(/\/+/g, "_").replace(/^_+|_+$/g, "");
    const outPng = path.join(OUT_DIR, `${safeName || "doc"}.png`);

    await QRCode.toFile(outPng, absoluteUrl, { width: 512, margin: 1 });
    items.push({
      title,
      url: urlPath,            // route path (the page uses useBaseUrl to prefix)
      file: `/qr/${path.basename(outPng)}`, // static path
    });
  }

  // Sort for stable output
  items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  const manifestPath = path.join(OUT_DIR, "_manifest.json");
  await fsp.writeFile(manifestPath, JSON.stringify(items, null, 2), "utf8");

  console.log(`Wrote ${items.length} QR(s) to ${OUT_DIR}`);
})();
