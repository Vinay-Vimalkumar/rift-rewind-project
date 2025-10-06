// ------- config -------
const LAMBDA_URL = window.__RIOT_API_URL__;

// ------- dom helpers -------
const $ = (q) => document.querySelector(q);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const nf = (n) => (Number.isFinite(+n) ? Number(n).toLocaleString() : n);

function setStatus(msg, kind = "") {
  const el = $("#lookupStatus");
  el.textContent = msg || "";
  el.classList.toggle("ok", kind === "ok");
  el.classList.toggle("err", kind === "err");
}

function toast(msg, kind = "ok") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast ${kind}`;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2200);
}

// ------- Data Dragon (champ name+icon) -------
let ddVersion = "14.19.1"; // fallback
const champByKey = {}; // { "268": {id:"Azir", name:"Azir"} }

async function loadChampions() {
  try {
    const vers = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then(r => r.json());
    ddVersion = vers?.[0] || ddVersion;
    const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/champion.json`).then(r => r.json());
    Object.values(data.data).forEach(c => (champByKey[c.key] = { id: c.id, name: c.name }));
  } catch (e) {
    console.warn("DDragon load failed; using basic names", e);
  }
}

// ------- UI: Pro presets -------
const PRESETS = [
  { label: "Faker", id: "Hide on bush#KR1", region: "kr" },
  { label: "Chovy", id: "Chovy#KR1", region: "kr" },
  { label: "Ruler", id: "Ruler#KR1", region: "kr" },
];
function renderPresets() {
  const bar = $("#presetBar");
  bar.innerHTML = PRESETS.map(p => `<button type="button" class="chip" data-id="${p.id}" data-region="${p.region}">${p.label}</button>`).join("");
  bar.querySelectorAll(".chip").forEach(chip =>
    chip.addEventListener("click", () => {
      $("#summonerName").value = chip.dataset.id;
      $("#region").value = chip.dataset.region;
      setStatus(`Loaded preset: ${chip.textContent}`);
    })
  );
}

// ------- renderers -------
function renderSummoner(s) {
  $("#summonerBlock").innerHTML = `
    <div><strong>${s?.name ?? "—"}</strong> <span style="color:var(--gold)">★</span> Level ${nf(s?.level ?? 0)}</div>
    <div class="help"><span class="muted">PUUID:</span> <code>${s?.puuid ?? "—"}</code></div>
  `;
}

function progressHTML(pointsSince, pointsUntil) {
  // Some champs at max level return negative "until next". Clamp to 100% and label.
  let pct = 0, label = "";
  if (typeof pointsSince === "number" && typeof pointsUntil === "number") {
    const total = Math.max(pointsSince + pointsUntil, 1);
    pct = Math.max(0, Math.min(100, Math.round((pointsSince / total) * 100)));
    if (pointsUntil < 0) { pct = 100; label = "Max level"; }
  }
  return `
    <div class="bar" title="${label || pct + '%'}"><i style="width:${pct}%"></i></div>
    <small>${label || `${nf(pointsSince)} / ${nf(pointsSince + pointsUntil)} pts to next`}</small>
  `;
}

function renderChamps(arr = []) {
  const grid = $("#championsBlock");
  if (!arr.length) {
    grid.innerHTML = `<div class="help">No mastery data.</div>`;
    return;
  }
  const cards = arr.slice(0, 3).map(c => {
    const info = champByKey[String(c.championId)] || {};
    const img = info.id
      ? `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${info.id}.png`
      : `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/Aatrox.png`;
    const name = info.name || `Champion ${c.championId}`;
    return `
      <div class="champ">
        <img src="${img}" alt="${name} icon" loading="lazy"/>
        <div>
          <div class="name">${name}</div>
          <small>Mastery ${nf(c.championLevel)} • ${nf(c.championPoints)} pts</small>
          ${progressHTML(c.championPointsSinceLastLevel, c.championPointsUntilNextLevel)}
        </div>
      </div>
    `;
  }).join("");
  grid.innerHTML = cards;
}

// ------- fetch flow -------
async function fetchMastery(summonerName, region) {
  const res = await fetch(LAMBDA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summonerName, region }),
  });

  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: text }; }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  return data;
}

function showSkeletons(show) {
  $("#skeletons").hidden = !show;
  $("#results").hidden = show;
}

// ------- wire up -------
async function init() {
  renderPresets();
  loadChampions().catch(()=>{});

  on($("#lookupForm"), "submit", async (e) => {
    e.preventDefault();
    const summonerName = $("#summonerName").value.trim();
    const region = $("#region").value.trim();

    if (!summonerName || !/#/.test(summonerName)) {
      setStatus("Use Riot ID format: GameName#TAG", "err");
      toast("Enter a valid Riot ID", "err");
      return;
    }

    $("#lookupBtn").disabled = true;
    setStatus("Fetching…");
    showSkeletons(true);

    try {
      const data = await fetchMastery(summonerName, region);
      setStatus("Success!", "ok");
      renderSummoner(data.summoner);
      renderChamps(data.topChampions || []);
      $("#results").hidden = false;
      toast("Fetched mastery ✔", "ok");
    } catch (err) {
      setStatus(String(err.message || err), "err");
      toast("Error: " + (err.message || err), "err");
    } finally {
      $("#lookupBtn").disabled = false;
      showSkeletons(false);
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
