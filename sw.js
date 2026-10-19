/* Elementaal op de telefoon: de service worker.
   - Alles wat het spel ophaalt, bewaart hij op de telefoon. De volgende keer komt het
     van de telefoon zelf, niet van internet.
   - Bij elke start haalt hij alleen bestanden.json op: een lijstje met van elk bestand
     een vingerafdruk. Is een vingerafdruk veranderd (jij hebt iets nieuws geüpload),
     dan gooit hij alleen díé bestanden weg en haalt ze opnieuw. De rest blijft staan.
   - Een tekening art/x.png wordt op de telefoon art-tel/x.webp: dezelfde tekening, maar
     op schermmaat en zo'n tien keer kleiner. Die maakt GitHub zelf bij elke upload
     (zie .github/workflows/telefoon.yml).
   - Muziek en filmpjes bewaart hij ook. Die vraagt de browser in stukjes op (Range); dat
     stukje knipt hij dan uit het bewaarde bestand. */
const CACHE = "elementaal-tel";
const BASIS = new URL("./", self.location).pathname;
let LIJST = null, BEZIG = null;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

async function lijstOphalen(){
  const cache = await caches.open(CACHE);
  try{
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(BASIS + "bestanden.json", {cache:"no-store", signal:ctrl.signal});
    clearTimeout(t);
    if(!r.ok) throw new Error("geen lijst");
    const nieuw = await r.json();
    const oudR = await cache.match(BASIS + "__lijst");
    const oud = oudR ? await oudR.json() : {};
    for(const req of await cache.keys()){
      const pad = decodeURIComponent(new URL(req.url).pathname.slice(BASIS.length));
      if(pad === "__lijst") continue;
      if(!nieuw[pad] || nieuw[pad] !== oud[pad]) await cache.delete(req);   // veranderd of weg
    }
    await cache.put(BASIS + "__lijst", new Response(JSON.stringify(nieuw)));
    LIJST = nieuw;
  }catch(e){
    /* geen internet: dan geldt de lijst van de vorige keer */
    if(!LIJST){ const r = await cache.match(BASIS + "__lijst"); LIJST = r ? await r.json() : {}; }
  }
  return LIJST;
}
function lijst(vers){
  if(vers || !BEZIG) BEZIG = lijstOphalen();
  return BEZIG;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const u = new URL(req.url);
  if(u.origin !== self.location.origin || !u.pathname.startsWith(BASIS)) return;
  let pad = decodeURIComponent(u.pathname.slice(BASIS.length));
  const start = req.mode === "navigate";
  if(start) pad = "index.html";
  if(pad === "bestanden.json" || pad === "sw.js") return;
  e.respondWith(antwoord(req, pad, start));
});

async function antwoord(req, pad, start){
  const L = await lijst(start);
  const m = pad.match(/^art\/([^/]+)\.(png|jpe?g)$/i);
  let doel = pad;
  if(m && L["art-tel/" + m[1] + ".webp"]) doel = "art-tel/" + m[1] + ".webp";
  if(!(doel in L)) return fetch(req);
  const cache = await caches.open(CACHE);
  const sleutel = BASIS + doel;
  const stuk = req.headers.get("range");
  let hit = await cache.match(sleutel);
  if(hit) return stuk ? knip(hit, stuk) : hit;
  try{
    const r = await fetch(sleutel, {cache:"no-cache"});
    if(r.ok && r.status === 200){ await cache.put(sleutel, r.clone()); }
    return stuk && r.ok ? knip(r, stuk) : r;
  }catch(e){
    return start ? new Response("Geen internet, en het spel staat nog niet op deze telefoon.", {status:503, headers:{"content-type":"text/plain; charset=utf-8"}}) : Response.error();
  }
}

/* Een stukje (bytes=van-tot) uit een heel bestand, zoals een muziekspeler het vraagt. */
async function knip(resp, stuk){
  const buf = await resp.arrayBuffer(), n = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(stuk) || [];
  let van = m[1] ? +m[1] : 0, tot = m[2] ? +m[2] : n - 1;
  if(!m[1] && m[2]){ van = Math.max(0, n - +m[2]); tot = n - 1; }
  tot = Math.min(tot, n - 1);
  if(van > tot) return new Response(null, {status:416, headers:{"Content-Range":`bytes */${n}`}});
  return new Response(buf.slice(van, tot + 1), {status:206, headers:{
    "Content-Type": resp.headers.get("content-type") || "application/octet-stream",
    "Content-Range": `bytes ${van}-${tot}/${n}`, "Content-Length": String(tot - van + 1), "Accept-Ranges": "bytes"}});
}
