// Filtri interconnessi "a scalare": ogni dimensione ricalcola le opzioni delle altre
// (faceted search: le opzioni di una dimensione si contano applicando tutti i filtri TRANNE il suo).
// Dipende da data.js, style.js, map.js. Notifica con l'evento 'filtri-cambiati'.

const POS_SI = 'Sulla mappa';
const POS_NO = 'Fuori mappa (non localizzato)';
const SET_DIMS = {
  anno: { titolo: 'Annualità (avvio affidamento)', get: (o) => String(o.annualita_avvio_affidamento), label: (v) => ANNO_LABEL[v] || v, colore: (v) => COLORI_CLASSE[ANNO_CLASSE[v]] },
  settore: { titolo: 'Settore', get: (o) => o._settore },
  tipologia: { titolo: 'Tipologia', get: (o) => o._tipologia },
  priorita: { titolo: 'Priorità', get: (o) => String(o.priorita), label: (v) => `Priorità ${v}` },
  cup: { titolo: 'CUP', get: (o) => o._cup },
  rup: { titolo: 'RUP', get: (o) => o._rup },
  fonte: { titolo: 'Fonte di finanziamento', get: (o) => o._fonte },
  fascia: { titolo: 'Importo (triennio)', get: (o) => o._fascia },
  pos: { titolo: 'Localizzazione', get: (o) => (o.pos ? POS_SI : POS_NO) },
};
const COMBO_DIMS = ['rup']; // dimensioni a scelta multipla con menu a discesa e ricerca (troppi valori per i chip)
const GEO_DIMS = ['circ', 'quart', 'upl'];
const GEO_TITOLI = { circ: 'Circoscrizione', quart: 'Quartiere', upl: 'UPL · Unità di Primo Livello' };
const ORDINE_FISSO = { pos: [POS_SI, POS_NO], cup: ['Presente', 'Mancante, atteso nel 2026', 'Mancante'], fascia: FASCE_IMPORTO };

const st = { circ: '', quart: '', upl: '', q: '' };
for (const d of Object.keys(SET_DIMS)) st[d] = new Set();

// ── Logica di filtro (pura) ────────────────────────────────────────────────
function geoOk(o, skip) {
  const c = skip.includes('circ') ? '' : st.circ;
  const q = skip.includes('quart') ? '' : st.quart;
  const u = skip.includes('upl') ? '' : st.upl;
  if (!c && !q && !u) return true;
  return o.geo.some((t) => (!c || t[0] === c) && (!q || t[1] === q) && (!u || t[2] === u));
}

function passa(o, skip = []) {
  if (!geoOk(o, skip)) return false;
  for (const [d, def] of Object.entries(SET_DIMS)) {
    if (!skip.includes(d) && st[d].size && !st[d].has(def.get(o))) return false;
  }
  if (!skip.includes('q') && st.q && !o._cerca.includes(st.q)) return false;
  return true;
}

function risultati() { return DATI.interventi.filter((o) => passa(o)); }

// Aggregazione per valore di una dimensione ({ n, costo }), con tutti gli altri filtri applicati.
function aggrega(dim, extra = null) {
  const agg = new Map();
  const aggiungi = (v, o) => {
    const a = agg.get(v) || { n: 0, costo: 0 };
    a.n += 1;
    a.costo += o.importo || 0;
    agg.set(v, a);
  };
  const idx = GEO_DIMS.indexOf(dim);
  for (const o of DATI.interventi) {
    if (!passa(o, [dim]) || (extra && !extra(o))) continue;
    if (idx >= 0) {
      const visti = new Set();
      for (const t of o.geo) {
        const ok = GEO_DIMS.every((d, i) => i === idx || !st[d] || t[i] === st[d]);
        if (ok && t[idx]) visti.add(t[idx]);
      }
      for (const v of visti) aggiungi(v, o);
    } else {
      aggiungi(SET_DIMS[dim].get(o), o);
    }
  }
  return agg;
}

// Conteggi per valore (le opzioni di una dimensione si contano ignorando il filtro della dimensione stessa).
function facet(dim) {
  return new Map([...aggrega(dim)].map(([v, a]) => [v, a.n]));
}

// Valori possibili di una dimensione (su tutti i dati), nell'ordine di visualizzazione.
function valoriDim(dim) {
  const tot = new Map();
  for (const o of DATI.interventi) {
    if (GEO_DIMS.includes(dim)) {
      const i = GEO_DIMS.indexOf(dim);
      for (const t of o.geo) if (t[i]) tot.set(t[i], (tot.get(t[i]) || 0) + 1);
    } else {
      const v = SET_DIMS[dim].get(o);
      tot.set(v, (tot.get(v) || 0) + 1);
    }
  }
  const vals = [...tot.keys()];
  if (ORDINE_FISSO[dim]) return ORDINE_FISSO[dim].filter((v) => tot.has(v));
  if (dim === 'anno' || dim === 'priorita') return vals.sort(collator.compare);
  if (dim === 'circ') return vals.sort(ordineRomano);
  if (GEO_DIMS.includes(dim)) return vals.sort(collator.compare);
  return vals.sort((a, b) => (a === 'Non indicata') - (b === 'Non indicata') || tot.get(b) - tot.get(a) || collator.compare(a, b));
}
const ROMANI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const ordineRomano = (a, b) => ROMANI.indexOf(a) - ROMANI.indexOf(b);

function numAttivi() {
  return GEO_DIMS.filter((d) => st[d]).length + Object.keys(SET_DIMS).reduce((n, d) => n + st[d].size, 0) + (st.q ? 1 : 0);
}

// Dopo un cambio: azzera quartiere/UPL se non sono più compatibili con la gerarchia geografica scelta.
function normalizza() {
  const compat = (c, q, u) => DATI.interventi.some((o) => o.geo.some((t) => (!c || t[0] === c) && (!q || t[1] === q) && (!u || t[2] === u)));
  if (st.quart && !compat(st.circ, st.quart, '')) st.quart = '';
  if (st.upl && !compat(st.circ, st.quart, st.upl)) st.upl = '';
}

function resetFiltri() {
  for (const d of GEO_DIMS) st[d] = '';
  for (const d of Object.keys(SET_DIMS)) st[d].clear();
  st.q = '';
  const inp = document.getElementById('pf-search-input');
  if (inp) inp.value = '';
}

function toggleValore(dim, v) {
  if (GEO_DIMS.includes(dim)) st[dim] = st[dim] === v ? '' : v;
  else if (st[dim].has(v)) st[dim].delete(v);
  else st[dim].add(v);
  aggiorna();
}

// ── Render ──────────────────────────────────────────────────────────────────
let ultimiRisultati = [];
const LIMITE_CHIP = 8; // opzioni mostrate per gruppo prima di «+ altre»
const espansi = new Set(); // gruppi con un filtro attivo di cui si mostrano anche le altre opzioni

function aggiorna({ salvaUrl = true } = {}) {
  normalizza();
  ultimiRisultati = risultati();
  renderFiltri();
  renderChips();
  renderLegenda();
  renderCopertura();
  aggiornaMappaDaFiltri(ultimiRisultati);
  if (salvaUrl) scriviUrl();
  document.dispatchEvent(new CustomEvent('filtri-cambiati', { detail: { risultati: ultimiRisultati, attivi: numAttivi() } }));
}

function etichetta(dim, v) {
  return SET_DIMS[dim]?.label ? SET_DIMS[dim].label(v) : v;
}

function renderFiltri() {
  const root = document.getElementById('rp-filtri-body');
  if (!root) return;
  for (const d of GEO_DIMS) renderCombo(d);
  // chipset
  for (const d of Object.keys(SET_DIMS)) {
    if (COMBO_DIMS.includes(d)) { renderCombo(d); continue; }
    const box = document.getElementById(`pf-set-${d}`);
    const conta = facet(d);
    box.replaceChildren();
    const sel = document.getElementById(`pf-sel-${d}`);
    sel.textContent = st[d].size ? String(st[d].size) : '';
    mostraScelte(d);
    const vis = valoriDim(d).filter((v) => conta.get(v) || st[d].has(v)); // le opzioni senza risultati non si mostrano
    const compatta = !espansi.has(d) && (st[d].size > 0 || vis.length > LIMITE_CHIP + 2);
    const mostra = !compatta ? vis : st[d].size ? vis.filter((v) => st[d].has(v)) : vis.slice(0, LIMITE_CHIP);
    for (const v of mostra) {
      const n = conta.get(v) || 0;
      const on = st[d].has(v);
      const col = SET_DIMS[d].colore?.(v);
      box.append(el('button', {
        type: 'button', class: `pf-chip-opt${on ? ' active' : ''}${n === 0 && !on ? ' empty' : ''}`,
        'data-dim': d, 'data-val': v, 'aria-pressed': String(on), disabled: n === 0 && !on,
      }, [col ? el('span', { class: 'pf-chip-dot', style: `background:${col}` }) : null, etichetta(d, v), el('span', { class: 'pf-chip-cnt', text: String(n) })]));
    }
    const altre = vis.length - mostra.length;
    if (altre || espansi.has(d)) {
      box.append(el('button', { type: 'button', class: 'pf-more', 'data-more': d, text: espansi.has(d) ? 'Mostra meno' : `+ altre ${altre} opzioni` }));
    }
  }
  const tot = DATI.interventi.length;
  const imp = ultimiRisultati.reduce((s, o) => s + (o.importo || 0), 0);
  document.getElementById('pf-result-count').textContent = `${fmtNum.format(ultimiRisultati.length)} di ${fmtNum.format(tot)} interventi · ${fmtEuroCompatto(imp)}`;
  const loc = ultimiRisultati.filter((o) => o.pos).length;
  document.getElementById('pf-zoom').disabled = loc === 0;
  const badge = document.getElementById('pf-filter-badge');
  const n = numAttivi();
  badge.textContent = String(n);
  badge.style.display = n ? '' : 'none';
}

const normTesto = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Riepilogo delle scelte sotto il titolo del gruppo (visibile quando il gruppo è chiuso).
function mostraScelte(d) {
  const sum = document.querySelector(`details[data-dim="${d}"] > summary`);
  if (!sum) return;
  let pick = sum.querySelector('.pfm-pick');
  if (!pick) { pick = el('span', { class: 'pfm-pick' }); sum.append(pick); }
  pick.textContent = [...st[d]].map((v) => etichetta(d, v)).join(' · ');
}

// Una parola del valore deve iniziare con il testo digitato (così «v» non trova «IV»).
const corrisponde = (v, q) => normTesto(v).split(/[^a-z0-9]+/).some((w) => w.startsWith(q));
const èGeo = (d) => GEO_DIMS.includes(d);
const èScelto = (d, v) => (èGeo(d) ? st[d] === v : st[d].has(v));
const TUTTE = { circ: 'Tutte le circoscrizioni', quart: 'Tutti i quartieri', upl: 'Tutte le UPL' };

// Menu a discesa con ricerca: vale sia per le dimensioni a scelta multipla (RUP) sia per quelle geografiche (una sola scelta).
function renderCombo(d) {
  const inp = document.getElementById(`pf-${d}-input`);
  const list = document.getElementById(`pf-${d}-list`);
  const aperto = list.classList.contains('open');
  const fuoco = document.activeElement === inp;
  if (èGeo(d)) { if (!fuoco) inp.value = st[d]; }
  else { const sel = document.getElementById(`pf-sel-${d}`); sel.textContent = st[d].size ? String(st[d].size) : ''; mostraScelte(d); }
  inp.classList.toggle('has-value', èGeo(d) && !!st[d]);
  if (!aperto) return;
  list.replaceChildren();
  const q = normTesto(inp.value.trim());
  const cerca = q && !(èGeo(d) && inp.value === st[d]); // il valore già scelto non è una ricerca
  const conta = facet(d);
  let n = 0;
  if (èGeo(d) && st[d]) list.append(el('div', { class: 'pf-combo-item pf-combo-all', role: 'option', 'data-dim': d, 'data-val': st[d] }, [el('span', { class: 'pf-combo-name', text: `✕ ${TUTTE[d]}` })]));
  for (const v of valoriDim(d)) {
    const on = èScelto(d, v);
    const c = conta.get(v) || 0;
    if (!on && !c) continue;
    if (cerca && !corrisponde(v, q)) continue;
    n += 1;
    list.append(el('div', { class: `pf-combo-item${on ? ' active' : ''}`, role: 'option', 'aria-selected': String(on), 'data-dim': d, 'data-val': v }, [
      el('span', { class: 'pf-combo-name', text: `${on ? '✓ ' : ''}${v}` }), el('span', { class: 'pf-chip-cnt', text: String(c) }),
    ]));
  }
  if (!n) list.append(el('div', { class: 'pf-dd-empty', text: 'Nessun risultato' }));
}

function initCombo(d) {
  const inp = document.getElementById(`pf-${d}-input`);
  const list = document.getElementById(`pf-${d}-list`);
  const chiudi = () => { list.classList.remove('open'); list.replaceChildren(); inp.setAttribute('aria-expanded', 'false'); inp.value = èGeo(d) ? st[d] : ''; };
  const apri = () => { list.classList.add('open'); inp.setAttribute('aria-expanded', 'true'); renderCombo(d); };
  const scegli = (v) => { toggleValore(d, v); if (èGeo(d)) { inp.blur(); } };
  inp.addEventListener('focus', () => { inp.select(); apri(); });
  inp.addEventListener('input', apri);
  inp.addEventListener('keydown', (e) => {
    const voci = [...list.querySelectorAll('.pf-combo-item')];
    const cur = voci.findIndex((x) => x.classList.contains('hover'));
    const vai = (i) => { voci.forEach((x, k) => x.classList.toggle('hover', k === i)); voci[i]?.scrollIntoView({ block: 'nearest' }); };
    if (e.key === 'ArrowDown') { e.preventDefault(); vai((cur + 1) % voci.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); vai((cur - 1 + voci.length) % voci.length); }
    else if (e.key === 'Enter') { e.preventDefault(); const v = voci[Math.max(cur, 0)]; if (v) scegli(v.dataset.val); }
    else if (e.key === 'Escape') { chiudi(); inp.blur(); }
  });
  list.addEventListener('mousedown', (e) => {
    const it = e.target.closest('.pf-combo-item');
    if (it) { e.preventDefault(); scegli(it.dataset.val); }
  });
  inp.addEventListener('blur', chiudi);
}

function renderChips() {
  const box = document.getElementById('pf-chips');
  box.replaceChildren();
  const chip = (testo, dim, v) => el('span', { class: 'pf-chip' }, [
    testo,
    el('button', { type: 'button', class: 'pf-chip-close', 'data-dim': dim, 'data-val': v, 'aria-label': `Rimuovi filtro ${testo}`, text: '✕' }),
  ]);
  for (const d of GEO_DIMS) if (st[d]) box.append(chip(`${GEO_TITOLI[d].split(' ')[0]} ${st[d]}`, d, st[d]));
  for (const d of Object.keys(SET_DIMS)) for (const v of st[d]) box.append(chip(etichetta(d, v), d, v));
  if (numAttivi() > 1) box.append(el('button', { type: 'button', class: 'pf-chip-resetall', id: 'pf-chip-resetall', text: 'Azzera tutto' }));
}

function renderLegenda() {
  const box = document.getElementById('legend-rows');
  const conta = facet('anno');
  box.replaceChildren();
  for (const v of valoriDim('anno')) {
    const n = conta.get(v) || 0;
    const on = st.anno.has(v);
    const dim = st.anno.size && !on;
    box.append(el('button', {
      type: 'button', class: `legend-row${on ? ' active' : ''}${dim ? ' dimmed' : ''}${n === 0 && !on ? ' empty' : ''}`,
      'data-dim': 'anno', 'data-val': v, 'aria-pressed': String(on),
    }, [el('span', { class: 'legend-dot', style: `background:${SET_DIMS.anno.colore(v)}` }), el('span', { class: 'legend-label', text: ANNO_LABEL[v] }), el('span', { class: 'legend-count', text: String(n) })]));
  }
  box.append(el('div', { class: 'legend-row static legend-nota', text: 'Dimensione del punto = importo' }));
  box.append(el('div', { class: 'legend-row static' }, [el('span', { class: 'legend-dot', style: `background:${COLORE_APPROSSIMATO}` }), el('span', { class: 'legend-label', text: 'Posizione approssimata (~300 m)' })]));
  box.append(el('label', { class: 'legend-row legend-check' }, [
    el('input', { type: 'checkbox', id: 'lg-non-assegnate', checked: statoMappa.mostraNonAssegnate && numAttivi() === 0, disabled: numAttivi() > 0 }),
    el('span', { class: 'legend-label', text: 'Mostra geometrie non assegnate' }),
  ]));
}

// Parte di mappa non coperta dal pannello laterale
function boundsVisibili() {
  const c = map.getCanvas();
  const destra = paddingMappa(0).right;
  return new maplibregl.LngLatBounds(map.unproject([0, c.clientHeight]), map.unproject([c.clientWidth - destra, 0]));
}

// Banner in alto: interventi nella vista corrente (si aggiorna con zoom e spostamenti) e interventi fuori mappa
// (senza geometria: valgono quasi metà dell'importo e non compaiono mai sulla mappa).
function renderCopertura() {
  const box = document.getElementById('cov-banner');
  const vista = boundsVisibili();
  const sulla = ultimiRisultati.filter((o) => o.pos && vista.contains(o.pos));
  const fuori = ultimiRisultati.filter((o) => !o.pos);
  const imp = (l) => fmtEuroCompatto(l.reduce((s, o) => s + (o.importo || 0), 0));
  const attivo = st.pos.has(POS_NO);
  box.replaceChildren(
    el('span', { class: 'cov-item' }, [el('strong', { text: fmtNum.format(sulla.length) }), ` in vista · ${imp(sulla)}`]),
    el('button', { type: 'button', class: `cov-item cov-fuori${attivo ? ' active' : ''}`, 'aria-pressed': String(attivo), disabled: !fuori.length && !attivo,
      title: attivo ? 'Torna a tutti gli interventi' : 'Mostra in elenco gli interventi senza geometria' }, [el('strong', { text: fmtNum.format(fuori.length) }), ` fuori mappa · ${imp(fuori)}`]),
  );
}

// ── Mappa ───────────────────────────────────────────────────────────────────
let timerVista;
map.on('moveend', () => { clearTimeout(timerVista); timerVista = setTimeout(() => { if (ultimiRisultati.length || DATI.interventi.length) renderCopertura(); }, 120); });

function aggiornaMappaDaFiltri(res) {
  if (numAttivi() === 0) { statoMappa.chiavi = null; applicaFiltriMappa(); return; }
  const ammessi = new Set(res.map((o) => o.cod_int_amm));
  statoMappa.chiavi = DATI.chiavi.filter((k) => k.split(';').some((c) => ammessi.has(c.trim())));
  applicaFiltriMappa();
}

function zoomSuRisultati() {
  const pts = ultimiRisultati.filter((o) => o.pos).map((o) => o.pos);
  if (!pts.length) return;
  const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
  for (const p of pts) b.extend(p);
  map.fitBounds(b, { padding: paddingMappa(40), maxZoom: 17, duration: durata(700) });
}

// ── URL (stato condivisibile) ───────────────────────────────────────────────
function scriviUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  for (const k of [...GEO_DIMS, ...Object.keys(SET_DIMS), 'q']) p.delete(k);
  for (const d of GEO_DIMS) if (st[d]) p.set(d, st[d]);
  for (const d of Object.keys(SET_DIMS)) if (st[d].size) p.set(d, [...st[d]].join('|'));
  if (st.q) p.set('q', st.q);
  const h = p.toString();
  history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
}

function leggiUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  for (const d of GEO_DIMS) st[d] = p.get(d) || '';
  for (const d of Object.keys(SET_DIMS)) st[d] = new Set((p.get(d) || '').split('|').filter(Boolean));
  st.q = (p.get('q') || '').toLowerCase();
  const inp = document.getElementById('pf-search-input');
  if (inp) inp.value = p.get('q') || '';
}

// ── Ricerca con suggerimenti ────────────────────────────────────────────────
let ddIndice = -1;
function renderSuggerimenti() {
  const dd = document.getElementById('pf-search-dd');
  const q = st.q;
  dd.replaceChildren();
  ddIndice = -1;
  if (!q) { dd.classList.remove('open'); return; }
  const trovati = DATI.interventi.filter((o) => passa(o, ['q']) && o._cerca.includes(q)).slice(0, 8);
  if (!trovati.length) dd.append(el('div', { class: 'pf-dd-empty', text: 'Nessun intervento trovato' }));
  for (const o of trovati) {
    dd.append(el('div', { class: 'pf-dd-item', role: 'option', 'data-cod': o.cod_int_amm }, [
      el('span', { class: 'pf-dd-name', text: o._titolo.slice(0, 80) }),
      el('span', { class: 'pf-dd-badge', text: o.cod_int_amm }),
    ]));
  }
  dd.classList.add('open');
}

function evidenziaSuggerimento(delta) {
  const items = [...document.querySelectorAll('#pf-search-dd .pf-dd-item')];
  if (!items.length) return;
  ddIndice = (ddIndice + delta + items.length) % items.length;
  items.forEach((e, i) => e.classList.toggle('hover', i === ddIndice));
  items[ddIndice].scrollIntoView({ block: 'nearest' });
}

function initFiltriUI() {
  const input = document.getElementById('pf-search-input');
  const clear = document.getElementById('pf-search-clear');
  const dd = document.getElementById('pf-search-dd');
  let timer;
  input.addEventListener('input', () => {
    clear.style.display = input.value ? '' : 'none';
    clearTimeout(timer);
    timer = setTimeout(() => { st.q = input.value.trim().toLowerCase(); aggiorna(); renderSuggerimenti(); }, 150);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); evidenziaSuggerimento(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); evidenziaSuggerimento(-1); }
    else if (e.key === 'Enter') {
      const it = dd.querySelectorAll('.pf-dd-item')[Math.max(ddIndice, 0)];
      if (it) { e.preventDefault(); scegliSuggerimento(it.dataset.cod); }
    } else if (e.key === 'Escape') { dd.classList.remove('open'); input.blur(); }
  });
  clear.addEventListener('click', () => { input.value = ''; st.q = ''; clear.style.display = 'none'; dd.classList.remove('open'); aggiorna(); input.focus(); });
  dd.addEventListener('mousedown', (e) => {
    const it = e.target.closest('.pf-dd-item');
    if (it) { e.preventDefault(); scegliSuggerimento(it.dataset.cod); }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('#pf-searchbar')) dd.classList.remove('open'); });

  for (const d of [...GEO_DIMS, ...COMBO_DIMS]) initCombo(d);
  document.getElementById('rp-filtri-body').addEventListener('click', (e) => {
    const m = e.target.closest('.pf-more');
    if (m) { const d = m.dataset.more; if (!espansi.delete(d)) espansi.add(d); renderFiltri(); return; }
    const b = e.target.closest('.pf-chip-opt');
    if (b) toggleValore(b.dataset.dim, b.dataset.val);
  });
  document.getElementById('pf-chips').addEventListener('click', (e) => {
    if (e.target.closest('#pf-chip-resetall')) { resetFiltri(); aggiorna(); return; }
    const b = e.target.closest('.pf-chip-close');
    if (b) toggleValore(b.dataset.dim, b.dataset.val);
  });
  document.getElementById('legend-rows').addEventListener('click', (e) => {
    const b = e.target.closest('.legend-row[data-dim]');
    if (b) toggleValore(b.dataset.dim, b.dataset.val);
  });
  document.getElementById('legend-rows').addEventListener('change', (e) => {
    if (e.target.id === 'lg-non-assegnate') { statoMappa.mostraNonAssegnate = e.target.checked; applicaFiltriMappa(); }
  });
  document.getElementById('cov-banner').addEventListener('click', (e) => { if (e.target.closest('.cov-fuori')) toggleValore('pos', POS_NO); });
  document.getElementById('pf-reset').addEventListener('click', () => { resetFiltri(); aggiorna(); });
  document.getElementById('pf-zoom').addEventListener('click', zoomSuRisultati);
  document.getElementById('pf-filter-btn').addEventListener('click', () => window.mostraVista?.('filtri'));
}

function scegliSuggerimento(cod) {
  document.getElementById('pf-search-dd').classList.remove('open');
  window.selezionaIntervento?.(cod, { zoom: true });
}

// Filtri da altre parti dell'app (statistiche): toggle di un valore
window.toggleFiltro = toggleValore;
