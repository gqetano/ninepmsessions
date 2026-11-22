(function () {
  "use strict";

  const root = document.querySelector("[data-agenda]");
  if (!root) return;

  // Le date arrivano dal foglio Google "9PM – Agenda" (schede Disponibilità e
  // Prenotazioni). Con data-agenda-source sul contenitore il sito le legge dallo
  // script collegato al foglio; senza, usa la copia in window.AGENDA_DATA.
  // Formato: [{ date: "2026-12-05", start: "15:00", end: "16:30", taken: false }]
  const source = root.dataset.agendaSource || "";
  let days = {};

  function setSlots(list) {
    days = {};
    list.forEach((slot) => {
      (days[slot.date] = days[slot.date] || []).push({ start: slot.start, end: slot.end, taken: Boolean(slot.taken) });
    });
    Object.values(days).forEach((slots) => slots.sort((a, b) => a.start.localeCompare(b.start)));
  }

  const monthNames = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const dayNames = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

  const list = root.querySelector("[data-agenda-list]");

  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const today = new Date();
  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());

  function freeSlots(key) {
    return (days[key] || []).filter((slot) => !slot.taken);
  }

  function dayState(key) {
    return freeSlots(key).length ? "open" : "full";
  }

  function freeLabel(key) {
    const free = freeSlots(key).length;
    return free ? (free === 1 ? "1 slot libero" : `${free} slot liberi`) : "completo";
  }

  let selectedDay = null;
  let selectedSlot = null;

  // Niente calendario: solo le date presenti nel foglio, una per riga.
  function renderDates() {
    const keys = Object.keys(days).filter((key) => key >= todayKey).sort();
    list.replaceChildren();
    if (!keys.length) {
      const note = document.createElement("p");
      note.className = "agenda-empty";
      note.textContent = "Le date della stagione arrivano a breve.";
      list.append(note);
      return;
    }
    const grid = document.createElement("div");
    grid.className = "agenda-grid";
    keys.forEach((key) => grid.append(buildCell(key)));
    list.append(grid);
    const cell = selectedDay && grid.querySelector(`[data-day="${selectedDay}"]`);
    if (cell) cell.after(buildExpand());
  }

  function buildCell(key) {
    const [y, m, d] = key.split("-").map(Number);
    const state = dayState(key);
    const cell = document.createElement(state === "open" ? "button" : "div");
    cell.className = "agenda-cell";
    cell.dataset.state = state;
    cell.dataset.day = key;
    const weekday = document.createElement("span");
    weekday.className = "agenda-weekday";
    // "sabato, dicembre"; l'anno solo se non è quello in corso.
    const year = y === today.getFullYear() ? "" : ` ${y}`;
    weekday.textContent = `${dayNames[new Date(y, m - 1, d).getDay()]}, ${monthNames[m - 1]}${year}`;
    const number = document.createElement("span");
    number.className = "agenda-number";
    number.textContent = pad(d);
    const note = document.createElement("span");
    note.className = "agenda-note";
    note.textContent = freeLabel(key);
    if (state === "open") {
      cell.type = "button";
      cell.setAttribute("aria-pressed", String(selectedDay === key));
      cell.setAttribute("aria-label", `${dayNames[new Date(y, m - 1, d).getDay()]} ${d} ${monthNames[m - 1]}${year}, ${note.textContent}`);
      cell.addEventListener("click", () => openDay(key));
    }
    cell.append(number, weekday, note);
    return cell;
  }

  // Il giorno si apre sotto la sua riga, con slot, nome/progetto e prenotazione.
  // Ricliccandolo si richiude.
  // Chiusura con la stessa animazione dell'apertura, al contrario.
  function closeDay() {
    const expand = list.querySelector(".agenda-expand");
    selectedDay = null;
    selectedSlot = null;
    bookedMessage = "";
    // Il giorno resta nero finché la fascia non si è richiusa del tutto.
    if (!expand || reducedMotion()) {
      renderDates();
      return;
    }
    // A fascia chiusa si toglie solo la fascia e si spegne la riga, senza ricostruire
    // la lista: ricostruirla faceva lampeggiare la riga sotto il mouse.
    const cell = expand.previousElementSibling;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (selectedDay) return;
      expand.remove();
      list.querySelectorAll('.agenda-cell[aria-pressed="true"]').forEach((item) => item.setAttribute("aria-pressed", "false"));
      if (cell && cell.matches(".agenda-cell")) cell.blur();
    };
    expand.addEventListener("transitionend", finish, { once: true });
    window.setTimeout(finish, 700);
    delete expand.dataset.open;
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function openDay(key) {
    if (selectedDay === key) {
      closeDay();
      return;
    }
    selectedDay = key;
    selectedSlot = null;
    bookedMessage = "";
    renderDates();
    const expand = list.querySelector(".agenda-expand");
    if (!expand) return;
    // La sezione resta ferma: la fascia si apre sotto la riga e chi vuole scorre.
    requestAnimationFrame(() => {
      expand.dataset.open = "";
    });
  }

  let bookedMessage = "";

  function buildExpand() {
    const expand = document.createElement("div");
    expand.className = "agenda-expand";
    expand.innerHTML = `<div class="agenda-expand-inner"><div class="agenda-expand-body"></div></div>`;
    fillExpand(expand.querySelector(".agenda-expand-body"));
    return expand;
  }

  function fillExpand(body) {
    body.innerHTML = `
      <div class="agenda-day-body">
        <div class="agenda-slots" role="group" aria-label="Orari"></div>
        <form class="agenda-form" novalidate></form>
      </div>
`;
    const slots = body.querySelector(".agenda-slots");
    (days[selectedDay] || []).forEach((slot) => {
      const taken = slot.taken;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "agenda-slot";
      button.innerHTML = `<span class="agenda-slot-time">${slot.start}–${slot.end}</span>`;
      button.setAttribute("aria-label", `${slot.start}–${slot.end}, ${taken ? "occupato" : "libero"}`);
      if (taken) {
        button.setAttribute("aria-disabled", "true");
      } else {
        button.setAttribute("aria-pressed", String(selectedSlot === slot.start));
        button.addEventListener("click", () => {
          if (bookedMessage) return;
          selectedSlot = slot.start;
          fillExpand(body);
          const input = body.querySelector("input");
          if (input) input.focus({ preventScroll: true });
        });
      }
      slots.append(button);
    });

    const form = body.querySelector(".agenda-form");
    if (bookedMessage) {
      form.innerHTML = `<p class="agenda-result">${bookedMessage}</p>`;
      return;
    }
    form.innerHTML = `
      <div class="submission-field-row">
        <input name="progetto" placeholder="${selectedSlot ? "Nome / progetto" : "Scegli un orario"}"
          autocomplete="name" ${selectedSlot ? "" : "disabled"} required>
        <button type="submit" class="submission-send" ${selectedSlot ? "" : "disabled"}>Prenota</button>
      </div>
      <p class="agenda-result" hidden></p>`;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const field = form.elements.progetto;
      const name = field.value.trim();
      if (!name) {
        const result = form.querySelector(".agenda-result");
        result.hidden = false;
        result.textContent = "Scrivi il tuo nome o quello del progetto.";
        field.focus();
        return;
      }
      const day = selectedDay;
      const start = selectedSlot;
      const [, m, d] = day.split("-").map(Number);
      const safeName = name.replace(/[<>&]/g, "");
      const done = (note) => {
        const slot = (days[day] || []).find((item) => item.start === start);
        if (slot) slot.taken = true;
        bookedMessage = `Fatto, ${safeName}: ${d} ${monthNames[m - 1]} alle ${start} è tuo. Ti scriviamo per confermare.${note}`;
        selectedSlot = null;
        fillExpand(body);
        refreshCell(day);
      };
      if (!source) {
        // Anteprima: niente viene inviato al foglio.
        done(' <span class="agenda-muted">(Anteprima: non è stato inviato nulla.)</span>');
        return;
      }
      form.querySelector("input").disabled = true;
      form.querySelector(".submission-send").disabled = true;
      // Lo script scrive la riga in Prenotazioni e manda la mail a 9PM.
      fetch(source, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ date: day, start, name }),
      })
        .then((response) => response.json())
        .then((reply) => {
          if (reply.ok) return done("");
          const result = form.querySelector(".agenda-result");
          result.hidden = false;
          result.textContent = reply.error === "taken"
            ? "Qualcuno ha appena preso questo orario: scegline un altro."
            : "Non siamo riusciti a registrare la prenotazione. Riprova tra poco.";
          if (reply.error === "taken") {
            const slot = (days[day] || []).find((item) => item.start === start);
            if (slot) slot.taken = true;
            selectedSlot = null;
            window.setTimeout(() => { fillExpand(body); refreshCell(day); }, 1600);
          } else {
            form.querySelector("input").disabled = false;
            form.querySelector(".submission-send").disabled = false;
          }
        })
        .catch(() => {
          const result = form.querySelector(".agenda-result");
          result.hidden = false;
          result.textContent = "Connessione non riuscita. Riprova tra poco.";
          form.querySelector("input").disabled = false;
          form.querySelector(".submission-send").disabled = false;
        });
    });
  }

  // Aggiorna la nota della casella senza richiudere il giorno.
  function refreshCell(key) {
    const cell = list.querySelector(`[data-day="${key}"]`);
    if (cell) cell.querySelector(".agenda-note").textContent = freeLabel(key);
  }

  function start(slots) {
    setSlots(slots);
    renderDates();
  }

  if (source) {
    fetch(source)
      .then((response) => response.json())
      .then((reply) => start(reply.slots || []))
      .catch(() => start(window.AGENDA_DATA || []));
  } else {
    start(window.AGENDA_DATA || []);
  }
})();
