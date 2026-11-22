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

  const monthLabel = root.querySelector("[data-agenda-month]");
  const grid = root.querySelector("[data-agenda-grid]");
  const prev = root.querySelector("[data-agenda-prev]");
  const next = root.querySelector("[data-agenda-next]");

  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const today = new Date();
  const todayKey = keyOf(today.getFullYear(), today.getMonth(), today.getDate());

  function freeSlots(key) {
    return (days[key] || []).filter((slot) => !slot.taken);
  }

  function dayState(key) {
    if (!days[key] || key < todayKey) return "off";
    return freeSlots(key).length ? "open" : "full";
  }

  // Mesi navigabili: dal primo all'ultimo con sessioni (almeno il mese corrente).
  const monthIndex = (key) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
  let firstMonth = monthIndex(todayKey);
  let lastMonth = firstMonth;
  let current = firstMonth;

  function setRange() {
    const keys = Object.keys(days).filter((key) => key >= todayKey).sort();
    firstMonth = monthIndex(todayKey);
    lastMonth = keys.length ? Math.max(firstMonth, monthIndex(keys[keys.length - 1])) : firstMonth;
    const firstOpen = keys.find((key) => dayState(key) === "open");
    current = firstOpen ? monthIndex(firstOpen) : firstMonth;
  }
  let selectedDay = null;
  let selectedSlot = null;

  function renderMonth() {
    const year = Math.floor(current / 12);
    const month = current % 12;
    monthLabel.textContent = `${monthNames[month]} ${year}`;
    prev.disabled = current <= firstMonth;
    next.disabled = current >= lastMonth;

    const offset = (new Date(year, month, 1).getDay() + 6) % 7; // settimana da lunedì
    const days = new Date(year, month + 1, 0).getDate();
    const cells = Math.ceil((offset + days) / 7) * 7;
    grid.replaceChildren();

    for (let i = 0; i < cells; i += 1) {
      const day = i - offset + 1;
      if (day < 1 || day > days) {
        const empty = document.createElement("div");
        empty.className = "agenda-cell";
        empty.dataset.empty = "";
        if (i % 7 === 0) empty.dataset.firstColumn = "";
        grid.append(empty);
        continue;
      }
      const key = keyOf(year, month, day);
      const state = dayState(key);
      const cell = document.createElement(state === "open" ? "button" : "div");
      cell.className = "agenda-cell";
      cell.dataset.state = state;
      cell.dataset.day = key;
      if (i % 7 === 0) cell.dataset.firstColumn = "";
      const number = document.createElement("span");
      number.className = "agenda-number";
      number.textContent = pad(day);
      const note = document.createElement("span");
      note.className = "agenda-note";
      if (state === "open") {
        const free = freeSlots(key).length;
        note.textContent = free === 1 ? "1 slot libero" : `${free} slot liberi`;
        cell.type = "button";
        cell.setAttribute("aria-pressed", String(selectedDay === key));
        cell.setAttribute("aria-label", `${dayNames[new Date(year, month, day).getDay()]} ${day} ${monthNames[month]}, ${note.textContent}`);
        cell.addEventListener("click", () => openDay(key));
      } else if (state === "full") {
        note.textContent = "completo";
      }
      cell.append(number, note);
      grid.append(cell);
    }
    if (selectedDay) {
      const cellsNow = Array.from(grid.children);
      const index = cellsNow.findIndex((item) => item.dataset.day === selectedDay);
      if (index >= 0) {
        const weekEnd = cellsNow[Math.min(cellsNow.length - 1, Math.floor(index / 7) * 7 + 6)];
        const expand = buildExpand();
        expand.style.setProperty("--from-column", String((index % 7) + 1));
        weekEnd.after(expand);
        if (!animateOpen) expand.dataset.open = "";
      }
    }
  }

  // Il mese è già scritto sopra la griglia: qui solo giorno della settimana e numero.
  function dayTitle(key) {
    const [y, m, d] = key.split("-").map(Number);
    return `${dayNames[new Date(y, m - 1, d).getDay()]} ${d}`;
  }

  // Il giorno si apre dentro la griglia: si allarga sotto la sua settimana,
  // con slot, nome/progetto e prenotazione. Ricliccandolo si richiude.
  // Chiusura con la stessa animazione dell'apertura, al contrario.
  function closeDay() {
    const expand = grid.querySelector(".agenda-expand");
    selectedDay = null;
    selectedSlot = null;
    bookedMessage = "";
    // Il giorno resta nero finché la fascia non si è richiusa del tutto.
    if (!expand || reducedMotion()) {
      renderMonth();
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (!selectedDay) renderMonth();
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
    const opening = true;
    selectedDay = opening ? key : null;
    selectedSlot = null;
    bookedMessage = "";
    animateOpen = opening;
    renderMonth();
    animateOpen = false;
    if (!opening) return;
    const expand = grid.querySelector(".agenda-expand");
    if (!expand) return;
    requestAnimationFrame(() => {
      expand.dataset.open = "";
      const cell = grid.querySelector(`[data-day="${key}"]`);
      window.setTimeout(() => cell && cell.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    });
  }

  let bookedMessage = "";
  let animateOpen = false;

  function buildExpand() {
    const expand = document.createElement("div");
    expand.className = "agenda-expand";
    expand.innerHTML = `<div class="agenda-expand-inner"><div class="agenda-expand-body"></div></div>`;
    fillExpand(expand.querySelector(".agenda-expand-body"));
    return expand;
  }

  function fillExpand(body) {
    body.innerHTML = `
      <h4 class="agenda-day-title">${dayTitle(selectedDay)}</h4>
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
    const cell = grid.querySelector(`[data-day="${key}"]`);
    if (!cell) return;
    const free = freeSlots(key).length;
    cell.querySelector(".agenda-note").textContent = free ? (free === 1 ? "1 slot libero" : `${free} slot liberi`) : "completo";
  }

  prev.addEventListener("click", () => {
    if (current > firstMonth) { current -= 1; selectedDay = null; renderMonth(); }
  });
  next.addEventListener("click", () => {
    if (current < lastMonth) { current += 1; selectedDay = null; renderMonth(); }
  });

  function showMessage(text) {
    grid.replaceChildren();
    const note = document.createElement("p");
    note.className = "agenda-empty";
    note.textContent = text;
    grid.append(note);
  }

  function start(list) {
    setSlots(list);
    setRange();
    renderMonth();
    if (!Object.keys(days).some((key) => key >= todayKey)) {
      showMessage("Le date della stagione arrivano a breve.");
    }
  }

  if (source) {
    monthLabel.textContent = "…";
    fetch(source)
      .then((response) => response.json())
      .then((reply) => start(reply.slots || []))
      .catch(() => start(window.AGENDA_DATA || []));
  } else {
    start(window.AGENDA_DATA || []);
  }
})();
