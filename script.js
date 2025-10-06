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
  const id = s?.name || "—";
  const puuid = s?.puuid || "—";
  const [gameName, tagLine] = (id.includes("#") ? id.split("#") : [id, ""]).map(String);

  // actions: copy and op.gg
  const opggRegion = mapToOpgg($("#region").value.trim());
  const opggURL = (gameName && tagLine && opggRegion)
    ? `https://www.op.gg/summoners/${opggRegion}/${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}`
    : null;

  $("#summonerBlock").innerHTML = `
    <div><strong>${id}</strong> <span style="color:var(--gold)">★</span> Level ${nf(s?.level ?? 0)}</div>
    <div class="help"><span class="muted">PUUID:</span> <code id="puuidText">${puuid}</code></div>
    <div class="actions">
      <button class="mini" id="copyPuuid" type="button">Copy PUUID</button>
      ${opggURL ? `<a class="mini" id="opggLink" href="${opggURL}" target="_blank" rel="noopener">View on OP.GG ↗</a>` : ``}
    </div>
  `;

  on($("#copyPuuid"), "click", async () => {
    try { await navigator.clipboard.writeText(puuid); toast("PUUID copied", "ok"); }
    catch { toast("Couldn’t copy", "err"); }
  });
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
  if (window.motionAnimate && window.motionStagger) {
    window.motionAnimate("#championsBlock .champ",
      { opacity: [0, 1], transform: ["translateY(8px)", "translateY(0)"] },
      { duration: 0.45, delay: window.motionStagger(0.06), easing: "ease-out" }
    );
  }
}

function renderRanked(r) {
  const short = r?.tier ? `${r.tier?.[0] || "—"}${r?.rank || ""}` : "—";
  $("#rankShort").textContent = short;
  $("#rankLine").textContent = r?.tier ? `${r.tier} ${r.rank} • ${nf(r.wins)}W / ${nf(r.losses)}L` : "Unranked";
  $("#rankLP").textContent = r?.tier ? `${nf(r.leaguePoints)} LP` : "—";
  const pct = Math.max(0, Math.min(100, (r?.leaguePoints ?? 0) % 100));
  $("#rankBadge").style.setProperty("--p", pct);
}

function renderMatches(matches = []) {
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

// ------- KPIs (winrate, KDA, duration) -------
function renderKPIs(matches = []) {
  if (!Array.isArray(matches) || matches.length === 0) {
    $("#kpis").setAttribute("aria-hidden", "true");
    $("#kpiWinrate").textContent = "—";
    $("#kpiKDA").textContent = "—";
    $("#kpiDuration").textContent = "—";
    return;
  }
  const total = matches.length;
  const wins = matches.filter(m => m.win).length;
  const wr = Math.round((wins/total)*100);

  let k=0,d=0,a=0, dur=0;
  matches.forEach(m => { k+=m.k||0; d+=m.d||0; a+=m.a||0; dur+=m.duration||0; });
  const avgK = k/total, avgD = d/total, avgA = a/total;
  const kda = (avgD === 0) ? (avgK+avgA).toFixed(2) : ((avgK+avgA)/avgD).toFixed(2);
  const avgMin = Math.round((dur/total)/60);

  $("#kpis").removeAttribute("aria-hidden");
  $("#kpiWinrate").textContent = wr + "%";
  $("#kpiKDA").textContent = `${kda}:1`;
  $("#kpiDuration").textContent = `${avgMin}m`;
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

function mapToOpgg(region){
  // op.gg uses slightly different slugs for some regions
  const m = {
    "na1":"na", "kr":"kr", "euw1":"euw", "eun1":"eune", "br1":"br",
    "la1":"lan", "la2":"las", "jp1":"jp", "tr1":"tr", "ru":"ru",
    "oc1":"oce", "ph2":"ph", "sg2":"sg", "th2":"th", "tw2":"tw", "vn2":"vn"
  };
  return m[region] || region;
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
      renderKPIs(data.recentMatches || []);
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
      renderKPIs(data.recentMatches || []);

      if (window.motionAnimate) {
        window.motionAnimate("#results", { opacity: [0, 1], transform: ["scale(.98)", "scale(1)"] }, { duration: 0.25 });
      }
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
