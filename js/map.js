// Mappa: MapLibre + PMTiles. Dipende da style.js (caricato prima).

const PMTILES_URL = new URL('data/interventi_oopp_2026_2028.pmtiles', location.href).href;
const BOUNDS = [[13.27199, 38.065508], [13.445067, 38.223314]];
const LARGHEZZA_PANNELLO = 406; // pannello destro + maniglia

// Token pubblico Mapbox (pk.), lo stesso del Digital Twin: visibile nel client per natura, limitato agli URL dal pannello Mapbox.
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZ2J2aXRyYW5vIiwiYSI6ImNtdmdoY2YzZzAxeTkyeXF1NnBhczZvZWQifQ.EAOHORsNWVO6xD7SJm0NLw';
const RETINA = (globalThis.devicePixelRatio ?? 1) >= 2 ? '@2x' : '';
const mapboxTiles = (stile) => [`https://api.mapbox.com/styles/v1/${stile}/tiles/512/{z}/{x}/{y}${RETINA}?access_token=${MAPBOX_TOKEN}`];
const ATTR_MAPBOX = [['© Mapbox', 'https://www.mapbox.com/about/maps/'], ['© OpenStreetMap', 'https://www.openstreetmap.org/copyright']];

const BASEMAPS = {
  chiara: { tiles: mapboxTiles('gbvitrano/cjlbh2rbg5fxr2so5fzjudqvi'), attr: ATTR_MAPBOX },
  scura: { tiles: mapboxTiles('mapbox/dark-v11'), attr: ATTR_MAPBOX },
  satellite: { tiles: mapboxTiles('mapbox/satellite-streets-v12'), attr: [...ATTR_MAPBOX, ['© Maxar', 'https://www.maxar.com/']] },
};
const BASEMAP_INIZIALE = 'chiara';

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

const stile = {
  version: 8,
  sources: {
    ...Object.fromEntries(Object.entries(BASEMAPS).map(([k, b]) => [`basemap-${k}`, { type: 'raster', tiles: b.tiles, tileSize: 512, maxzoom: 22 }])),
    [SOURCE_ID]: { type: 'vector', url: `pmtiles://${PMTILES_URL}` },
  },
  layers: Object.keys(BASEMAPS).map((k) => ({
    id: `basemap-${k}-layer`, type: 'raster', source: `basemap-${k}`,
    layout: { visibility: k === BASEMAP_INIZIALE ? 'visible' : 'none' },
  })),
};

// I tile partono da z11: sotto non c'è nulla da mostrare
const ZOOM_MIN_DATI = 11;
const pannelloAperto = () => document.getElementById('rp-wrap')?.classList.contains('open');
const paddingMappa = (base = 0) => ({ top: base, bottom: base, left: base, right: pannelloAperto() && innerWidth >= 640 ? LARGHEZZA_PANNELLO + base : base });

const map = new maplibregl.Map({
  container: 'map',
  style: stile,
  bounds: BOUNDS,
  fitBoundsOptions: { padding: { top: 30, bottom: 30, left: 70, right: innerWidth >= 640 ? LARGHEZZA_PANNELLO + 30 : 30 } },
  maxBounds: [[13.1, 37.95], [13.6, 38.35]],
  minZoom: 10,
  maxZoom: 20,
  attributionControl: false,
});
// Niente rotazione né beccheggio: mappa sempre a nord, vista dall'alto
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();
map.keyboard.disableRotation();
map.touchPitch.disable();

// Slider zoom verticale, sincronizzato con la mappa
const zoomRange = document.getElementById('zoom-range');
const zoomVal = document.getElementById('zoom-val');
function aggiornaSliderZoom() {
  const z = map.getZoom();
  zoomRange.value = z;
  zoomVal.textContent = Math.round(z);
  zoomRange.style.setProperty('--fill', `${((z - 10) / 10) * 100}%`);
}
zoomRange.addEventListener('input', () => map.setZoom(+zoomRange.value));
map.on('zoom', aggiornaSliderZoom);
aggiornaSliderZoom();

// Stato di visualizzazione dei layer (i filtri lo aggiornano da filters.js)
const statoMappa = { mostraNonAssegnate: false, chiavi: null };
const LAYER_SELEZIONE = ['sel-poligoni', 'sel-linee', 'sel-punti'];

function applicaFiltriMappa() {
  const filtro = filtroGeometrie(statoMappa);
  for (const id of LAYER_GEOMETRIE) if (map.getLayer(id)) map.setFilter(id, filtro);
}

// 'style.load' e non 'load': 'load' attende anche i tile della basemap e, se Mapbox risponde 403, può non scattare
map.once('style.load', () => {
  for (const l of layerInterventi()) map.addLayer(l);
  map.addLayer({ id: 'sel-poligoni', type: 'line', source: SOURCE_ID, 'source-layer': 'poligoni', filter: FILTRO_NESSUNO, paint: { 'line-color': '#2458c8', 'line-width': 3 } });
  map.addLayer({ id: 'sel-linee', type: 'line', source: SOURCE_ID, 'source-layer': 'linee', filter: FILTRO_NESSUNO, paint: { 'line-color': '#2458c8', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 17, 9], 'line-opacity': 0.55 } });
  map.addLayer({ id: 'sel-punti', type: 'circle', source: SOURCE_ID, 'source-layer': 'punti', filter: FILTRO_NESSUNO, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 7, 17, 14], 'circle-color': 'rgba(36,88,200,0.15)', 'circle-stroke-color': '#2458c8', 'circle-stroke-width': 2.5 } });
  applicaFiltriMappa();
  map.fire('interventi-pronti');
});

// Evidenzia tutte le geometrie (punti, linee, poligoni) di un intervento
function evidenziaInMappa(cod) {
  if (!map.getLayer('sel-punti')) return;
  const chiavi = cod ? DATI.chiavi.filter((k) => k.split(';').some((c) => c.trim() === cod)) : [];
  const f = chiavi.length ? ['in', chiaveFeature, ['literal', chiavi]] : FILTRO_NESSUNO;
  for (const id of LAYER_SELEZIONE) map.setFilter(id, f);
}

function zoomIntervento(o) {
  if (!o?.pos) return;
  map.flyTo({ center: o.pos, zoom: Math.max(map.getZoom(), 16), padding: paddingMappa(0), duration: 800 });
}

// ── Hover e click ───────────────────────────────────────────────────────────
const LAYER_INTERATTIVI = ['punti', 'linee', 'poligoni-fill'];
const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'popup-hover' });

function codiciDi(props) {
  return (props.cod_int || props.cod_assegnato || '').split(';').map((c) => c.trim()).filter(Boolean);
}

let popupChiave = null;

// Le descrizioni arrivano in MAIUSCOLO: maiuscola iniziale per parola, tranne articoli e preposizioni brevi
const MINUSCOLE = new Set(['e', 'di', 'da', 'del', 'dello', 'della', 'dei', 'delle', 'degli', 'in', 'a', 'per', 'con', 'su', 'il', 'lo', 'la', 'i', 'le', 'al', 'alla', 'ai', 'nel', 'nella', 'ed', 'o', "dell'", "all'"]);
function titoloCase(t) {
  return t.toLowerCase().replace(/[\p{L}\p{N}']+/gu, (w, i) => (i > 0 && MINUSCOLE.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
}

function contenutoPopup(props) {
  const cod = codiciDi(props);
  const o = DATI.perCodice.get(cod[0]);
  const colore = COLORI_CLASSE[props.classe] || COLORE_APPROSSIMATO;
  const titolo = el('div', { class: 'ph-titolo' }, [
    el('span', { class: 'ph-dot', style: `background:${colore}` }),
    el('strong', { text: cod[0] || 'Geometria non assegnata' }),
    cod.length > 1 ? el('span', { class: 'ph-altri', text: `+${cod.length - 1}` }) : null,
  ].filter(Boolean));
  const desc = (o?.descrizione_intervento || props.descrizione || '').trim();
  const nodi = [titolo, desc ? el('div', { class: 'ph-desc', text: titoloCase(desc) }) : null];
  if (o) {
    const chip = [
      o.settore_sottosettore ? el('span', { class: 'ph-chip', text: o.settore_sottosettore.replace(/^[\d.]+\s*-\s*/, '') }) : null,
      el('span', { class: 'ph-chip imp', text: fmtEuroCompatto(o.importo) }),
      o.annualita_avvio_affidamento ? el('span', { class: 'ph-chip', text: String(o.annualita_avvio_affidamento) }) : null,
    ];
    nodi.push(el('div', { class: 'ph-chips' }, chip));
  }
  nodi.push(el('div', { class: 'ph-hint', text: 'Clic per aprire la scheda' }));
  return el('div', { class: 'ph' }, nodi);
}

map.on('mousemove', (e) => {
  if (!map.getLayer('punti')) return;
  const f = map.queryRenderedFeatures(e.point, { layers: LAYER_INTERATTIVI })[0];
  map.getCanvas().style.cursor = f ? 'pointer' : '';
  if (!f) { popup.remove(); return; }
  const chiave = f.properties.cod_int || f.properties.cod_assegnato || '';
  if (chiave !== popupChiave || !popup.isOpen()) { popup.setDOMContent(contenutoPopup(f.properties)); popupChiave = chiave; }
  popup.setLngLat(e.lngLat).addTo(map);
});
map.getCanvas().addEventListener('mouseleave', () => popup.remove());

map.on('click', (e) => {
  const f = map.queryRenderedFeatures(e.point, { layers: LAYER_INTERATTIVI })[0];
  const cod = f ? codiciDi(f.properties).filter((c) => DATI.perCodice.has(c)) : [];
  if (cod.length) window.selezionaIntervento?.(cod[0], { altri: cod.slice(1) });
});

// ── Toolbar ────────────────────────────────────────────────────────────────
function impostaBasemap(chiave) {
  for (const k of Object.keys(BASEMAPS)) map.setLayoutProperty(`basemap-${k}-layer`, 'visibility', k === chiave ? 'visible' : 'none');
  document.querySelectorAll('#tb-basemaps [data-basemap]').forEach((b) => {
    const on = b.dataset.basemap === chiave;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  aggiornaAttribuzioni(chiave);
}

function aggiornaAttribuzioni(chiave) {
  const box = document.getElementById('attrib-text');
  const voci = [...BASEMAPS[chiave].attr, ['Programma triennale OO.PP. 2026-2028, DCC 553/2026', null]];
  box.replaceChildren();
  voci.forEach(([t, u], i) => {
    if (i) box.append(' · ');
    box.append(u ? el('a', { href: u, target: '_blank', rel: 'noopener noreferrer', text: t }) : t);
  });
}

document.getElementById('tb-basemaps').addEventListener('click', (e) => {
  const b = e.target.closest('[data-basemap]');
  if (b) impostaBasemap(b.dataset.basemap);
});
function vistaIniziale(animata = true) {
  const cam = map.cameraForBounds(BOUNDS, { padding: paddingMappa(30) });
  map.easeTo({ center: cam.center, zoom: Math.max(cam.zoom, ZOOM_MIN_DATI), duration: animata ? 800 : 0 });
}
document.getElementById('tb-home').addEventListener('click', () => vistaIniziale());
map.once('style.load', () => { if (map.getZoom() < ZOOM_MIN_DATI) vistaIniziale(false); });
document.getElementById('tb-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});
document.getElementById('tb-info').addEventListener('click', () => window.mostraVista?.('info'));

// Attribuzioni a comparsa
const attribBtn = document.getElementById('attrib-btn');
attribBtn.addEventListener('click', () => {
  const panel = document.getElementById('attrib-panel');
  panel.hidden = !panel.hidden;
  attribBtn.setAttribute('aria-expanded', String(!panel.hidden));
});
aggiornaAttribuzioni(BASEMAP_INIZIALE);

// Scala metrica
function aggiornaScala() {
  const bar = document.getElementById('map-scale-bar');
  const label = document.getElementById('map-scale-label');
  const mpp = 156543.03392 * Math.cos(map.getCenter().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
  const maxM = mpp * 120;
  const exp = Math.pow(10, Math.floor(Math.log10(maxM)));
  const nice = [1, 2, 5, 10].map((f) => f * exp).find((v) => v <= maxM) || exp;
  bar.style.width = `${Math.round(nice / mpp)}px`;
  label.textContent = nice >= 1000 ? `${nice / 1000} km` : `${Math.round(nice)} m`;
}
map.on('move', aggiornaScala);
map.on('load', aggiornaScala);
