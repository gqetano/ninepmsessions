# NINEPM Sessions

Sito statico per GitHub Pages: pubblicare index.html, styles.css, script.js,
submissions.js, flipper.js e assets insieme. Non richiede compilazione.

## Stato
- Flipper attivo: un solo logo, trascinamento, lancio con inerzia, attrito e urti.
- Moltiplicazione: gioco originale conservato, attualmente spento.
- Candidature aperte: fascia “OPEN FOR SEASON 3”.
- Due form Web3Forms, con chiavi e oggetti email distinti.
- Colophon sempre visibile e apribile come le altre sezioni.
- GoatCounter integrato: https://9pmsessions.goatcounter.com/count.
- Pubblicazione gestita dall’utente su GitHub Pages; ricezione delle statistiche da verificare sul sito online.

## Organizzazione
styles.css raccoglie regole comuni, form e colophon, seguiti dai breakpoint.
I contenuti desktop hanno due colonne in proporzione 30/70, configurate con
--split-left e --split-right in styles.css; il colophon usa tre colonne allineate tra le righe.
submissions.js condivide validazione e invio tra i due form; i controlli per
brani, link aggiuntivi e note sono specifici del form artisti.
script.js gestisce schede, fascia scorrevole, gioco e navigazione del colophon, sempre visibile come le altre schede.

## Configurazione
Per disattivare temporaneamente il gioco: data-logo-game-enabled="false" sul main.
Per scegliere il gioco: data-logo-game-mode="flipper" oppure "moltiplicazione".
Flipper: tap/clic ripone il logo in movimento; dal riposo lo rilancia.
Trascinandolo e rilasciandolo si può imprimere una spinta manuale.
Il link #submissions salta il gioco anche in modalità Flipper.
Per chiudere un form: data-submissions-open="false" sul form corrispondente.
La chiusura locale non disattiva l’endpoint del servizio Web3Forms.

## Verifica finale
Controlli statici di HTML, CSS, risorse e sintassi JavaScript.
Prove simulate dei form, senza inviare email reali.
La verifica visiva conclusiva resta da effettuare nell’anteprima.

## Prova: navigazione e trascinamento tramite scroll
Il contenuto scorre normalmente. Un ulteriore gesto iniziato al bordo permette
il trascinamento progressivo verso la scheda adiacente. Al rilascio, oltre il
22% della corsa il passaggio viene completato; sotto tale soglia torna indietro.
Touch, trackpad e rotella sono supportati; per wheel il rilascio viene stimato
con 140ms senza eventi. La compilazione dei campi e il gioco sospendono la prova.
I titoli restano cliccabili e la preferenza di movimento ridotto è rispettata.

Per annullare TUTTA la navigazione tramite scroll, impostare nel main di
index.html: data-scroll-navigation="false". Si torna alla navigazione tramite
clic, mantenendo le altre modifiche al sito.

Checkpoint prima del trascinamento progressivo:
work/ninepm-before-scroll-drag-experiment/ nella cartella di lavoro.
La verifica è stata effettuata con prove simulate: verificare la sensazione
reale su telefono e trackpad prima di considerare definitiva questa prova.

## Form e fascia della sezione
Le textarea crescono e si riducono con il contenuto, senza scrollbar interna.
Lo scroll iniziato sui campi viene indirizzato alla sezione. Quando un campo
è attivo, il testo può scorrere ma il passaggio ad altre schede resta sospeso.
La marquee mantiene il fondo giallo #FFC93F ed è legata alla sua sezione.
