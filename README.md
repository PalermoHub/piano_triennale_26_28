# Piano triennale OO.PP. Palermo 2026-2028 — Mappa degli interventi

Web app statica che mostra su mappa i **548 interventi** del Programma triennale dei lavori pubblici
2026-2028 del Comune di Palermo (DCC 553/2026), per **4.373.410.918,53 €** nel triennio.

Realizzata da [OpenDataSicilia.it](https://opendatasicilia.it/) in collaborazione con Claude AI (Anthropic).

## Funzionalità

- Mappa ([MapLibre GL JS](https://maplibre.org/)) con geometrie da PMTiles (punti, linee, poligoni) colorate per annualità e basemap Mapbox chiara, scura e satellite.
- Pannello destro con cinque schede — **Elenco, Scheda, Statistiche, Filtri, Info** — navigabili anche da tastiera.
- **Filtri interconnessi a scalare**: Circoscrizione → Quartiere → UPL, annualità, settore, tipologia, priorità, fascia d'importo, CUP, fonte di finanziamento e ricerca testuale. Ogni opzione mostra quanti interventi darebbe con gli altri filtri attivi.
- Scheda di dettaglio con importi per anno, dati della Scheda D, fonti di finanziamento, elenco annuale e avvertenze.
- Statistiche e classifiche cliccabili sul sottoinsieme filtrato. Stato dei filtri e intervento aperto nell'URL (`#circ=VII&anno=2027&i=01-01_025`).
- Filtro per **RUP** e campi di ricerca per Circoscrizione, Quartiere e UPL; opzioni e statistiche seguono sempre i filtri attivi (le voci a zero sono nascoste).
- Scheda a sezioni ripiegabili: posizione nel territorio, RUP, capitale privato, mutuo, CUP candidato, vincoli ambientali, codice AUSA.
- Tooltip sulla mappa con titolo, settore, importo e annualità; slider di zoom (10–20) al posto dei pulsanti +/−, senza rotazione né inclinazione.
- Layout adattivo: su schermi stretti (< 640 px) il pannello diventa un cassetto a tutto schermo con barra di navigazione in basso (Mappa, Elenco, Filtri, Statistiche, Info).
- Anteprime social (Open Graph e Twitter Card) e Google Analytics (`G-KHR1GHDRQS`) in `index.html`; il consenso cookie è gestito dal portale che ospita la mappa.

## Scorciatoie da tastiera

| Tasto | Azione |
|---|---|
| ← → · Home · End | cambia scheda (con il focus sulle schede) |
| 1 – 5 | Elenco, Scheda, Statistiche, Filtri, Info |
| F | apre i filtri |
| / | cerca |
| ↑ ↓ · PagSu · PagGiù | scorre l'elenco; Invio apre la scheda |
| [ ] | intervento precedente / successivo |
| Esc | torna all'elenco |
| P | apre/chiude il pannello |

## Struttura

```
index.html          markup di mappa, toolbar, legenda, pannello
css/                map.css, filters.css, app.css (derivati dallo stile di PEBA), maplibre-gl.css
js/
  vendor/           maplibre-gl.js, pmtiles.js
  data.js           caricamento dati, formati, helper DOM
  style.js          layer MapLibre (colori per annualità)
  map.js            mappa, basemap, selezione, toolbar
  filters.js        filtri interconnessi, ricerca, legenda, stato in URL
  panel.js          pannello a schede, tastiera, elenco, scheda, statistiche
data/
  interventi_oopp_2026_2028.pmtiles   geometrie (punti, linee, poligoni)
  interventi.json                     548 interventi con attributi e posizione
  chiavi_geometrie.json               chiavi presenti nei tile, per filtrare la mappa
img/                          favicon, logo OpenDataSicilia, og-image.png
```

## Avvio in locale

Serve un server statico che supporti le richieste HTTP Range (necessarie a PMTiles); `python3 -m http.server` non basta. Ad esempio:

```bash
npx http-server -p 8000        # http://localhost:8000
```

Su GitHub Pages funziona senza configurazioni.

## Dati

Il join tra geometrie e CSV usa `cod_int` (o `cod_assegnato` per linee e poligoni), che può contenere più
codici separati da `;`. L'importo mostrato è la somma dei costi dei tre anni (totale ufficiale del
programma); l'importo complessivo, che comprende le annualità successive, è nella scheda.
Gli script di generazione e i sorgenti di lavoro non fanno parte del repository.

## Mapbox

Le basemap usano un token pubblico Mapbox (`pk.`) limitato agli URL consentiti dal pannello Mapbox:
per un nuovo dominio va aggiunto lì, oppure va sostituita la costante `MAPBOX_TOKEN` in `js/map.js`.

## Anteprima social

`canonical`, `og:url` e i percorsi delle immagini in `index.html` vanno allineati all'URL pubblico definitivo.

## Fonti e avvertenze

- Delibera di Consiglio Comunale n. 553/2026, schede e allegati del Programma triennale.
- Il CUP ufficiale non è stato modificato; i CUP candidati sono proposte da verificare.
- 94 interventi su 548 non hanno una geometria e compaiono solo in elenco e statistiche.
- I dati sono ricavati da Claude AI dai PDF pubblicati dal Comune e hanno carattere informativo, senza valore legale: per la documentazione ufficiale fare riferimento agli atti del Comune.
