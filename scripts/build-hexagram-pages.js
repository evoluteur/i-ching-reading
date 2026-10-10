#!/usr/bin/env node
// Generates the static hexagram pages: hexagrams/<n>-<name>.html (one per
// hexagram) and hexagrams/index.html (all 64), plus sitemap.xml and robots.txt.
//
//   node scripts/build-hexagram-pages.js
//
// Hexagram data comes from js/iching-data.js (the same file the app uses).
// The pages are plain HTML so search engines can read them without running
// any JavaScript; re-run the script after editing the data, and commit the
// generated files.
//
// datePublished is kept from the existing page, and dateModified / sitemap
// lastmod only move when a page's content actually changes.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const SITE = "https://evoluteur.github.io/i-ching-reading/";

// the GitHub link markup is taken from index.html so the two stay identical
// (\s tolerates the line breaks a code formatter may add inside the tag)
const GITHUB_LINK = fs
  .readFileSync(path.join(root, "index.html"), "utf8")
  .match(/<a\s[^>]*id="omg-github"[\s\S]*?<\/a>/)?.[0];
if (!GITHUB_LINK)
  throw new Error('index.html has no <a id="omg-github"> link to copy');
const DIR = "hexagrams";
const TODAY = new Date().toISOString().slice(0, 10);

const { HEXAGRAMS, TRIGRAMS, LINE_POSITIONS } = vm.runInNewContext(
  fs.readFileSync(path.join(root, "js/iching-data.js"), "utf8") +
    ";({ HEXAGRAMS, TRIGRAMS, LINE_POSITIONS })",
);

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const listText = (arr) =>
  arr.length < 2
    ? arr.join("")
    : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;
const firstSentence = (s) => s.split(/(?<=\.)\s/)[0];

const hexes = HEXAGRAMS.map((h) => ({
  ...h,
  id: `${h.number}-${slug(h.name)}`,
  symbol: String.fromCodePoint(0x4dc0 + h.number - 1),
}));
if (hexes.length !== 64)
  throw new Error(`expected 64 hexagrams, got ${hexes.length}`);
const byLines = (lines) =>
  hexes.find((h) => h.lines.every((v, i) => v === lines[i]));

// traditional relationships between hexagrams
const nuclearOf = (h) =>
  byLines([
    h.lines[1],
    h.lines[2],
    h.lines[3],
    h.lines[2],
    h.lines[3],
    h.lines[4],
  ]);
const oppositeOf = (h) => byLines(h.lines.map((v) => 1 - v));
const inverseOf = (h) => byLines([...h.lines].reverse());

const TRIGRAM_NOTES = {
  qian: "strong, creative and persistent",
  kun: "yielding, receptive and nourishing",
  zhen: "arousing, sudden and energetic",
  kan: "deep, flowing and dangerous",
  gen: "still, steady and restrained",
  xun: "gentle, gradual and penetrating",
  li: "bright, clinging and clear",
  dui: "joyful, open and pleasing",
};

// ---------------------------------------------------------------- drawing

// Same geometry as hexagramSvg() in js/iching.js; lines are bottom to top.
const hexSvg = (h, size = 100, cls = "hexagram-svg") => {
  const W = 100;
  const H = 5 * 18 + 10;
  const rows = [];
  for (let i = 5; i >= 0; i--) {
    const y = (5 - i) * 18;
    rows.push(
      h.lines[i]
        ? `<rect x="0" y="${y}" width="100" height="10" rx="2" />`
        : `<rect x="0" y="${y}" width="42" height="10" rx="2" /><rect x="58" y="${y}" width="42" height="10" rx="2" />`,
    );
  }
  const w = Math.round((size * W) / H);
  return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" style="width:${w}px;height:${size}px" role="img" aria-label="Hexagram ${h.number}, ${esc(h.name)}">${rows.join("")}</svg>`;
};

// ---------------------------------------------------------------- page parts

const head = ({
  title,
  description,
  url,
  ogType = "article",
  jsonld,
}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-063933E3C2"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag("js", new Date());
      gtag("config", "G-063933E3C2");
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="author" content="Olivier Giulieri" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" type="image/png" href="../favicon.png" />
    <meta name="theme-color" content="#1a212d" />
    <meta property="og:site_name" content="I Ching Reading" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}i-ching-reading.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${SITE}i-ching-reading.png" />
    <script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
    </script>

    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Overpass" />
    <link id="omg-core-css" rel="stylesheet" href="../css/core.css" />
    <script>
      // Themes (dark, light, evol-blue) are copies of omg-themes; the base is "../" because this page is in ${DIR}/.
      window.OMG_THEMES_BASE = "../";
      window.OMG_DEFAULT_THEME = "dark";
      (function () {
        var t = window.OMG_DEFAULT_THEME;
        try {
          t = localStorage.getItem("omg-theme") || t;
        } catch (e) {}
        if (t !== "dark" && t !== "light" && t !== "evol-blue") t = window.OMG_DEFAULT_THEME;
        document.documentElement.setAttribute("data-theme", t);
        // written here (not in the markup) so the saved theme loads before first paint
        document.write(
          '<link id="omg-theme-css" rel="stylesheet" href="' + window.OMG_THEMES_BASE + "css/themes/" + t + "/" + t + '.css" />',
        );
      })();
    </script>
    <link id="omg-density-css" rel="stylesheet" href="../css/densities.css" />
    <link rel="stylesheet" href="../css/iching.css" />
    <link rel="stylesheet" href="../css/about.css" />
    <link rel="stylesheet" href="../css/hexagram-page.css" />

    <script src="../js/omg.js"></script>
  </head>
`;

const header = () => `
  <body onload="setupPage('hexagram');" id="omg-body" class="medium">
    <div id="omg-header">
      <h1><a href="../index.html">I Ching Reading</a></h1>
      <div id="omg-theme-picker"></div>
      ${GITHUB_LINK}
    </div>`;

const footer = () => `
      <div class="footer">
        <p><a href="../index.html">Cast a hexagram</a> · <a href="index.html">All 64 hexagrams</a> · <a href="../about.html">About the I Ching</a></p>
        <p>Hexagram names and trigram structure follow the traditional King Wen sequence. Summaries and advice were written for this app.</p>
        <p>
          I Ching Reading is open source on
          <a href="https://github.com/evoluteur/i-ching-reading">GitHub</a>
          with an MIT license. Had fun browsing the app?
          <a href="https://github.com/sponsors/evoluteur">Buy me a coffee by becoming a sponsor</a>.
        </p>
        <p>
          You may also enjoy other readings like <a href="https://evoluteur.github.io/tarot-reading/">Tarot</a>, <a href="https://evoluteur.github.io/rune-reading/">Runes</a>, <a href="https://evoluteur.github.io/tibetan-mo-reading/">Tibetan Mo</a>, and <a href="https://evoluteur.github.io/motivational-numerology/">Numerology</a>. For more mystic arts as small web apps, see
          <a href="https://evoluteur.github.io/esoterica.html">Esoterica</a>.
        </p>
        <p class="copyright">
          &#169; 2026
          <a href="https://evoluteur.github.io/">Olivier Giulieri</a>
        </p>
      </div>
    </div>
  </body>
</html>
`;

const author = {
  "@type": "Person",
  name: "Olivier Giulieri",
  url: "https://evoluteur.github.io/",
};
const breadcrumb = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, url], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: url,
  })),
});
const website = { "@type": "WebSite", name: "I Ching Reading", url: SITE };

const trigramText = (key) =>
  `${TRIGRAMS[key].char} ${TRIGRAMS[key].image} (${TRIGRAMS[key].name})`;
const hexLink = (h) => `<a href="${h.id}.html">${h.number}. ${h.name}</a>`;
const relatedCard = (label, note, h, self) =>
  `<li><a class="hex-pick" href="${h.id}.html">${hexSvg(h, 44)}<span class="hp-text"><span class="hp-label">${label}</span><span class="hp-name">${h.number}. ${h.name}</span><span class="hp-note">${h === self ? "itself: " : ""}${note}</span></span></a></li>`;

// ---------------------------------------------------------------- one hexagram

const hexPage = (h, i) => {
  const up = TRIGRAMS[h.upper];
  const low = TRIGRAMS[h.lower];
  const prev = hexes[i - 1];
  const next = hexes[i + 1];
  const url = `${SITE}${DIR}/${h.id}.html`;
  const title = `I Ching Hexagram ${h.number}: ${h.name} (${h.char} ${h.pinyin}) | I Ching Reading`;
  const description = `Hexagram ${h.number} of the I Ching, ${h.name} (${h.char} ${h.pinyin}), is ${up.image} over ${low.image}: ${listText(
    h.keywords,
  )}. Its meaning, advice, trigrams and six lines.`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: `I Ching hexagram ${h.number}: ${h.name}`,
        description,
        url,
        mainEntityOfPage: url,
        inLanguage: "en",
        about: `Hexagram ${h.number} of the I Ching, ${h.name}`,
        keywords: [
          `hexagram ${h.number}`,
          h.name,
          h.pinyin,
          h.char,
          "I Ching",
          "Yijing",
          ...h.keywords,
        ].join(", "),
        image: `${SITE}i-ching-reading.png`,
        datePublished: "%DATE_PUBLISHED%",
        dateModified: "%DATE_MODIFIED%",
        author,
        isPartOf: website,
      },
      breadcrumb([
        ["I Ching Reading", SITE],
        ["The 64 hexagrams", `${SITE}${DIR}/`],
        [`${h.number}. ${h.name}`, url],
      ]),
    ],
  };
  const same = h.upper === h.lower;
  const structure = same
    ? `${h.name} doubles the trigram ${trigramText(h.upper)}: ${TRIGRAM_NOTES[h.upper]} above and below, the quality of ${up.image.toLowerCase()} at its purest.`
    : `${h.name} places ${trigramText(h.upper)}, ${TRIGRAM_NOTES[h.upper]}, above ${trigramText(h.lower)}, ${TRIGRAM_NOTES[h.lower]}. The lower trigram is the inner side of the situation and the upper one its outer side.`;
  const yang = h.lines.filter(Boolean).length;
  const lines = LINE_POSITIONS.map(
    (p, li) =>
      `<li><strong>${p.name}</strong> <span class="line-kind">(${h.lines[li] ? "yang, solid" : "yin, broken"})</span>: ${lc(p.theme)}. ${p.text}</li>`,
  ).join("\n        ");
  const nuclear = nuclearOf(h);
  const opposite = oppositeOf(h);
  const inverse = inverseOf(h);
  // previous / next links, shown under the title and again at the bottom
  const hexNav = (
    where,
  ) => `<nav class="hex-nav ${where}" aria-label="Previous and next hexagram${where === "top" ? " (top)" : ""}">
        <span>${prev ? `<a href="${prev.id}.html" rel="prev">← ${prev.number}. ${prev.name}</a>` : ""}</span>
        <a href="index.html">All 64 hexagrams</a>
        <span>${next ? `<a href="${next.id}.html" rel="next">${next.number}. ${next.name} →</a>` : ""}</span>
      </nav>`;
  return (
    head({ title, description, url, jsonld }) +
    header() +
    `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="../index.html">I Ching Reading</a> › <a href="index.html">The 64 hexagrams</a> › ${h.number}. ${h.name}</nav>
    <h2 class="hex-title">Hexagram ${h.number}: ${h.name}</h2>
    <div class="content about hex-page">
      ${hexNav("top")}

      <div class="hex-hero">
        <div class="hex-figure">${hexSvg(h, 120)}</div>
        <div>
          <p class="hex-facts"><span class="hf-char" lang="zh">${h.char}</span> · ${h.pinyin} · ${up.image} over ${low.image}</p>
          <div class="keywords">${h.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>
        </div>
      </div>

      <p class="lede">${h.name} (${h.char}, ${h.pinyin}) is hexagram ${h.number} of the 64 hexagrams of the I Ching, in the traditional King Wen order. It is made of ${up.image} (${up.char}) above ${low.image} (${low.char}).</p>

      <h3>Meaning of hexagram ${h.number}</h3>
      <p>${h.meaning}</p>

      <h3>Advice</h3>
      <p class="fortune">${h.advice}</p>

      <h3>The two trigrams</h3>
      <p>${structure}</p>
      <dl class="anatomy">
        <dt>Hexagram</dt><dd>${h.number}. ${h.name}</dd>
        <dt>Chinese name</dt><dd><span lang="zh">${h.char}</span> ${h.pinyin}</dd>
        <dt>Upper trigram</dt><dd>${trigramText(h.upper)}</dd>
        <dt>Lower trigram</dt><dd>${trigramText(h.lower)}</dd>
        <dt>Lines</dt><dd>${yang} yang (solid) and ${6 - yang} yin (broken)</dd>
        <dt>Place in the sequence</dt><dd>${h.number} of 64 (King Wen order)</dd>
      </dl>

      <h3>The six lines of ${h.name}</h3>
      <p>A hexagram is read from the bottom line up. In a reading, a changing line (a 6 or a 9 in the three-coin method) draws attention to its position.</p>
      <ol class="hex-lines">
        ${lines}
      </ol>

      <h3>Related hexagrams</h3>
      <ul class="hex-related">
        ${relatedCard("Nuclear hexagram", "the inner lines 2 to 5, what is hidden inside", nuclear, h)}
        ${relatedCard("Opposite", "every line changed", opposite, h)}
        ${relatedCard("Inverse", "the hexagram turned upside down", inverse, h)}
      </ul>
      <p><button type="button" class="interpret-btn" onclick="location.href='../index.html'">Cast a Hexagram Now</button></p>

      ${hexNav("bottom")}
` +
    footer()
  );
};

// ---------------------------------------------------------------- hub

const hubPage = () => {
  const url = `${SITE}${DIR}/`;
  const title = "The 64 I Ching Hexagrams and Their Meanings | I Ching Reading";
  const description =
    "All 64 hexagrams of the I Ching in the King Wen order, from 1 The Creative to 64 Before Completion, with their Chinese names, trigrams, meanings and advice.";
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "The 64 hexagrams of the I Ching",
        description,
        url,
        inLanguage: "en",
        author,
        isPartOf: website,
        mainEntity: {
          "@type": "ItemList",
          itemListElement: hexes.map((h, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: `${h.number}. ${h.name} (${h.char})`,
            url: `${SITE}${DIR}/${h.id}.html`,
          })),
        },
      },
      breadcrumb([
        ["I Ching Reading", SITE],
        ["The 64 hexagrams", url],
      ]),
    ],
  };
  const PARTS = [
    {
      name: "The Upper Canon",
      note: "Hexagrams 1 to 30, from The Creative and The Receptive to The Clinging.",
      from: 1,
      to: 30,
    },
    {
      name: "The Lower Canon",
      note: "Hexagrams 31 to 64, from Influence to Before Completion.",
      from: 31,
      to: 64,
    },
  ];
  const sections = PARTS.map((p) => {
    const list = hexes
      .filter((h) => h.number >= p.from && h.number <= p.to)
      .map(
        (h) => `
        <li><a class="hex-row" href="${h.id}.html">
          ${hexSvg(h, 40)}
          <span class="hr-text">
            <span class="hr-name">${h.number}. ${h.name}</span> <span class="hr-sub">· <span lang="zh">${h.char}</span> ${h.pinyin} · ${TRIGRAMS[h.upper].image} over ${TRIGRAMS[h.lower].image}</span>
            <span class="hr-line">${firstSentence(h.meaning)}</span>
          </span>
        </a></li>`,
      )
      .join("");
    return `
      <h3>${p.name}</h3>
      <p class="note">${p.note}</p>
      <ol class="hex-list">${list}
      </ol>`;
  }).join("\n");
  return (
    head({ title, description, url, ogType: "website", jsonld }) +
    header() +
    `
    <h2>The 64 hexagrams of the I Ching</h2>
    <div class="content about hex-page">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="../index.html">I Ching Reading</a> › The 64 hexagrams</nav>
      <p class="lede">The I Ching, or Book of Changes, has 64 hexagrams: every possible stack of six solid (yang) or broken (yin) lines. Each one pairs two of the eight trigrams, Heaven, Earth, Thunder, Water, Mountain, Wind, Fire and Lake, and stands for a situation and how it tends to change.</p>
      <p>They are listed here in the traditional King Wen order, split, as in the classic, into an upper and a lower canon. Choose a hexagram for its meaning, advice, trigrams and lines. For a personal reading, <a href="../index.html">cast a hexagram with three coins</a>; to learn where the I Ching comes from, see <a href="../about.html">about the I Ching</a>.</p>
      ${sections}
      <p><button type="button" class="interpret-btn" onclick="location.href='../index.html'">Cast a Hexagram Now</button></p>
` +
    footer()
  );
};

// ---------------------------------------------------------------- write

// Keeps datePublished from the existing file, and only bumps dateModified
// (returned, for the sitemap) when the page content changed.
const writePage = (file, html) => {
  let published = TODAY;
  let modified = TODAY;
  if (fs.existsSync(file)) {
    const old = fs.readFileSync(file, "utf8");
    const p = old.match(/"datePublished": "([\d-]+)"/);
    const m = old.match(/"dateModified": "([\d-]+)"/);
    if (p) published = p[1];
    if (m) {
      const same = html
        .replace("%DATE_PUBLISHED%", published)
        .replace("%DATE_MODIFIED%", m[1]);
      if (same === old) modified = m[1];
    }
  }
  fs.writeFileSync(
    file,
    html
      .replace("%DATE_PUBLISHED%", published)
      .replace("%DATE_MODIFIED%", modified),
  );
  return modified;
};
const writeIfChanged = (file, content) => {
  const old = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (old === content) return false;
  fs.writeFileSync(file, content);
  return true;
};

const outDir = path.join(root, DIR);
fs.mkdirSync(outDir, { recursive: true });

const titles = new Set();
const descriptions = new Set();
const lastmod = {};
hexes.forEach((h, i) => {
  const html = hexPage(h, i);
  const t = html.match(/<title>(.*?)<\/title>/)[1];
  const d = html.match(/name="description" content="(.*?)"/)[1];
  if (titles.has(t) || descriptions.has(d))
    throw new Error(`duplicate title/description for ${h.id}`);
  titles.add(t);
  descriptions.add(d);
  lastmod[`${DIR}/${h.id}.html`] = writePage(
    path.join(outDir, `${h.id}.html`),
    html,
  );
});
lastmod[`${DIR}/`] = writeIfChanged(path.join(outDir, "index.html"), hubPage())
  ? TODAY
  : null;

// sitemap: keep the old lastmod of any URL whose page did not change
const sitemapFile = path.join(root, "sitemap.xml");
const oldSitemap = fs.existsSync(sitemapFile)
  ? fs.readFileSync(sitemapFile, "utf8")
  : "";
const oldLastmod = (u) =>
  oldSitemap.match(
    new RegExp(
      `<loc>${SITE}${u.replace(/[.]/g, "\\.")}</loc>\\s*<lastmod>([\\d-]+)`,
    ),
  )?.[1];
const urls = [
  ["", "1.0"],
  [`${DIR}/`, "0.9"],
  ["about.html", "0.7"],
  ...hexes.map((h) => [`${DIR}/${h.id}.html`, "0.8"]),
];
writeIfChanged(
  sitemapFile,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ([u, p]) => `  <url>
    <loc>${SITE}${u}</loc>
    <lastmod>${lastmod[u] || oldLastmod(u) || TODAY}</lastmod>
    <priority>${p}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`,
);
writeIfChanged(
  path.join(root, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`,
);

const lens = [...descriptions].map((d) => d.length);
console.log(
  `${hexes.length} hexagram pages + hub + sitemap.xml + robots.txt; description length ${Math.min(...lens)}-${Math.max(...lens)}`,
);
