// Stile dei layer, tradotto da dati_lavoro/stili/{punti,linee,poligoni}.qml
// Colori per classe = annualità del programma (1 = I, 2 = II, 3 = III).

const COLORI_CLASSE = { 1: '#b40000', 2: '#f09332', 3: '#dcdc00' };
const COLORE_APPROSSIMATO = '#808080';
const COLORE_CONTORNO_PUNTI = '#282828';

const ANNUALITA = [
  { classe: 1, label: 'I annualità', colore: COLORI_CLASSE[1] },
  { classe: 2, label: 'II annualità', colore: COLORI_CLASSE[2] },
  { classe: 3, label: 'III annualità', colore: COLORI_CLASSE[3] },
];

const SOURCE_ID = 'interventi';

const coloreClasse = ['match', ['get', 'classe'], 1, COLORI_CLASSE[1], 2, COLORI_CLASSE[2], 3, COLORI_CLASSE[3], COLORE_APPROSSIMATO];

// Chiave di una feature: cod_int, in mancanza cod_assegnato (linee/poligoni). Può contenere più codici ("a;b").
// Vuota = geometria non assegnata a nessun intervento.
const chiaveFeature = ['case',
  ['!=', ['to-string', ['coalesce', ['get', 'cod_int'], '']], ''], ['get', 'cod_int'],
  ['to-string', ['coalesce', ['get', 'cod_assegnato'], '']]];
const eAssegnata = ['!=', chiaveFeature, ''];

// Filtro dei layer. `chiavi` = valori ammessi di chiaveFeature (null = nessun filtro sui codici).
// Le geometrie non assegnate compaiono solo se richiesto e solo senza filtri attivi.
function filtroGeometrie({ mostraNonAssegnate = false, chiavi = null } = {}) {
  if (chiavi) return ['in', chiaveFeature, ['literal', chiavi]];
  return mostraNonAssegnate ? null : eAssegnata;
}

function layerInterventi() {
  const raggio = ['interpolate', ['linear'], ['zoom'], 11, 2.5, 14, 4.5, 17, 8];
  return [
    {
      id: 'poligoni-fill', type: 'fill', source: SOURCE_ID, 'source-layer': 'poligoni',
      paint: { 'fill-color': coloreClasse, 'fill-opacity': 0.43 },
    },
    {
      id: 'poligoni-line', type: 'line', source: SOURCE_ID, 'source-layer': 'poligoni',
      paint: { 'line-color': coloreClasse, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 17, 1.6] },
    },
    {
      id: 'linee', type: 'line', source: SOURCE_ID, 'source-layer': 'linee',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': coloreClasse, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 14, 2.6, 17, 5] },
    },
    {
      id: 'punti', type: 'circle', source: SOURCE_ID, 'source-layer': 'punti',
      paint: {
        'circle-radius': raggio,
        'circle-color': ['case', ['==', ['get', 'origine'], 'approssimato'], COLORE_APPROSSIMATO, coloreClasse],
        'circle-stroke-color': COLORE_CONTORNO_PUNTI,
        'circle-stroke-width': 0.8,
      },
    },
  ];
}

const LAYER_GEOMETRIE = ['poligoni-fill', 'poligoni-line', 'linee', 'punti'];

// Filtro che non seleziona nulla (layer di selezione vuoti)
const FILTRO_NESSUNO = ['==', ['get', 'cod_int'], '\u0000nessuno'];
