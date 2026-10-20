# NINEPM Sessions

Sito statico per GitHub Pages: pubblicare index.html, styles.css, script.js,
submissions.js, flipper.js e assets insieme. Non richiede compilazione.

## Stato
- Flipper attivo: un solo logo, trascinamento, lancio con inerzia, attrito e urti.
  Le sezioni restano navigabili fin dall’avvio, anche durante il moto del logo.
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
Logo a riposo (flipper e moltiplicazione): agganciato in basso a destra, appoggiato
sul bordo superiore della sezione colophon. Quando il colophon si apre, si chiude o
cambia altezza (animazione, trascinamento, hover, resize) il logo lo segue.
La posizione è calcolata in getDockedLogoPosition() di script.js ed esposta come
window.ninepmDockPosition per flipper.js; il seguito frame per frame è trackDockAnchor().
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
il trascinamento progressivo verso la scheda adiacente. Touch: il passaggio si
completa dopo ~56px di trascinamento (max 22% della corsa) oppure con uno swipe
veloce (>= 0,3 px/ms, almeno 12px); sotto soglia torna indietro.
Rotella/trackpad: il passaggio si completa non appena si superano ~60px di input
oltre il bordo, senza attendere la pausa. Un nuovo swipe sul trackpad sopra l'inerzia
del precedente (delta che risale) viene riconosciuto subito; l'inerzia residua dopo il
passaggio viene assorbita e non scorre la sezione di arrivo.
Protezione "arrivo in fondo": lo scroll che porta il testo al bordo non cambia sezione.
Serve una pausa di 350ms (costante edgeCooldown in script.js) e poi un nuovo scroll;
una rotella girata di continuo non salta la sezione. Un nuovo swipe netto sul trackpad
è ammesso già 250ms dopo l'ultimo movimento del testo, anche sopra l'inerzia.
Gli eventi residui durante il cambio vengono assorbiti; ogni nuova sezione
parte dall’inizio. Il completamento dura da 300 a 650ms in base alla corsa restante.
Touch, trackpad e rotella sono supportati; per wheel il rilascio viene stimato
con 160ms senza eventi. La compilazione dei campi e il gioco sospendono la prova.
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

Gestore wheel riscritto: lo scroll verticale è gestito da un solo percorso,
compresa la lettura ordinaria. Gli scatti separati del mouse sono riconosciuti
anche se ravvicinati. Gli eventi durante l’apertura vengono assorbiti e la
coda di inerzia debole non scorre il contenuto in ingresso. Nessuno stato
“used” mantiene bloccata indefinitamente la lettura. Al refresh l’HTML usa
un riferimento versionato a script.js per evitare di provare codice in cache.
