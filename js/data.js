// Dati: interventi (CSV unificato → JSON) e chiavi delle geometrie presenti nei tile.

const DATI = { interventi: [], perCodice: new Map(), chiavi: [] };

const ANNO_CLASSE = { 2026: 1, 2027: 2, 2028: 3 }; // anno di avvio → classe/colore delle geometrie
const ANNO_LABEL = { 2026: 'I annualità · 2026', 2027: 'II annualità · 2027', 2028: 'III annualità · 2028' };

async function caricaDati() {
  const [interventi, chiavi] = await Promise.all([
    fetch('data/interventi.json').then((r) => r.json()),
    fetch('data/chiavi_geometrie.json').then((r) => r.json()),
  ]);
  DATI.interventi = interventi;
  DATI.chiavi = chiavi;
  DATI.perCodice = new Map(interventi.map((o) => [o.cod_int_amm, o]));
  for (const o of interventi) {
    o._titolo = titoloCase((o.descrizione_intervento || '').trim());
    o._cerca =`${o.cod_int_amm} ${o.descrizione_intervento || ''} ${o.rup || ''} ${o.cup || ''}`.toLowerCase();
    o._tipologia = accenta((o.tipologia || '').replace(/^\d+\s*-\s*/, '')) || 'n.d.';
    o._settore = accenta((o.settore_sottosettore || '').replace(/^[\d.]+\s*-\s*/, '')) || 'n.d.';
    o._rup = o.rup || 'Non indicata';
    o._fonte = o.fonti_tipologia_risorsa || 'Non indicata';
    o._cup = o.cup_presente ? 'Presente' : o.cup_2026_mancante ? 'Mancante, atteso nel 2026' : 'Mancante';
    o._fascia = fasciaImporto(o.importo);
  }
}

// Le descrizioni arrivano in MAIUSCOLO: maiuscola iniziale per parola, tranne articoli e preposizioni brevi.
// «CITTA'» diventa «Città»; numeri romani e sigle note restano maiuscoli.
const MINUSCOLE = new Set(['e', 'di', 'da', 'del', 'dello', 'della', 'dei', 'delle', 'degli', 'in', 'a', 'per', 'con', 'su', 'il', 'lo', 'la', 'i', 'le', 'al', 'alla', 'ai', 'nel', 'nella', 'ed', 'o', "dell'", "all'"]);
const SIGLE = new Set(['zen', 'peep', 'prg', 'amat', 'rap', 'pa', 'sn']);
const ACCENTATE = { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' };
// «collettivita'» → «collettività» (solo apostrofo a fine parola)
const accenta = (t) => t.replace(/(?<!\bp)([aeiou])'(?!\p{L})/giu, (_, v) => ACCENTATE[v.toLowerCase()]);
function titoloCase(t) {
  // se il testo ha apici usati come virgolette ('Svincolo Oreto - Partanna') non si accentano gli apostrofi finali
  const virgolette = /(^|\s)'/.test(t);
  return t.toLowerCase()
    .replace(/(?<!\bp)([aeiou])'(?!\p{L})/gu, (m, v) => (virgolette ? m : ACCENTATE[v]))
    .replace(/[\p{L}\p{N}]+'?/gu, (w, i) => {
      if (SIGLE.has(w) || /^[ivx]+$/.test(w) && w.length > 1) return w.toUpperCase();
      return i > 0 && MINUSCOLE.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
    })
    .replace(/\bi\.(?=\d)/g, 'I.');
}

const FASCE_IMPORTO = ['Fino a 150 mila €', '150 mila – 1 mln €', '1 – 5 mln €', '5 – 20 mln €', 'Oltre 20 mln €'];
function fasciaImporto(v) {
  const x = v || 0;
  if (x < 150000) return FASCE_IMPORTO[0];
  if (x < 1e6) return FASCE_IMPORTO[1];
  if (x < 5e6) return FASCE_IMPORTO[2];
  if (x < 2e7) return FASCE_IMPORTO[3];
  return FASCE_IMPORTO[4];
}

const fmtNum = new Intl.NumberFormat('it-IT');
const fmtEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtEuro2 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

// 4.373.410.918 → "4,37 mld €"; 12.500.000 → "12,5 mln €"; altrimenti euro interi
function fmtEuroCompatto(v) {
  const x = Math.abs(v || 0);
  const num = (n, d) => n.toLocaleString('it-IT', { maximumFractionDigits: d });
  if (x >= 1e9) return `${num(v / 1e9, 2)} mld €`;
  if (x >= 1e6) return `${num(v / 1e6, 1)} mln €`;
  if (x >= 1e3) return `${num(v / 1e3, 0)} mila €`;
  return fmtEuro.format(v || 0);
}

// Per le chiavi tipo "01-01_025" ordina in modo naturale (numeri come numeri)
const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

// Crea un elemento DOM: el('div', { class: 'x', 'data-k': 'v' }, [figli o testo]) — testo sempre via textContent.
function el(tag, attrs = {}, figli = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of [].concat(figli)) if (f != null) e.append(f);
  return e;
}
