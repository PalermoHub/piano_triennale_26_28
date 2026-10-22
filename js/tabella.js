// Tabella dei dati visualizzati in mappa: cassetto in basso, scelta di righe e colonne, export CSV/JSON.

const TAB_ESCLUSI = new Set(['geo', 'pos', 'geometrie', 'descrizione']); // descrizione duplica descrizione_intervento
const TAB_DEFAULT = ['cod_int_amm', 'descrizione_intervento', 'annualita_avvio_affidamento', 'settore', 'rup', 'cup', 'importo'];

const tab = {
  colonne: [],            // tutte le chiavi esportabili
  attive: new Set(),      // colonne selezionate
  righe: new Set(),       // cod_int_amm delle righe spuntate
  visibili: [],           // righe mostrate (= risultati filtrati)
  aperta: false,
};

function tabChiavi() {
  const chiavi = Object.keys(DATI.interventi[0] || {}).filter((k) => !k.startsWith('_') && !TAB_ESCLUSI.has(k));
  return chiavi.sort((a, b) => {
    const ia = TAB_DEFAULT.indexOf(a), ib = TAB_DEFAULT.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

function tabCella(v, k) {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Sì' : 'No';
  if (typeof v === 'number') return /importo|costo|valore|capitale|fonti_importo/.test(k) ? fmtEuro.format(v) : String(v);
  return String(v);
}

function tabRenderColonne() {
  const box = document.getElementById('tb-col-list');
  box.replaceChildren(...tab.colonne.map((k) => {
    const cb = el('input', { type: 'checkbox', 'data-col': k });
    cb.checked = tab.attive.has(k);
    return el('label', { class: 'tab-col-item' }, [cb, ' ' + k]);
  }));
}

function tabRender() {
  const righe = tab.visibili;
  const cols = tab.colonne.filter((k) => tab.attive.has(k));
  const tutte = el('input', { type: 'checkbox', id: 'tab-all', 'aria-label': 'Seleziona tutte le righe' });
  tutte.checked = righe.length > 0 && righe.every((o) => tab.righe.has(o.cod_int_amm));
  const thead = el('tr', {}, [el('th', { class: 'tab-chk' }, tutte), ...cols.map((k) => el('th', { text: k }))]);
  const tbody = righe.map((o) => {
    const cb = el('input', { type: 'checkbox', 'data-cod': o.cod_int_amm, 'aria-label': 'Seleziona ' + o.cod_int_amm });
    cb.checked = tab.righe.has(o.cod_int_amm);
    const tr = el('tr', { 'data-cod': o.cod_int_amm, class: cb.checked ? 'sel' : null }, [
      el('td', { class: 'tab-chk' }, cb),
      ...cols.map((k) => el('td', { text: tabCella(o[k], k), class: typeof o[k] === 'number' ? 'num' : null })),
    ]);
    return tr;
  });
  document.getElementById('tab-thead').replaceChildren(thead);
  document.getElementById('tab-tbody').replaceChildren(...tbody);
  tabContatori();
}

function tabContatori() {
  const sel = tab.visibili.filter((o) => tab.righe.has(o.cod_int_amm)).length;
  document.getElementById('tab-count').textContent = sel
    ? `${fmtNum.format(sel)} di ${fmtNum.format(tab.visibili.length)} righe selezionate`
    : `${fmtNum.format(tab.visibili.length)} righe in mappa (nessuna spuntata: si esportano tutte)`;
}

// Righe da esportare: quelle spuntate (tra le visibili), altrimenti tutte le visibili
function tabDaEsportare() {
  const sel = tab.visibili.filter((o) => tab.righe.has(o.cod_int_amm));
  const righe = sel.length ? sel : tab.visibili;
  const cols = tab.colonne.filter((k) => tab.attive.has(k));
  return { righe, cols };
}

function tabScarica(nome, mime, testo) {
  const url = URL.createObjectURL(new Blob([testo], { type: mime }));
  const a = el('a', { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function tabEsporta(formato) {
  const { righe, cols } = tabDaEsportare();
  if (!cols.length) return alert('Seleziona almeno una colonna.');
  const stamp = new Date().toISOString().slice(0, 10);
  if (formato === 'json') {
    const out = righe.map((o) => Object.fromEntries(cols.map((k) => [k, o[k] ?? null])));
    tabScarica(`interventi_${stamp}.json`, 'application/json', JSON.stringify(out, null, 2));
  } else {
    const q = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.map(q).join(','), ...righe.map((o) => cols.map((k) => q(o[k])).join(','))].join('\r\n');
    tabScarica(`interventi_${stamp}.csv`, 'text/csv;charset=utf-8', '﻿' + csv);
  }
}

function tabApri(on = !tab.aperta) {
  tab.aperta = on;
  document.getElementById('tab-drawer').classList.toggle('open', on);
  document.getElementById('tb-tabella').classList.toggle('active', on);
  document.getElementById('tb-tabella').setAttribute('aria-pressed', on);
  document.body.classList.toggle('tab-aperta', on);
  if (on) tabRender();
}

function initTabella() {
  tab.colonne = tabChiavi();
  tab.attive = new Set(TAB_DEFAULT.filter((k) => tab.colonne.includes(k)));
  tab.visibili = typeof risultati === 'function' ? risultati() : DATI.interventi;
  tabRenderColonne();

  document.getElementById('tab-close').addEventListener('click', () => tabApri(false));
  document.getElementById('tab-csv').addEventListener('click', () => tabEsporta('csv'));
  document.getElementById('tab-json').addEventListener('click', () => tabEsporta('json'));

  document.getElementById('tb-col-list').addEventListener('change', (e) => {
    const k = e.target.dataset.col;
    if (!k) return;
    e.target.checked ? tab.attive.add(k) : tab.attive.delete(k);
    tabRender();
  });
  document.getElementById('tb-col-all').addEventListener('click', () => {
    tab.colonne.forEach((k) => tab.attive.add(k));
    tabRenderColonne(); tabRender();
  });
  document.getElementById('tb-col-none').addEventListener('click', () => {
    tab.attive.clear();
    tabRenderColonne(); tabRender();
  });

  document.getElementById('tab-table').addEventListener('change', (e) => {
    if (e.target.id === 'tab-all') {
      for (const o of tab.visibili) e.target.checked ? tab.righe.add(o.cod_int_amm) : tab.righe.delete(o.cod_int_amm);
      tabRender();
    } else if (e.target.dataset.cod) {
      const c = e.target.dataset.cod;
      e.target.checked ? tab.righe.add(c) : tab.righe.delete(c);
      e.target.closest('tr').classList.toggle('sel', e.target.checked);
      document.getElementById('tab-all').checked = tab.visibili.every((o) => tab.righe.has(o.cod_int_amm));
      tabContatori();
    }
  });
  document.getElementById('tab-table').addEventListener('click', (e) => {
    const tr = e.target.closest('tbody tr');
    if (tr && !e.target.closest('.tab-chk')) window.selezionaIntervento?.(tr.dataset.cod, { zoom: true });
  });

  document.addEventListener('filtri-cambiati', (e) => {
    tab.visibili = e.detail.risultati;
    if (tab.aperta) tabRender(); else tabContatori();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && tab.aperta && !e.target.closest('input, select, textarea')) tabApri(false); });
}

// Caricato al primo clic su «Tabella» (vedi panel.js): i dati ci sono già
initTabella();
tabApri(true);
