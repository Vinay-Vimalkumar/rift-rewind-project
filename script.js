// ------- config -------
const LAMBDA_URL = window.__RIOT_API_URL__;

// ------- dom helpers -------
const $ = (q) => document.querySelector(q);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const nf = (n) => (Number.isFinite(+n) ? Number(n).toLocaleString() : n);
const ago = (ms) => {
  const d = Math.floor((Date.now() - ms) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
};

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
const champByKey = {}; // key -> { id, name }

async function loadChampions() {
  try {
    const vers = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then(r => r.json());
    ddVersion = vers?.[0] || ddVersion;
    const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/data/en_US/champion.json`).then(r => r.json());
    Object.values(data.data).forEach(c => (champByKey[c.key] = { id: c.id, name: c.name }));
  } catch (e) {
    console.warn("DDragon load failed, using fallback names");
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

function champCard(c) {
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
}

function renderChamps(list = []) {
  $("#championsBlock").innerHTML = list.slice(0,3).map(champCard).join("") || `<div class="help">No mastery data.</div>`;
}

function renderRanked(r) {
  // r example: { tier: "CHALLENGER", rank: "I", leaguePoints: 600, wins: 100, losses: 50 }
  const short = r?.tier ? `${r.tier?.[0] || "—"}${r?.rank || ""}` : "—";
  $("#rankShort").textContent = short;
  $("#rankLine").textContent = r?.tier ? `${r.tier} ${r.rank} • ${nf(r.wins)}W / ${nf(r.losses)}L` : "Unranked";
  $("#rankLP").textContent = r?.tier ? `${nf(r.leaguePoints)} LP` : "—";
  // badge progress: quick heuristic from LP (0-100)
  const pct = Math.max(0, Math.min(100, (r?.leaguePoints ?? 0) % 100));
  $("#rankBadge").style.setProperty("--p", pct);
}

function renderMatches(matches = []) {
  // matches: [{queue, championId, k, d, a, win, duration, ts}]
  $("#matchList").innerHTML = matches.slice(0,5).map(m => {
    const info = champByKey[String(m.championId)] || {};
    const name = info.name || `Champ ${m.championId}`;
    const kda = `${m.k}/${m.d}/${m.a}`;
    const outcome = m.win ? "W" : "L";
    const dur = `${Math.round((m.duration || 0)/60)}m`;
    return `<div class="chip" title="${new Date(m.ts).toLocaleString()}">${outcome} • ${name} • ${kda} • ${dur} • ${ago(m.ts)}</div>`;
  }).join("") || `<div class="help">No recent matches.</div>`;
}

function renderMasteryBreakdown(list = []) {
  const total = list.reduce((s,c)=>s + (c.championPoints||0), 0) || 1;
  $("#masteryBreak").innerHTML = list.slice(0,3).map(c=>{
    const info = champByKey[String(c.championId)] || {};
    const name = info.name || `Champion ${c.championId}`;
    const pct = Math.round((c.championPoints/total)*100);
    return `<div class="chip">${name}: ${nf(c.championPoints)} pts (${pct}%)</div>`;
  }).join("");
}

function renderActivity(list = []) {
  $("#activity").innerHTML = list.slice(0,3).map(c=>{
    const info = champByKey[String(c.championId)] || {};
    const name = info.name || `Champion ${c.championId}`;
    const when = c.lastPlayTime ? new Date(c.lastPlayTime).toLocaleString() : "—";
    return `<div class="chip">${name} • last played ${when}</div>`;
  }).join("") || `<div class="help">No activity found.</div>`;
}

// ------- fetch flow -------
async function fetchInsights(summonerName, region, opts = {}) {
  const payload = { summonerName, region, matchesCount: opts.matchesCount || 5 };
  const res = await fetch(LAMBDA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
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

  on($("#moreBtn"), "click", async () => {
    const summonerName = $("#summonerName").value.trim();
    const region = $("#region").value.trim();
    if (!summonerName || !/#/.test(summonerName)) return toast("Enter a Riot ID first", "err");

    $("#moreBtn").disabled = true;
    try {
      const data = await fetchInsights(summonerName, region, { matchesCount: 10 });
      renderMatches(data.recentMatches || []);
      toast("Loaded more matches", "ok");
    } catch(e) {
      toast("Couldn’t load more matches", "err");
    } finally {
      $("#moreBtn").disabled = false;
    }
  });

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
      const data = await fetchInsights(summonerName, region, { matchesCount: 5 });
      setStatus("Success!", "ok");
      $("#results").hidden = false;

      renderSummoner(data.summoner);
      renderChamps(data.topChampions || []);
      renderMasteryBreakdown(data.topChampions || []);
      renderActivity(data.topChampions || []);
      renderRanked(data.rankedSolo || null);
      renderMatches(data.recentMatches || []);

      toast("Insights updated ✔", "ok");
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
