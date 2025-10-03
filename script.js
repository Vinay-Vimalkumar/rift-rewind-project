// === configuration (your deployed Lambda Function URL) ===
const LAMBDA_URL =
  (window && window.__RIOT_API_URL__) ||
  "https://anbqqriwd2ysbwxyquqspqg7ee0xwrcp.lambda-url.us-east-1.on.aws/";

// --- helpers ---
const $ = (q) => document.querySelector(q);

function setStatus(el, msg, kind = "muted") {
  el.textContent = msg || "";
  el.classList.remove("ok", "err");
  if (kind === "ok") el.classList.add("ok");
  if (kind === "err") el.classList.add("err");
}

function fmtNumber(n) {
  try { return Number(n).toLocaleString(); } catch { return n; }
}

// Map a few popular champion IDs (optional; extend as you wish)
const CHAMP_NAMES = {
  7: "LeBlanc",
  268: "Azir",
  517: "Sylas",
  // add more if desired
};

// --- Riot Lookup form ---
const lookupForm = $("#lookupForm");
const lookupBtn = $("#lookupBtn");
const lookupStatus = $("#lookupStatus");
const results = $("#results");
const summonerBlock = $("#summonerBlock");
const championsBlock = $("#championsBlock");

lookupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const summonerName = $("#summonerName").value.trim();
  const region = $("#region").value.trim();

  if (!summonerName || !/#/.test(summonerName)) {
    setStatus(lookupStatus, "Please enter Riot ID as GameName#TAG", "err");
    return;
  }

  lookupBtn.disabled = true;
  setStatus(lookupStatus, "Fetching…");

  try {
    const res = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summonerName, region }),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }

    if (!res.ok) {
      const msg = data?.error || `Request failed: ${res.status}`;
      setStatus(lookupStatus, msg, "err");
      results.hidden = true;
      return;
    }

    // success
    setStatus(lookupStatus, "Success!", "ok");
    const { summoner, topChampions = [] } = data;

    // render
    summonerBlock.innerHTML = `
      <div>Name: <strong>${summoner?.name || "—"}</strong></div>
      <div>Level: <strong>${fmtNumber(summoner?.level ?? "—")}</strong></div>
      <div><span class="muted">PUUID:</span> <code>${summoner?.puuid || "—"}</code></div>
    `;

    if (!Array.isArray(topChampions) || topChampions.length === 0) {
      championsBlock.textContent = "No mastery data.";
    } else {
      championsBlock.innerHTML = topChampions
        .slice(0, 3)
        .map((c) => {
          const name = CHAMP_NAMES[c.championId] || `Champion ${c.championId}`;
          return `
            <div class="card" style="padding:10px;border-radius:12px;background:rgba(10,15,25,.45);border:1px solid rgba(148,163,184,.12)">
              <div><strong>${name}</strong> (ID: ${c.championId})</div>
              <div>Mastery Level: ${fmtNumber(c.championLevel)}</div>
              <div>Points: ${fmtNumber(c.championPoints)}</div>
            </div>
          `;
        })
        .join("");
    }

    results.hidden = false;
  } catch (err) {
    setStatus(lookupStatus, `Network error: ${err?.message || err}`, "err");
    results.hidden = true;
  } finally {
    lookupBtn.disabled = false;
  }
});

// --- Contact/Demo form (optional; shows POST to same endpoint) ---
const contactForm = $("#contactForm");
const contactBtn = $("#contactBtn");
const contactStatus = $("#contactStatus");

contactForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  contactBtn.disabled = true;
  setStatus(contactStatus, "Sending…");

  const name = $("#contactName").value.trim();
  const message = $("#contactMsg").value.trim();

  try {
    // This hits the same Lambda URL for demo; your backend can branch on payload shape if needed.
    const res = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message, kind: "contact" }),
    });

    if (!res.ok) {
      const txt = await res.text();
      setStatus(contactStatus, `Failed: ${res.status} ${txt || ""}`, "err");
      return;
    }
    setStatus(contactStatus, "Message sent (demo)!", "ok");
  } catch (err) {
    setStatus(contactStatus, `Network error: ${err?.message || err}`, "err");
  } finally {
    contactBtn.disabled = false;
  }
});
