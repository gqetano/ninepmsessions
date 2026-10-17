# NINEPM Sessions

Sito statico per GitHub Pages: pubblicare index.html, styles.css, script.js,
submissions.js e assets insieme. Non richiede compilazione.

## Stato
- Gioco iniziale dei loghi attivo, riattivato su richiesta dell’utente.
- Candidature aperte: fascia “OPEN FOR SEASON 3”.
- Due form Web3Forms, con chiavi e oggetti email distinti.
- Colophon nascosto fino al fondo di Submissions, poi apribile dal titolo.
- GoatCounter integrato: https://9pmsessions.goatcounter.com/count.
- Nessuna pubblicazione eseguita; ricezione delle statistiche da verificare sul sito online.

## Organizzazione
styles.css raccoglie regole comuni, form e colophon, seguiti dai breakpoint.
I contenuti hanno due colonne; il colophon usa tre colonne allineate tra le righe.
submissions.js condivide validazione e invio tra i due form; i controlli per
brani, link aggiuntivi e note sono specifici del form artisti.
script.js gestisce schede, fascia scorrevole, gioco e comparsa del colophon.

## Configurazione
Per disattivare temporaneamente il gioco: data-logo-game-enabled="false" sul main.
Per chiudere un form: data-submissions-open="false" sul form corrispondente.
La chiusura locale non disattiva l’endpoint del servizio Web3Forms.

## Verifica finale
Controlli statici di HTML, CSS, risorse e sintassi JavaScript.
Prove simulate dei form, senza inviare email reali.
La verifica visiva conclusiva resta da effettuare nell’anteprima.
