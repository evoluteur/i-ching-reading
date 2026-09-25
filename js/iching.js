// I Ching Reading app logic — hexagram data lives in js/iching-data.js

// Three-coin method: each coin lands heads (3) or tails (2); the three
// coins add up to one line, cast from the bottom of the hexagram upward.
//   6 = old yin (broken, changing)   7 = young yang (solid)
//   8 = young yin (broken)           9 = old yang (solid, changing)
const LINE_TYPES = {
  6: { label: "Old yin", solid: false, changing: true },
  7: { label: "Young yang", solid: true, changing: false },
  8: { label: "Young yin", solid: false, changing: false },
  9: { label: "Old yang", solid: true, changing: true },
};

const READING_STORAGE_KEY = "iching-active-reading";
const TOSS_MS = 900;

let cast = []; // one { coins: [2|3, 2|3, 2|3], value: 6..9 } per line, bottom to top
let tossing = false;
let tossAllTimer = null; // Toss All: adds the remaining lines one by one
const TOSS_ALL_DELAY_MS = 400;
let interpretMode = false;
let activeDetail = null; // "primary" | "relating" | null

const isComplete = () => cast.length === 6;

const lineSpecs = (kind) =>
  cast.map(({ value }) => {
    const t = LINE_TYPES[value];
    // In the resulting hexagram every changing line has flipped.
    const solid = kind === "relating" && t.changing ? !t.solid : t.solid;
    return { solid, changing: kind === "primary" && t.changing };
  });

const hexagramOf = (kind) => {
  if (!isComplete()) return null;
  return hexagramFromLines(lineSpecs(kind).map((l) => (l.solid ? 1 : 0)));
};

const changingIndexes = () =>
  cast.map((l, i) => (LINE_TYPES[l.value].changing ? i : -1)).filter((i) => i >= 0);

// ---------------------------------------------------------------- drawing

// A hexagram as SVG. `specs` is bottom-to-top; missing lines (still to be
// cast) draw as faint placeholders. Changing lines are marked with a ring
// (old yang) or a cross (old yin) beside the line.
const hexagramSvg = (specs, { size = 100, newest = -1, rowCount = 6 } = {}) => {
  const W = 130;
  const H = (rowCount - 1) * 18 + 10;
  const rows = [];
  for (let i = rowCount - 1; i >= 0; i--) {
    const y = (rowCount - 1 - i) * 18;
    const spec = specs[i];
    if (!spec) {
      rows.push(
        `<rect class="hx-line hx-empty" x="0" y="${y}" width="100" height="10" rx="2" />`,
      );
      continue;
    }
    const cls = `hx-line${spec.changing ? " hx-changing" : ""}${i === newest ? " hx-new" : ""}`;
    const bars = spec.solid
      ? `<rect x="0" y="${y}" width="100" height="10" rx="2" />`
      : `<rect x="0" y="${y}" width="42" height="10" rx="2" /><rect x="58" y="${y}" width="42" height="10" rx="2" />`;
    let mark = "";
    if (spec.changing) {
      mark = spec.solid
        ? `<circle class="hx-mark" cx="115" cy="${y + 5}" r="5" fill="none" stroke-width="2" />`
        : `<path class="hx-mark" d="M110 ${y}l10 10M120 ${y}l-10 10" stroke-width="2" fill="none" />`;
    }
    rows.push(`<g class="${cls}">${bars}${mark}</g>`);
  }
  const w = Math.round((size * W) / H);
  return `<svg class="hexagram-svg" viewBox="0 0 ${W} ${H}" style="width:${w}px;height:${size}px" role="img" aria-label="Hexagram">${rows.join("")}</svg>`;
};

const coinMarkup = (face, spinning) =>
  `<div class="coin${spinning ? " spinning" : ""}${face ? ` face-${face}` : ""}"><span>${face || ""}</span></div>`;

const lineSumText = (l) => `${l.coins.join(" + ")} = ${l.value}`;

// ---------------------------------------------------------------- casting

const renderCastArea = () => {
  const elem = document.getElementById("cast-area");
  if (!elem) return;
  if (isComplete()) {
    elem.innerHTML = "";
    elem.style.display = "none";
    return;
  }
  elem.style.display = "";
  const last = cast[cast.length - 1];
  const faces = tossing ? [0, 0, 0] : last ? last.coins : [0, 0, 0];
  const nextLine = cast.length + 1;
  elem.innerHTML = `
    <div class="coins">${faces.map((f) => coinMarkup(f, tossing)).join("")}</div>
    <div class="cast-controls">
      <div class="cast-progress">Line ${nextLine} of 6${nextLine === 1 ? " · the bottom line" : ""}</div>
      <div class="toss-buttons">
        <button type="button" class="toss-btn" onclick="tossCoinsClick()"${tossing || tossAllTimer ? " disabled" : ""}>
          ${cast.length === 0 ? "Toss Coins" : "Toss for Next Line"}
        </button>
        ${
          6 - cast.length > 1
            ? `<button type="button" class="toss-btn secondary" onclick="tossAllClick()"${tossing || tossAllTimer ? " disabled" : ""}>Toss All</button>`
            : ""
        }
      </div>
    </div>`;
};

const renderTossLog = () => {
  const elem = document.getElementById("toss-log");
  if (!elem) return;
  if (!cast.length) {
    elem.innerHTML = "";
    return;
  }
  elem.innerHTML = cast
    .map((l, i) => {
      const t = LINE_TYPES[l.value];
      return `<div class="toss-row${t.changing ? " changing" : ""}"><span class="toss-n">Line ${i + 1}</span><span>${lineSumText(l)}</span><span class="toss-type">${t.label}${t.changing ? " (changing)" : ""}</span></div>`;
    })
    .join("");
};

const hexTileMarkup = (kind, extraClass = "") => {
  const hex = hexagramOf(kind);
  const specs = lineSpecs(kind);
  const role = kind === "primary" ? "Your hexagram" : "Becoming";
  const figure = hexagramSvg(specs, {
    size: 110,
    newest: !isComplete() ? cast.length - 1 : -1,
  });
  if (!hex) {
    return `
      <div class="hex-card pending ${extraClass}">
        <div class="hex-figure">${figure}</div>
        <div class="hex-info">
          <div class="hex-role">${role}</div>
          <div class="hex-name">${
            cast.length ? `${cast.length} of 6 lines cast` : "Cast six lines"
          }</div>
        </div>
      </div>`;
  }
  return `
    <div class="hex-card ${extraClass}" data-kind="${kind}" onclick="showHexagramDetail('${kind}')">
      <div class="hex-figure">${figure}</div>
      <div class="hex-info">
        <div class="hex-role">${role}</div>
        <div class="hex-name">${hex.number}. ${hex.name}</div>
        <div class="hex-sub">${hex.char} · ${hex.pinyin}</div>
        <div class="keywords">${hex.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>
        <p class="hex-line">${hex.meaning}</p>
      </div>
    </div>`;
};

const renderBoard = () => {
  const elem = document.getElementById("hexagram-board");
  if (!elem) return;
  const hasRelating = isComplete() && changingIndexes().length > 0;
  elem.innerHTML =
    hexTileMarkup("primary") +
    (hasRelating
      ? `<div class="hex-arrow" aria-hidden="true">→</div>` + hexTileMarkup("relating")
      : "");
  const isNote = isComplete() && !hasRelating;
  const note = document.getElementById("stable-note");
  if (note) {
    note.textContent = isNote
      ? "No changing lines: the situation is stable, so the reading is this hexagram alone."
      : "";
  }
  elem.classList.toggle("hidden", interpretMode);
};

const renderInterpretBar = () => {
  const elem = document.getElementById("interpret-bar");
  if (!elem) return;
  if (!cast.length) {
    elem.innerHTML = "";
    return;
  }
  elem.innerHTML = `
    ${
      isComplete()
        ? `<button type="button" class="interpret-btn" onclick="toggleInterpretation()">${
            interpretMode ? "Back to Reading" : "Interpret Reading"
          }</button>`
        : ""
    }
    <button type="button" class="interpret-btn" onclick="newReading()">New Reading</button>`;
};

const renderAll = () => {
  renderCastArea();
  renderTossLog();
  renderBoard();
  renderInterpretBar();
};

const tossCoinsClick = () => {
  if (tossing || tossAllTimer || isComplete()) return;
  tossing = true;
  closeDetail();
  renderCastArea();

  setTimeout(() => {
    const coins = [0, 1, 2].map(() => (Math.random() < 0.5 ? 2 : 3));
    cast.push({ coins, value: coins[0] + coins[1] + coins[2] });
    tossing = false;
    saveReading();
    if (isComplete()) {
      renderAll();
    } else {
      renderCastArea();
      renderTossLog();
      renderBoard();
      renderInterpretBar();
    }
  }, TOSS_MS);
};

// Tosses the remaining lines one by one, 400ms apart (like "Draw All" in
// Rune Reading): each toss shows its coins and joins the log.
const stopTossAll = () => {
  if (tossAllTimer) clearTimeout(tossAllTimer);
  tossAllTimer = null;
};
const tossAllClick = () => {
  if (tossing || tossAllTimer || isComplete()) return;
  closeDetail();
  const step = () => {
    const coins = [0, 1, 2].map(() => (Math.random() < 0.5 ? 2 : 3));
    cast.push({ coins, value: coins[0] + coins[1] + coins[2] });
    saveReading();
    if (isComplete()) {
      tossAllTimer = null;
      renderAll();
    } else {
      tossAllTimer = setTimeout(step, TOSS_ALL_DELAY_MS);
      renderAll();
    }
  };
  step();
};

const newReading = () => {
  stopTossAll();
  cast = [];
  tossing = false;
  interpretMode = false;
  activeDetail = null;
  closeDetail();
  document.getElementById("interpretation-view")?.classList.remove("open");
  saveReading();
  renderAll();
};

// ---------------------------------------------------------------- persistence

const saveReading = () => {
  try {
    if (!cast.length) localStorage.removeItem(READING_STORAGE_KEY);
    else localStorage.setItem(READING_STORAGE_KEY, JSON.stringify(cast));
  } catch {
    // storage unavailable -- not worth failing the reading over
  }
};

const restoreReading = () => {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(READING_STORAGE_KEY) || "null");
  } catch {
    raw = null;
  }
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 6) return;
  const ok = raw.every(
    (l) =>
      Array.isArray(l.coins) &&
      l.coins.length === 3 &&
      l.coins.every((c) => c === 2 || c === 3) &&
      l.value === l.coins[0] + l.coins[1] + l.coins[2],
  );
  if (ok) cast = raw;
};

// ---------------------------------------------------------------- interpretation

const hexInterpretTile = (kind) => {
  const hex = hexagramOf(kind);
  if (!hex) return "";
  return `<div class="interpret-row">${hexTileMarkup(kind, "in-interpretation")}</div>`;
};

const renderInterpretation = () => {
  const elem = document.getElementById("interpretation-view");
  if (!elem) return;
  const changing = changingIndexes();

  const changingHtml = changing.length
    ? `<div class="interpret-row">${changing
        .map((i) => {
          const l = cast[i];
          const pos = LINE_POSITIONS[i];
          return `
          <div class="hex-card line-card">
            <div class="hex-figure">${hexagramSvg(
              [{ solid: LINE_TYPES[l.value].solid, changing: true }],
              { size: 10, rowCount: 1 },
            )}</div>
            <div class="hex-info">
              <div class="hex-role">${pos.name} · ${LINE_TYPES[l.value].label}</div>
              <div class="hex-name">${pos.theme}</div>
              <p class="hex-line">${pos.text}</p>
            </div>
          </div>`;
        })
        .join("")}</div>
      <p class="interpret-note">A changing line is a place where the situation is in motion. Read the moving lines for where it is turning, then the second hexagram for where it is heading.</p>`
    : `<p class="interpret-note">No lines are changing, so this is a stable situation. There is no second hexagram: the first one is the whole reading.</p>`;

  elem.innerHTML = `
    <div class="interpret-section">
      <h3>The Situation</h3>
      ${hexInterpretTile("primary")}
    </div>
    <div class="interpret-section">
      <h3>What Is Changing</h3>
      ${changingHtml}
    </div>
    ${
      changing.length
        ? `<div class="interpret-section">
            <h3>Where It Is Heading</h3>
            ${hexInterpretTile("relating")}
          </div>`
        : ""
    }
    <p class="interpret-credit">${CREDIT_HTML}</p>`;
};

const toggleInterpretation = () => {
  if (!isComplete()) return;
  const view = document.getElementById("interpretation-view");
  if (!view) return;
  closeDetail();
  interpretMode = !interpretMode;
  if (interpretMode) {
    renderInterpretation();
    view.classList.add("open");
  } else {
    view.classList.remove("open");
  }
  renderBoard();
  renderInterpretBar();
};

// ---------------------------------------------------------------- detail panel

const CREDIT_HTML =
  "Hexagram names and trigram structure follow the traditional King Wen sequence. Summaries and advice were written for this app.";

const trigramText = (key) => `${TRIGRAMS[key].char} ${TRIGRAMS[key].image} (${TRIGRAMS[key].name})`;

const hexagramDetailMarkup = (kind) => {
  const hex = hexagramOf(kind);
  if (!hex) return "";
  const changing = changingIndexes();
  const changingHtml =
    kind === "primary" && changing.length
      ? `<h4>Changing lines</h4>
         <ul>${changing
           .map((i) => {
             const l = cast[i];
             const pos = LINE_POSITIONS[i];
             return `<li><strong>${pos.name}</strong> (${LINE_TYPES[l.value].label}): ${pos.theme.toLowerCase()}. ${pos.text}</li>`;
           })
           .join("")}</ul>`
      : "";
  return `
    <button type="button" class="detail-close" onclick="closeDetail()" aria-label="Close">&times;</button>
    <div class="detail-header">
      <div class="hex-figure">${hexagramSvg(lineSpecs(kind), { size: 110 })}</div>
      <div>
        <h3>${hex.number}. ${hex.name}</h3>
        <div class="detail-position">${hex.char} · ${hex.pinyin} · ${kind === "primary" ? "Your hexagram" : "Becoming"}</div>
        <div class="keywords">${hex.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>
      </div>
    </div>
    <h4>Trigrams</h4>
    <p class="position-meaning">${trigramText(hex.upper)} above<br />${trigramText(hex.lower)} below</p>
    <h4>Meaning</h4>
    <p class="position-meaning">${hex.meaning}</p>
    <h4>Advice</h4>
    <p class="fortune">${hex.advice}</p>
    ${changingHtml}
    <p class="detail-credit">${CREDIT_HTML}</p>`;
};

const showHexagramDetail = (kind) => {
  const panel = document.getElementById("card-detail");
  if (!panel) return;
  activeDetail = kind;
  panel.innerHTML = hexagramDetailMarkup(kind);
  document
    .querySelectorAll(".hex-card.active")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(`.hex-card[data-kind="${kind}"]`)
    .forEach((el) => el.classList.add("active"));
  document.getElementById("card-detail")?.classList.add("open");
  document.getElementById("detail-overlay")?.classList.add("open");
};

const closeDetail = () => {
  document.getElementById("card-detail")?.classList.remove("open");
  document.getElementById("detail-overlay")?.classList.remove("open");
  activeDetail = null;
  document
    .querySelectorAll(".hex-card.active")
    .forEach((el) => el.classList.remove("active"));
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetail();
});

// Any click outside a hexagram card or the panel dismisses the panel.
document.addEventListener("click", (e) => {
  if (!document.getElementById("card-detail")?.classList.contains("open"))
    return;
  if (e.target.closest(".hex-card") || e.target.closest(".card-detail")) return;
  closeDetail();
});

// ---------------------------------------------------------------- init

const initIChing = () => {
  restoreReading();
  renderAll();
};
