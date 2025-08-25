// scripts/sync-contentful.js
/* eslint-disable */
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const contentful = require("contentful");
const { documentToHtmlString } = require("@contentful/rich-text-html-renderer");

const {
  CONTENTFUL_SPACE_ID,
  CONTENTFUL_ENVIRONMENT = "master",
  CONTENTFUL_DELIVERY_TOKEN,
} = process.env;

if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_DELIVERY_TOKEN) {
  console.error("Missing Contentful env vars");
  process.exit(1);
}

const client = contentful.createClient({
  space: CONTENTFUL_SPACE_ID,
  accessToken: CONTENTFUL_DELIVERY_TOKEN,
  environment: CONTENTFUL_ENVIRONMENT,
});

const OUT_DIR = path.join(process.cwd(), "docs", "cms");
fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  // Adjust `content_type` to your model API ID (e.g., 'docPage')
  const entries = await client.getEntries({
    content_type: "docPage",
    include: 2,
    limit: 1000,
  });

  for (const item of entries.items) {
    const f = item.fields;
    const slug = f.slug;
    const title = f.title || slug;
    const tags = Array.isArray(f.tags) ? f.tags : [];
    const sidebarPosition =
      typeof f.sidebarPosition === "number" ? f.sidebarPosition : undefined;
    const sidebarGroup = f.sidebarGroup || "Contentful";

    // Convert body (Rich Text -> HTML; if you store Markdown, just use it as-is)
    let bodyContent = "";
    if (f.body && f.body.nodeType) {
      bodyContent = documentToHtmlString(f.body, {
        // customize marks/nodes here if needed
        preserveWhitespace: true,
      });
    } else if (typeof f.body === "string") {
      bodyContent = f.body; // already Markdown
    }

    const frontMatter = [
      "---",
      `id: ${slug}`,
      `title: ${JSON.stringify(title)}`,
      `slug: /cms/${slug}`,
      `tags: [${tags.map((t) => JSON.stringify(t)).join(", ")}]`,
      `sidebar_label: ${JSON.stringify(title)}`,
      `sidebar_position: ${sidebarPosition ?? 9999}`,
      `sidebar_class_name: ${JSON.stringify(sidebarGroup)}`,
      "last_update:",
      `  date: ${new Date(item.sys.updatedAt).toISOString()}`,
      "---",
      "",
    ].join("\n");

    // If bodyContent is HTML, MDX will happily render raw HTML
    const content =
      typeof f.body === "string"
        ? `${frontMatter}${bodyContent}\n`
        : `${frontMatter}${bodyContent}\n`;

    const file = path.join(OUT_DIR, `${slug}.mdx`);
    fs.writeFileSync(file, content, "utf8");
    console.log("Wrote", file);
  }

  console.log(`Synced ${entries.items.length} entries to ${OUT_DIR}`);
})();
