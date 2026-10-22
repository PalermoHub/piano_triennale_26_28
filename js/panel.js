// Pannello destro: schede navigabili da tastiera (Elenco, Scheda, Statistiche, Filtri, Info).
// Dipende da data.js, filters.js, map.js.

const VISTE = ['elenco', 'scheda', 'stats', 'filtri', 'info'];
let vistaCorrente = 'elenco';
let codiceSelezionato = null;
let altriCodici = [];
let ordinamento = 'importo';

// ── Apertura/chiusura ────────────────────────────────────────────────────────
const rpWrap = document.getElementById('rp-wrap');
const rpToggle = document.getElementById('rp-toggle');

function impostaPannello(aperto) {
  rpWrap.classList.toggle('open', aperto);
  rpToggle.setAttribute('aria-expanded', String(aperto));
  rpWrap.inert = false;
  aggiornaNavMobile();
}
window.openRightPanel = () => impostaPannello(true);
rpToggle.addEventListener('click', () => impostaPannello(!rpWrap.classList.contains('open')));
document.getElementById('rp-mobile-close')?.addEventListener('click', () => impostaPannello(false));
document.getElementById('rp-mobile-btn')?.addEventListener('click', () => impostaPannello(true));
impostaPannello(innerWidth >= 640);

// Barra di navigazione in basso (solo mobile): Mappa chiude il pannello, le altre voci aprono la vista corrispondente.
function aggiornaNavMobile() {
  const attiva = !rpWrap.classList.contains('open') ? 'map' : vistaCorrente === 'scheda' ? 'elenco' : vistaCorrente;
  document.querySelectorAll('#mobile-nav .mn-btn').forEach((b) => {
    const on = b.dataset.go === attiva;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}
document.getElementById('mobile-nav').addEventListener('click', (e) => {
  const b = e.target.closest('.mn-btn');
  if (!b) return;
  if (b.dataset.go === 'map') impostaPannello(false);
  else if (b.dataset.go === 'info') window.apriInfo?.();
  else mostraVista(b.dataset.go);
});
document.addEventListener('filtri-cambiati', (e) => {
  const badge = document.getElementById('mn-badge');
  badge.textContent = String(e.detail.attivi);
  badge.style.display = e.detail.attivi ? '' : 'none';
});

// Legenda comprimibile (su mobile parte chiusa)
(function initLegenda() {
  const box = document.getElementById('legend-annualita');
  const titolo = document.getElementById('legend-toggle');
  const imposta = (chiusa) => { box.classList.toggle('collapsed', chiusa); titolo.setAttribute('aria-expanded', String(!chiusa)); };
  if (matchMedia('(max-width: 640px)').matches) imposta(true);
  titolo.addEventListener('click', () => imposta(!box.classList.contains('collapsed')));
  titolo.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); titolo.click(); } });
})();

// ── Schede (ARIA tablist, roving tabindex) ───────────────────────────────────
const tabs = [...document.querySelectorAll('#rp-nav .rp-tab')];

function mostraVista(v, { focus = false, apri = true } = {}) {
  if (!VISTE.includes(v)) return;
  vistaCorrente = v;
  tabs.forEach((t) => {
    const on = t.dataset.view === v;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  for (const id of VISTE) {
    const p = document.getElementById(`rp-${id}`);
    p.hidden = id !== v;
  }
  if (apri) impostaPannello(true);
  aggiornaNavMobile();
  if (v === 'elenco') renderElenco();
  if (v === 'stats') renderStats();
  if (focus) tabs.find((t) => t.dataset.view === v)?.focus();
}
window.mostraVista = mostraVista;

document.getElementById('rp-nav').addEventListener('click', (e) => {
  const t = e.target.closest('.rp-tab');
  if (t) mostraVista(t.dataset.view);
});
document.getElementById('rp-nav').addEventListener('keydown', (e) => {
  const i = tabs.findIndex((t) => t.dataset.view === vistaCorrente);
  let n = -1;
  if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') n = 0;
  else if (e.key === 'End') n = tabs.length - 1;
  if (n < 0) return;
  e.preventDefault();
  mostraVista(tabs[n].dataset.view, { focus: true });
});

// Scorciatoie globali (disattivate durante la digitazione)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = e.target.tagName;
  const inCampo = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.target.isContentEditable;
  if (e.key === 'Escape' && !inCampo) {
    if (vistaCorrente === 'scheda' && codiceSelezionato) deseleziona();
    return;
  }
  if (inCampo) return;
  if (/^[1-5]$/.test(e.key)) { mostraVista(VISTE[Number(e.key) - 1], { focus: true }); e.preventDefault(); }
  else if (e.key === 'f' || e.key === 'F') { mostraVista('filtri', { focus: true }); e.preventDefault(); }
  else if (e.key === '/') { document.getElementById('pf-search-input').focus(); e.preventDefault(); }
  else if (e.key === ']') { vicino(1); e.preventDefault(); }
  else if (e.key === '[') { vicino(-1); e.preventDefault(); }
  else if (e.key === 'p' || e.key === 'P') { rpToggle.click(); e.preventDefault(); }
});

// ── Elenco ───────────────────────────────────────────────────────────────────
const ORDINAMENTI = {
  importo: { dir: -1, chiave: (o) => o.importo || 0 },
  codice: { dir: 1, chiave: null },
  anno: { dir: 1, chiave: (o) => o.annualita_avvio_affidamento },
};
let direzione = ORDINAMENTI[ordinamento].dir; // 1 crescente, -1 decrescente

// A parità di valore il codice resta sempre in ordine crescente
function elencoOrdinato() {
  const { chiave } = ORDINAMENTI[ordinamento];
  const cmp = chiave
    ? (a, b) => (chiave(a) - chiave(b)) * direzione || collator.compare(a.cod_int_amm, b.cod_int_amm)
    : (a, b) => collator.compare(a.cod_int_amm, b.cod_int_amm) * direzione;
  return [...ultimiRisultati].sort(cmp);
}

function aggiornaBtnDirezione() {
  const b = document.getElementById('el-dir');
  b.textContent = direzione === 1 ? '↑' : '↓';
  b.title = direzione === 1 ? 'Ordine crescente: clicca per decrescente' : 'Ordine decrescente: clicca per crescente';
  b.setAttribute('aria-label', b.title);
}

let elencoDirty = true;
function renderElenco() {
  if (!elencoDirty) return;
  elencoDirty = false;
  const lista = document.getElementById('el-lista');
  const dati = elencoOrdinato();
  const imp = dati.reduce((s, o) => s + (o.importo || 0), 0);
  document.getElementById('el-conto').textContent = `${fmtNum.format(dati.length)} interventi · ${fmtEuroCompatto(imp)}`;
  const frag = document.createDocumentFragment();
  for (const o of dati) {
    const col = COLORI_CLASSE[ANNO_CLASSE[o.annualita_avvio_affidamento]];
    const sel = o.cod_int_amm === codiceSelezionato;
    frag.append(el('button', {
      type: 'button', class: `el-row${sel ? ' sel' : ''}`, role: 'option', 'data-cod': o.cod_int_amm,
      'aria-selected': String(sel), tabindex: '-1',
    }, [
      el('span', { class: 'el-top' }, [
        el('span', { class: 'legend-dot', style: `background:${col}` }),
        el('span', { class: 'el-cod', text: o.cod_int_amm }),
        o.pos ? null : el('span', { class: 'el-tag', text: 'non localizzato' }),
        el('span', { class: 'el-imp', text: fmtEuroCompatto(o.importo) }),
      ]),
      el('span', { class: 'el-desc', text: o.descrizione_intervento || '' }),
    ]));
  }
  if (!dati.length) frag.append(el('div', { class: 'pf-dd-empty', text: 'Nessun intervento corrisponde ai filtri.' }));
  lista.replaceChildren(frag);
  const prima = lista.querySelector('.el-row.sel') || lista.querySelector('.el-row');
  if (prima) prima.tabIndex = 0;
}

document.addEventListener('filtri-cambiati', () => {
  elencoDirty = true;
  if (vistaCorrente === 'elenco') renderElenco();
  if (vistaCorrente === 'stats') renderStats();
  aggiornaScheda();
});

const elLista = document.getElementById('el-lista');
elLista.addEventListener('click', (e) => {
  const r = e.target.closest('.el-row');
  if (r) selezionaIntervento(r.dataset.cod, { zoom: true });
});
elLista.addEventListener('keydown', (e) => {
  const righe = [...elLista.querySelectorAll('.el-row')];
  const i = righe.indexOf(document.activeElement);
  if (i < 0) return;
  let n = i;
  if (e.key === 'ArrowDown') n = Math.min(i + 1, righe.length - 1);
  else if (e.key === 'ArrowUp') n = Math.max(i - 1, 0);
  else if (e.key === 'PageDown') n = Math.min(i + 10, righe.length - 1);
  else if (e.key === 'PageUp') n = Math.max(i - 10, 0);
  else if (e.key === 'Home') n = 0;
  else if (e.key === 'End') n = righe.length - 1;
  else return;
  e.preventDefault();
  righe[i].tabIndex = -1;
  righe[n].tabIndex = 0;
  righe[n].focus();
});
document.getElementById('el-ordina').addEventListener('change', (e) => {
  ordinamento = e.target.value;
  direzione = ORDINAMENTI[ordinamento].dir;
  aggiornaBtnDirezione();
  elencoDirty = true;
  renderElenco();
});
document.getElementById('el-dir').addEventListener('click', () => {
  direzione = -direzione;
  aggiornaBtnDirezione();
  elencoDirty = true;
  renderElenco();
});
aggiornaBtnDirezione();

// ── Selezione ────────────────────────────────────────────────────────────────
function selezionaIntervento(cod, { zoom = false, altri = [], apri = true } = {}) {
  const o = DATI.perCodice.get(cod);
  if (!o) return;
  codiceSelezionato = cod;
  altriCodici = altri;
  evidenziaInMappa(cod);
  if (zoom) zoomIntervento(o);
  elencoDirty = true;
  aggiornaScheda();
  if (apri) mostraVista('scheda');
  scriviUrlSelezione();
}
window.selezionaIntervento = selezionaIntervento;

function deseleziona() {
  codiceSelezionato = null;
  altriCodici = [];
  evidenziaInMappa(null);
  elencoDirty = true;
  mostraVista('elenco', { focus: true });
  scriviUrlSelezione();
}

function scriviUrlSelezione() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (codiceSelezionato) p.set('i', codiceSelezionato); else p.delete('i');
  const h = p.toString();
  history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search);
}

// Intervento precedente/successivo nell'elenco corrente
function vicino(delta) {
  const dati = elencoOrdinato();
  if (!dati.length) return;
  const i = dati.findIndex((o) => o.cod_int_amm === codiceSelezionato);
  const n = i < 0 ? 0 : (i + delta + dati.length) % dati.length;
  selezionaIntervento(dati[n].cod_int_amm, { zoom: true });
}
document.getElementById('rp-punto-prev').addEventListener('click', () => vicino(-1));
document.getElementById('rp-punto-next').addEventListener('click', () => vicino(1));
document.getElementById('rp-punto-back').addEventListener('click', () => mostraVista('elenco', { focus: true }));

// ── Scheda ───────────────────────────────────────────────────────────────────
// Icone delle sezioni (tracciati 24×24, stroke currentColor)
const ICONE = {
  'Posizione nel territorio': '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  'Avvertenze': '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17v.5"/>',
  'Importi': '<path d="M17 6.5A6 6 0 1 0 17 17.5M5 10h9M5 14h9"/>',
  'Scheda D': '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  'CUP candidato (da verificare)': '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
  'Fonti di finanziamento': '<path d="M3 10 12 4l9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/>',
  'Elenco annuale 2026': '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  'Localizzazione': '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
};
const sezChiuse = new Set();   // le sezioni ripiegate restano tali passando da un intervento all'altro
function sez(label, opzioni, ...figli) {
  const { badge: testoBadge = null } = opzioni || {};
  const icona = el('span', { class: 'sc-card-icon', 'aria-hidden': 'true' });
  icona.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONE[label] || ''}</svg>`;
  const scheda = el('details', { class: 'sc-card' }, [
    el('summary', { class: 'sc-card-head' }, [icona, el('span', { class: 'sc-card-title', text: label }), testoBadge ? el('span', { class: 'sc-card-badge', text: testoBadge }) : null]),
    el('div', { class: 'sc-card-body' }, figli),
  ]);
  scheda.open = !sezChiuse.has(label);
  scheda.addEventListener('toggle', () => { if (scheda.open) sezChiuse.delete(label); else sezChiuse.add(label); });
  return scheda;
}
const riga = (label, valore) => (valore == null || valore === '' ? null : el('div', { class: 'rp-punto-row' }, [
  el('span', { class: 'rp-punto-row-label', text: label }),
  el('span', { class: 'rp-punto-row-value', text: String(valore) }),
]));
const eur = (v) => (v == null ? null : fmtEuro2.format(v));
const badge = (testo, tipo = '') => el('span', { class: `sc-badge ${tipo}`, text: testo });
const avviso = (testo, tipo = '') => el('div', { class: `sc-avviso ${tipo}`, text: testo });

function aggiornaScheda() {
  const corpo = document.getElementById('rp-punto-body');
  const nav = document.getElementById('rp-punto-nav');
  const titolo = document.getElementById('rp-punto-title');
  const o = codiceSelezionato ? DATI.perCodice.get(codiceSelezionato) : null;
  if (!o) {
    titolo.textContent = 'Nessun intervento selezionato';
    nav.hidden = true;
    corpo.replaceChildren(el('div', { class: 'rp-text' }, [
      el('p', { text: 'Seleziona un intervento dalla mappa o dall’elenco per vederne la scheda.' }),
      el('p', { text: 'Con la tastiera: [ e ] scorrono gli interventi, Esc torna all’elenco.' }),
    ]));
    return;
  }
  titolo.textContent = o.cod_int_amm;
  const dati = elencoOrdinato();
  const i = dati.findIndex((x) => x.cod_int_amm === o.cod_int_amm);
  nav.hidden = false;
  document.getElementById('rp-punto-nav-count').textContent = i < 0 ? 'fuori filtro' : `${i + 1} di ${dati.length}`;

  const col = COLORI_CLASSE[ANNO_CLASSE[o.annualita_avvio_affidamento]];
  const parti = [];
  parti.push(el('div', { class: 'rp-punto-hdr' }, [
    el('div', { class: 'rp-punto-place', text: o.descrizione_intervento }),
    el('div', { class: 'rp-punto-sub' }, [el('span', { class: 'legend-dot', style: `background:${col}` }), ` ${ANNO_LABEL[o.annualita_avvio_affidamento] || ''} · ${o._settore}`]),
    el('div', { class: 'rp-punto-quota-box' }, [el('span', { class: 'rp-punto-quota-val', text: fmtEuroCompatto(o.importo) }), el('span', { class: 'rp-punto-quota-unit', text: ' nel triennio' })]),
    el('div', { class: 'sc-badges' }, [
      badge(`Avvio ${o.annualita_avvio_affidamento}`),
      badge(o._settore),
      o.tipologia ? badge(o.tipologia.replace(/^\d+\s*-\s*/, '')) : null,
      o.cup_presente ? badge('CUP presente', 'ok') : badge(o.cup_2026_mancante ? 'CUP mancante' : 'Senza CUP', 'warn'),
      o.in_elenco_annuale ? badge('Elenco annuale 2026', 'ok') : null,
      o.lavoro_complesso ? badge('Lavoro complesso') : null,
      o.lotto_funzionale ? badge('Lotto funzionale') : null,
      o.pos ? null : badge('Non localizzato', 'warn'),
    ].filter(Boolean)),
  ]));

  // Posizione nel territorio: una voce per ogni terna Circoscrizione / Quartiere / UPL
  if (o.geo.length) {
    parti.push(sez('Posizione nel territorio', null, ...o.geo.map(([circ, quart, upl]) => el('div', { class: 'sc-pos' }, [
      riga('Circoscrizione', circ), riga('Quartiere', quart), riga('UPL', upl),
    ]))));
  }

  const av = [];
  if (!o.pos) av.push(avviso('Intervento non localizzato: non ha una geometria sulla mappa.', 'warn'));
  if (o.cup_2026_mancante) av.push(avviso('Affidamento previsto nel 2026 ma CUP assente: dovrebbe già esistere.', 'warn'));
  if (o.cup_candidato) av.push(avviso(`CUP candidato ${o.cup_candidato} (affidabilità ${o.cup_candidato_affidabilita || 'n.d.'}): proposta da verificare, non è il CUP ufficiale.`));
  if (o.cui && DATI.interventi.filter((x) => x.cui === o.cui).length > 1) av.push(avviso('Questo CUI compare anche su un altro intervento: dato così nel documento del Comune.', 'warn'));
  if (altriCodici.length) {
    av.push(el('div', { class: 'sc-avviso' }, ['Stessa geometria di: ', ...altriCodici.flatMap((c, k) => [k ? ', ' : '', el('button', { type: 'button', class: 'sc-link', text: c, 'data-cod': c })])]));
  }
  if (av.length) parti.push(sez('Avvertenze', { badge: String(av.length) }, ...av));

  parti.push(sez('Importi', { badge: fmtEuroCompatto(o.importo) },
    riga('1° anno (2026)', eur(o.costo_1_anno)), riga('2° anno (2027)', eur(o.costo_2_anno)), riga('3° anno (2028)', eur(o.costo_3_anno)),
    riga('Annualità successive', eur(o.costi_annualita_successive)), riga('Triennio', eur(o.importo_triennio)), riga('Importo complessivo', eur(o.importo_complessivo))));

  const link = o.opencup_link ? el('a', { href: o.opencup_link, target: '_blank', rel: 'noopener noreferrer', text: `${o.cup} ↗` }) : null;
  parti.push(sez('Scheda D', { badge: o.cup_presente ? 'CUP presente' : null },
    o.rup ? el('div', { class: 'rp-punto-row' }, [el('span', { class: 'rp-punto-row-label', text: 'RUP' }), el('span', { class: 'rp-punto-row-value' }, badge(o.rup, 'rup'))]) : null, riga('CUI', o.cui),
    link ? el('div', { class: 'rp-punto-row' }, [el('span', { class: 'rp-punto-row-label', text: 'CUP' }), link]) : riga('CUP', o.cup_stato),
    riga('Settore', o.settore_sottosettore), riga('Tipologia', o.tipologia), riga('Priorità', o.priorita),
    riga('Avvio affidamento', o.annualita_avvio_affidamento), riga('Lotto funzionale', o.lotto_funzionale == null ? null : o.lotto_funzionale ? 'Sì' : 'No'),
    riga('Lavoro complesso', o.lavoro_complesso == null ? null : o.lavoro_complesso ? 'Sì' : 'No'), riga('Codice NUTS', o.nuts)));

  if (o.cup_candidato) {
    const lc = o.cup_candidato_link ? el('div', { class: 'rp-punto-row' }, [el('span', { class: 'rp-punto-row-label', text: 'CUP' }), el('a', { href: o.cup_candidato_link, target: '_blank', rel: 'noopener noreferrer', text: `${o.cup_candidato} ↗` })]) : riga('CUP', o.cup_candidato);
    parti.push(sez('CUP candidato (da verificare)', { badge: o.cup_candidato_affidabilita || null }, lc, riga('Affidabilità', o.cup_candidato_affidabilita), riga('Descrizione OpenCUP', (o.cup_candidato_descrizione || '').split('*')[0]),
      riga('Anno CUP', o.cup_candidato_anno), riga('Costo OpenCUP', eur(o.cup_candidato_costo)),
      riga('Importo coincide', o.cup_candidato_importo_coincide == null ? null : o.cup_candidato_importo_coincide ? 'Sì' : 'No'),
      riga('CUP duplicato', o.cup_candidato_duplicato ? 'Sì: già associato ad altro intervento' : null)));
  }
  if (o.fonti_importo_totale != null || o.fonti_tipologia_risorsa || o.capitale_privato_importo || o.scadenza_ultima_mutuo) {
    parti.push(sez('Fonti di finanziamento', null, riga('Tipologia', o.fonti_tipologia_risorsa), riga('Descrizione', o.fonti_descrizione_finanziamento), riga('Importo totale', eur(o.fonti_importo_totale)),
      riga('Capitale privato', eur(o.capitale_privato_importo || null)), riga('Tipologia capitale privato', o.capitale_privato_tipologia), riga('Scadenza ultima rata mutuo', o.scadenza_ultima_mutuo)));
  }
  if (o.in_elenco_annuale) {
    parti.push(sez('Elenco annuale 2026', { badge: eur(o.annuale_importo_annualita) }, riga('Importo annualità', eur(o.annuale_importo_annualita)), riga('Finalità', o.annuale_finalita),
      riga('Livello progettazione', o.annuale_livello_progettazione), riga('Conformità urbanistica', o.annuale_conformita_urbanistica),
      riga('Verifica vincoli ambientali', o.annuale_verifica_vincoli_ambientali),
      riga('Centrale di committenza', [o.annuale_centrale_committenza_denominazione, o.annuale_centrale_committenza_ausa && `AUSA ${o.annuale_centrale_committenza_ausa}`].filter(Boolean).join(' · ')), riga('CIG accordo quadro', o.annuale_cig_accordo_quadro)));
  }
  parti.push(sez('Localizzazione', { badge: o.pos ? null : 'Non localizzato' }, riga('Geometrie', o.geometrie.length ? o.geometrie.join(', ') : 'nessuna'), riga('Tavola', o.tavola)));

  corpo.replaceChildren(...parti.filter(Boolean));
}

document.getElementById('rp-punto-body').addEventListener('click', (e) => {
  const b = e.target.closest('.sc-link');
  if (b) selezionaIntervento(b.dataset.cod, { zoom: true });
});

// ── Statistiche ──────────────────────────────────────────────────────────────
function cartaStat(valore, etichetta) {
  return el('div', { class: 'stat-card' }, [el('div', { class: 'stat-card-value', text: valore }), el('div', { class: 'stat-card-label', text: etichetta })]);
}

function classifica(dim, chiave) {
  const agg = aggrega(dim);
  const attivoVal = (v) => (GEO_DIMS.includes(dim) ? st[dim] === v : st[dim]?.has(v));
  const haSel = GEO_DIMS.includes(dim) ? !!st[dim] : st[dim]?.size > 0;
  const aperto = espansi.has(`stats-${dim}`);
  // con un filtro attivo la classifica mostra le sole voci selezionate (come nei filtri); le altre si aprono a richiesta
  const righe = [...agg].filter(([v]) => !haSel || aperto || attivoVal(v)).map(([v, a]) => ({ v, val: chiave === 'costo' ? a.costo : a.n })).sort((a, b) => b.val - a.val || collator.compare(a.v, b.v));
  const max = Math.max(1, ...righe.map((r) => r.val));
  const tot = righe.reduce((s, r) => s + r.val, 0) || 1;
  const lista = el('div', { class: 'srank-list' });
  for (const r of righe.slice(0, 12)) {
    const attivo = GEO_DIMS.includes(dim) ? st[dim] === r.v : st[dim]?.has(r.v);
    const pct = Math.round((r.val / tot) * 100);
    lista.append(el('button', { type: 'button', class: `srank-item${attivo ? ' active' : ''}`, 'data-dim': dim, 'data-val': r.v, title: r.v }, [
      el('span', { class: 'srank-label', text: etichetta(dim, r.v) }),
      el('span', { class: 'srank-bar-track' }, el('span', { class: `srank-bar-fill srank-bar-fill--${chiave === 'costo' ? 'costo' : 'n'}`, style: `width:${(r.val / max) * 100}%` })),
      el('span', { class: 'srank-value' }, [chiave === 'costo' ? fmtEuroCompatto(r.val) : fmtNum.format(r.val), ' ', el('span', { class: 'srank-pct', text: `(${pct}%)` })]),
    ]));
  }
  if (haSel) lista.append(el('button', { type: 'button', class: 'pf-more', 'data-more-stats': dim, text: aperto ? 'Solo selezionate' : `+ altre ${agg.size - [...agg.keys()].filter(attivoVal).length} voci` }));
  return lista;
}

function renderStats() {
  const box = document.getElementById('rp-stats-body');
  const r = ultimiRisultati;
  const tot = r.reduce((s, o) => s + (o.importo || 0), 0);
  const senzaCup = r.filter((o) => !o.cup_presente).length;
  const anni = [1, 2, 3].map((k) => r.reduce((s, o) => s + (o[`costo_${k}_anno`] || 0), 0));
  const maxAnno = Math.max(1, ...anni);
  const cards = el('div', { class: 'stat-cards' }, [
    cartaStat(fmtNum.format(r.length), 'Interventi'),
    cartaStat(fmtEuroCompatto(tot), 'Importo nel triennio'),
    cartaStat(r.length ? fmtEuroCompatto(tot / r.length) : '–', 'Importo medio'),
    cartaStat(fmtNum.format(senzaCup), 'Senza CUP'),
  ]);
  const spesa = el('div', { class: 'srank-list' });
  ['2026', '2027', '2028'].forEach((a, i) => spesa.append(el('div', { class: 'srank-item static' }, [
    el('span', { class: 'srank-label', text: `Spesa ${a}` }),
    el('span', { class: 'srank-bar-track' }, el('span', { class: 'srank-bar-fill srank-bar-fill--costo', style: `width:${(anni[i] / maxAnno) * 100}%` })),
    el('span', { class: 'srank-value', text: fmtEuroCompatto(anni[i]) }),
  ])));
  const colonne = (titolo, dim) => [el('h3', { text: titolo }), el('div', { class: 'srank-cols' }, [
    el('div', { class: 'srank-col' }, [el('div', { class: 'srank-col-title', text: 'Per numero' }), classifica(dim, 'n')]),
    el('div', { class: 'srank-col' }, [el('div', { class: 'srank-col-title', text: 'Per importo' }), classifica(dim, 'costo')]),
  ])];
  box.replaceChildren(
    el('p', { class: 'panel-note', text: 'Numeri e importi del sottoinsieme filtrato. Clicca una voce per filtrare: i filtri sono interconnessi e a scalare, clicca di nuovo per rimuoverlo.' }),
    cards, el('h3', { text: 'Spesa per anno' }), spesa,
    ...colonne('Circoscrizioni', 'circ'), ...colonne('Quartieri', 'quart'), ...colonne('Settori', 'settore'), ...colonne('Fonti di finanziamento', 'fonte'),
  );
}
document.getElementById('rp-stats-body').addEventListener('click', (e) => {
  const m = e.target.closest('.pf-more[data-more-stats]');
  if (m) { const k = `stats-${m.dataset.moreStats}`; if (!espansi.delete(k)) espansi.add(k); renderStats(); return; }
  const b = e.target.closest('.srank-item[data-dim]');
  if (b) toggleFiltro(b.dataset.dim, b.dataset.val);
});

// ── Avvio ────────────────────────────────────────────────────────────────────
async function avvia() {
  await caricaDati();
  leggiUrl();
  initFiltriUI();
  const prontoMappa = map.getLayer('punti') ? Promise.resolve() : new Promise((r) => map.once('interventi-pronti', r));
  await prontoMappa;
  aggiornaScheda();
  aggiorna({ salvaUrl: false });
  const cod = new URLSearchParams(location.hash.slice(1)).get('i');
  if (cod && DATI.perCodice.has(cod)) selezionaIntervento(cod, { zoom: true });
  else mostraVista('elenco', { apri: false });
}
avvia();
