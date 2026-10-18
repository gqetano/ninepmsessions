# NINEPM Sessions

Sito statico per GitHub Pages: pubblicare index.html, styles.css, script.js,
submissions.js e assets insieme. Non richiede compilazione.

## Stato
- Gioco iniziale dei loghi attivo, riattivato su richiesta dell’utente.
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
Per chiudere un form: data-submissions-open="false" sul form corrispondente.
La chiusura locale non disattiva l’endpoint del servizio Web3Forms.

## Verifica finale
Controlli statici di HTML, CSS, risorse e sintassi JavaScript.
Prove simulate dei form, senza inviare email reali.
La verifica visiva conclusiva resta da effettuare nell’anteprima.

