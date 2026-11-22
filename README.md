# NINEPM Sessions

Sito statico per GitHub Pages, senza compilazione.

## File
- index.html: le cinque schede (Home, Quartetto, Format, Submissions, Colophon) e il menu nel tondo 9PM.
- styles.css: tutto lo stile del sito, menu compreso; in fondo i breakpoint.
- script.js: schede, trascinamento e scroll tra le schede, rimbalzo di fine testo,
  barra di scorrimento, fascia scorrevole, richiamo di Submissions, menu.
- submissions.js: validazione e invio dei due form (Web3Forms).
- agenda.js, agenda.css: l'Agenda, usata solo dal Side B.
- contributo-4tlwp7/: il Side B (vedi sotto).
- tools/side-b.mjs: cifra e decifra il contenuto del Side B.
- assets/: font Ronzino, loghi, favicon.

## Comportamento
- Le schede sopra quella aperta spariscono (data-stack-mode="collapse-above" sul main);
  quelle sotto restano come linguette.
- Il tondo 9PM in basso a destra apre il menu: col mouse passandoci sopra, sul telefono toccandolo.
- Lo scroll oltre la fine del testo passa alla scheda vicina; arrivati in fondo il testo
  fa un solo rimbalzo per gesto. Per tornare alla sola navigazione a clic:
  data-scroll-navigation="false" sul main.
- Dopo 8 secondi di inattività la scheda Submissions fa un piccolo richiamo.
- Per chiudere un form: data-submissions-open="false" sul form. Non disattiva l'endpoint Web3Forms.
- Statistiche: GoatCounter (https://9pmsessions.goatcounter.com).

Quando si modifica un file CSS o JS, aggiornare il ?v= nel link di index.html
(e di contributo-4tlwp7/index.html), altrimenti il browser usa la copia in cache.

## Side B (pagina riservata)
contributo-4tlwp7/index.html è cifrata: nel repository c'è solo il contenuto cifrato,
la chiave sta nel link dopo il #. Il link scade alla data scelta; dopo la scadenza
(o con una chiave sbagliata) la pagina mostra "Questo link è scaduto".
Usa ../styles.css, ../script.js, ../agenda.js e ../agenda.css.

Ricifrare dopo una modifica (il sorgente in chiaro non va mai nel repository):

    node tools/side-b.mjs build <contenuto.html> --days 30 --key <chiave attuale>

Senza --key viene generata una chiave nuova e i link vecchi smettono di funzionare.

L'Agenda legge le date dal foglio Google "9PM – Agenda" tramite data-agenda-source
(URL dello script collegato al foglio); senza, usa la copia in window.AGENDA_DATA.
