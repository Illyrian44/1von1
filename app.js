const form = document.getElementById("linkForm");
const resultsList = document.getElementById("resultsList");
const newsFeed = document.getElementById("newsFeed");
const overallHealth = document.getElementById("overallHealth");
const clearAllButton = document.getElementById("clearAll");
const generateNewsButton = document.getElementById("generateNews");

const STORAGE_KEY = "risk-analyzer-links";

const riskSignals = [
  { keyword: "free", score: 12, note: "Lock-Angebot" },
  { keyword: "login", score: 10, note: "Login-Fokus" },
  { keyword: "bonus", score: 8, note: "Bonus-Versprechen" },
  { keyword: "crypto", score: 9, note: "Krypto-Risiko" },
  { keyword: "airdrop", score: 14, note: "Airdrop" },
  { keyword: "support", score: 6, note: "Support-Imitation" },
  { keyword: "verify", score: 10, note: "Verifizieren" },
];

const marginSignals = [
  { keyword: "pricing", score: 8, note: "Preisstruktur" },
  { keyword: "shop", score: 10, note: "Commerce" },
  { keyword: "b2b", score: 7, note: "B2B-Potenzial" },
  { keyword: "pro", score: 6, note: "Premium-Angebot" },
  { keyword: "enterprise", score: 12, note: "Enterprise" },
  { keyword: "saas", score: 11, note: "SaaS" },
];

const fakeSignals = [
  { keyword: "update", score: 6, note: "Update-Scam" },
  { keyword: "gift", score: 8, note: "Geschenk" },
  { keyword: "urgent", score: 9, note: "Dringlichkeit" },
  { keyword: "claim", score: 7, note: "Claim" },
];

const tldRisk = {
  "info": 8,
  "xyz": 10,
  "top": 9,
  "shop": 4,
  "biz": 6,
  "io": 3,
  "de": 1,
  "com": 2,
  "net": 4,
};

const newsTemplates = [
  "Starkes Interesse an {domain}: neue Partnerschaften im Aufbau.",
  "Markt beobachtet {domain}, da {category} margenstärker wird.",
  "Risikoindikatoren bei {domain} sinken durch bessere Transparenz.",
  "{domain} investiert in Compliance, Fake-Risiko wird reduziert.",
  "Trendradar: {domain} könnte in {category} kurzfristig outperformen.",
];

const state = {
  entries: loadEntries(),
};

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function normalizeUrl(input) {
  try {
    const withProtocol = input.startsWith("http") ? input : `https://${input}`;
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scoreFromSignals(text, signals) {
  return signals.reduce(
    (total, signal) => (text.includes(signal.keyword) ? total + signal.score : total),
    0
  );
}

function collectNotes(text, signals) {
  return signals.filter((signal) => text.includes(signal.keyword)).map((signal) => signal.note);
}

function analyzeUrl(rawUrl, category) {
  const url = normalizeUrl(rawUrl);
  if (!url) return null;

  const host = url.hostname.replace("www.", "");
  const text = `${url.hostname}${url.pathname}`.toLowerCase();
  const tld = host.split(".").slice(-1)[0];

  let riskScore = 28;
  let marginScore = 35;
  let fakeScore = 22;
  const notes = [];

  if (url.protocol !== "https:") {
    riskScore += 10;
    fakeScore += 6;
    notes.push("Keine HTTPS-Verschlüsselung");
  }

  if (host.length > 18) {
    riskScore += 6;
    fakeScore += 4;
    notes.push("Langer Domain-Name");
  }

  if (host.split("-").length > 2) {
    riskScore += 4;
    fakeScore += 3;
    notes.push("Viele Bindestriche");
  }

  riskScore += tldRisk[tld] ?? 5;

  const riskSignalScore = scoreFromSignals(text, riskSignals);
  const marginSignalScore = scoreFromSignals(text, marginSignals);
  const fakeSignalScore = scoreFromSignals(text, fakeSignals);

  riskScore += riskSignalScore;
  marginScore += marginSignalScore;
  fakeScore += fakeSignalScore;

  const signalNotes = [
    ...collectNotes(text, riskSignals),
    ...collectNotes(text, marginSignals),
    ...collectNotes(text, fakeSignals),
  ];

  const normalizedRisk = clamp(riskScore, 5, 95);
  const normalizedMargin = clamp(marginScore - riskScore * 0.2, 5, 95);
  const normalizedFake = clamp(fakeScore, 5, 95);

  return {
    id: crypto.randomUUID(),
    url: url.toString(),
    host,
    category: category || "Allgemein",
    risk: Math.round(normalizedRisk),
    margin: Math.round(normalizedMargin),
    fake: Math.round(normalizedFake),
    notes: [...new Set([...notes, ...signalNotes])],
    createdAt: new Date().toISOString(),
  };
}

function renderEntries() {
  resultsList.innerHTML = "";
  const template = document.getElementById("resultTemplate");

  if (!state.entries.length) {
    resultsList.innerHTML =
      "<p class=\"panel__hint\">Noch keine Einträge vorhanden. Füge oben einen Link hinzu.</p>";
    overallHealth.textContent = "--";
    return;
  }

  state.entries
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((entry) => {
      const node = template.content.cloneNode(true);
      node.querySelector(".card__url").textContent = entry.url;
      node.querySelector(".card__meta").textContent = `${entry.category} · ${entry.host}`;
      node.querySelector(".metrics__value--risk").textContent = `${entry.risk}%`;
      node.querySelector(".metrics__value--margin").textContent = `${entry.margin}%`;
      node.querySelector(".metrics__value--fake").textContent = `${entry.fake}%`;

      const tagContainer = node.querySelector(".tags");
      const tags = entry.notes.length
        ? entry.notes
        : ["Keine starken Signale erkannt", "manuelle Prüfung empfohlen"];

      tags.forEach((tag) => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = tag;
        tagContainer.appendChild(span);
      });

      resultsList.appendChild(node);
    });

  const average = Math.round(
    state.entries.reduce((total, entry) => total + (100 - entry.risk), 0) / state.entries.length
  );
  overallHealth.textContent = `${average}%`;
}

function renderNews(items) {
  newsFeed.innerHTML = "";
  const template = document.getElementById("newsTemplate");

  if (!items.length) {
    newsFeed.innerHTML =
      "<p class=\"panel__hint\">Generiere eine Meldung basierend auf deinen Links.</p>";
    return;
  }

  items.forEach((item) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".news__headline").textContent = item.headline;
    node.querySelector(".news__body").textContent = item.body;
    node.querySelector(".news__meta").textContent = item.meta;
    newsFeed.appendChild(node);
  });
}

function generateNews() {
  if (!state.entries.length) {
    renderNews([
      {
        headline: "Noch keine Daten",
        body: "Füge erst einen Link hinzu, damit der Generator fokussierte Meldungen schreiben kann.",
        meta: "News-Generator",
      },
    ]);
    return;
  }

  const entry = state.entries[Math.floor(Math.random() * state.entries.length)];
  const template = newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
  const body = template
    .replace("{domain}", entry.host)
    .replace("{category}", entry.category.toLowerCase());

  const headline = `Pulse-Update: ${entry.host}`;
  const meta = `Analysezeitpunkt: ${new Date().toLocaleString("de-DE")}`;

  renderNews([{ headline, body, meta }, ...newsFeedItems().slice(0, 2)]);
}

function newsFeedItems() {
  return Array.from(newsFeed.querySelectorAll(".news__item")).map((item) => ({
    headline: item.querySelector(".news__headline").textContent,
    body: item.querySelector(".news__body").textContent,
    meta: item.querySelector(".news__meta").textContent,
  }));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const urlValue = String(formData.get("url")).trim();
  const categoryValue = String(formData.get("category")).trim();

  const entry = analyzeUrl(urlValue, categoryValue);
  if (!entry) {
    alert("Bitte eine gültige URL eingeben.");
    return;
  }

  state.entries.push(entry);
  saveEntries();
  form.reset();
  renderEntries();
  generateNews();
});

clearAllButton.addEventListener("click", () => {
  state.entries = [];
  saveEntries();
  renderEntries();
  renderNews([]);
});

generateNewsButton.addEventListener("click", generateNews);

renderEntries();
renderNews([]);
