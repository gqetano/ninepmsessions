(function () {
  "use strict";
  document.querySelectorAll(".submission-form").forEach((form) => {
    const isArtistForm = form.id === "submission-form";
    let resetExtras = () => {};
    const fieldset = form.querySelector("fieldset");
    const button = form.querySelector("button[type=submit]");
    const result = form.querySelector(".submission-result");
    const isOpen = () => form.dataset.submissionsOpen === "true";
    const idleButtonText = button.textContent;
    let sending = false;
    button.disabled = !isOpen();
    fieldset.disabled = !isOpen();
    const marquee = document.querySelector("[data-marquee-text]");
    if (marquee && isArtistForm) {
      marquee.dataset.marqueeText = isOpen()
        ? "OPEN FOR SEASON 3"
        : "Submissions closed — Reopening soon";
      marquee.setAttribute("aria-label", marquee.dataset.marqueeText);
    }
    const fieldSelector = "input:not([type=hidden]):not([type=checkbox]), textarea";
    const fields = [];
    const errors = new Map();
    function fitTextarea(field) {
      if (field.tagName !== "TEXTAREA" || !field.offsetWidth) return;
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    }
    function fitTextareas() { fields.forEach(fitTextarea); }
    let formWidth = 0;
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        const width = form.getBoundingClientRect().width;
        if (width === formWidth) return;
        formWidth = width;
        fitTextareas();
      }).observe(form);
    }
    window.addEventListener("resize", fitTextareas);
    form.addEventListener("reset", () => window.requestAnimationFrame(fitTextareas));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTextareas);

    function registerField(field) {
      fields.push(field);
      const row = document.createElement("div");
      row.className = "submission-field-row";
      field.before(row);
      row.append(field);
      if (field.id === "song-link" || field.id === "song-link-2") row.classList.add("submission-audio-row");
      const error = document.createElement("span");
      error.id = `${field.id}-error`;
      error.className = "submission-field-error";
      error.hidden = true;
      row.append(error);
      const description = field.getAttribute("aria-describedby");
      field.setAttribute("aria-describedby", [description, error.id].filter(Boolean).join(" "));
      errors.set(field, error);
      field.addEventListener("input", () => {
        fitTextarea(field);
        if (field.hasAttribute("aria-invalid")) validateField(field);
      });
      field.addEventListener("focus", () => fitTextarea(field));
      fitTextarea(field);
      return row;
    }
    form.querySelectorAll(fieldSelector).forEach(registerField);
    if (isArtistForm) {
      const notes = document.getElementById("artist-notes");
      const notesHelp = document.getElementById("notes-help");
      const notesInfo = document.createElement("button");
      notesInfo.type = "button";
      notesInfo.className = "submission-notes-info";
      notesInfo.textContent = "i";
      notesInfo.setAttribute("aria-label", "Quali informazioni inserire nelle note");
      notesInfo.setAttribute("aria-controls", "notes-help");
      notesInfo.setAttribute("aria-expanded", "false");
      notes.parentElement.append(notesInfo);
      function closeNotesHelp() {
        notesHelp.hidden = true;
        notesInfo.setAttribute("aria-expanded", "false");
      }
      notesInfo.addEventListener("click", () => {
        notesHelp.hidden = !notesHelp.hidden;
        notesInfo.setAttribute("aria-expanded", String(!notesHelp.hidden));
      });
      notesInfo.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeNotesHelp();
      });
      function createLinkToggle(symbol, label) {
        const control = document.createElement("button");
        control.type = "button";
        control.className = "submission-song-toggle";
        control.textContent = symbol;
        control.setAttribute("aria-label", label);
        return control;
      }
      const firstSong = document.getElementById("song-link");
      const secondSong = document.getElementById("song-link-2");
      const secondContainer = document.getElementById("second-song");
      const addSong = createLinkToggle("+", "Aggiungi un secondo brano");
      addSong.setAttribute("aria-controls", "second-song");
      addSong.setAttribute("aria-expanded", "false");
      firstSong.parentElement.prepend(addSong);
      const removeSong = createLinkToggle("−", "Rimuovi il secondo brano");
      secondSong.parentElement.prepend(removeSong);
      function hideSecondSong() {
        secondContainer.hidden = true;
        secondSong.disabled = true;
        secondSong.value = "";
        secondSong.removeAttribute("aria-invalid");
        errors.get(secondSong).hidden = true;
        addSong.disabled = false;
        addSong.setAttribute("aria-expanded", "false");
      }
      addSong.addEventListener("click", () => {
        secondContainer.hidden = false;
        secondSong.disabled = false;
        addSong.disabled = true;
        addSong.setAttribute("aria-expanded", "true");
        secondSong.focus();
      });
      removeSong.addEventListener("click", () => {
        hideSecondSong();
        addSong.focus();
      });
      const otherLinks = document.getElementById("other-links");
      const firstOtherLink = document.getElementById("artist-links");
      const extraLinks = new Map();
      let extraLinkId = 1;
      const addLink = createLinkToggle("+", "Aggiungi un altro link");
      addLink.setAttribute("aria-controls", "other-links");
      firstOtherLink.parentElement.classList.add("submission-audio-row");
      firstOtherLink.parentElement.prepend(addLink);
      function removeExtraLink(field) {
        const row = extraLinks.get(field);
        if (!row) return;
        fields.splice(fields.indexOf(field), 1);
        errors.delete(field);
        extraLinks.delete(field);
        row.remove();
      }
      addLink.addEventListener("click", () => {
        extraLinkId += 1;
        const field = document.createElement("input");
        field.type = "url";
        field.id = `artist-link-${extraLinkId}`;
        field.name = `link_aggiuntivo_${extraLinkId}`;
        field.maxLength = 2000;
        field.placeholder = "Altri link";
        field.setAttribute("aria-label", `Altro link ${extraLinkId}`);
        otherLinks.append(field);
        const row = registerField(field);
        row.classList.add("submission-audio-row");
        const remove = createLinkToggle("−", `Rimuovi il link ${extraLinkId}`);
        row.prepend(remove);
        extraLinks.set(field, row);
        remove.addEventListener("click", () => {
          removeExtraLink(field);
          addLink.focus();
        });
        field.focus();
      });
      resetExtras = () => {
        hideSecondSong();
        closeNotesHelp();
        Array.from(extraLinks.keys()).forEach(removeExtraLink);
        extraLinkId = 1;
      };
    }
    function validateField(field) {
      if (field.disabled) return true;
      let message = "";
      if (field.required && !field.value.trim()) message = "(Required)";
      else if (field.validity.typeMismatch) message = field.type === "email"
        ? "(Email non valida)"
        : "(Link non valido)";
      else if (field.type === "url" && field.value && !/^https?:\/\//i.test(field.value))
        message = "(Usa https:// o http://)";
      else if (!field.validity.valid) message = "(Controlla il campo)";
      const error = errors.get(field);
      error.textContent = message;
      error.hidden = !message;
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
      return !message;
    }
    function validateForm() {
      const invalid = Array.from(form.querySelectorAll(fieldSelector)).filter((field) => !validateField(field));
      if (!invalid.length) return true;
      result.textContent = "";
      invalid[0].focus();
      invalid[0].scrollIntoView({ block: "center", behavior: "instant" });
      return false;
    }
    // Invio gestito solo qui: nessun POST nativo, anche a candidature chiuse.
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!isOpen() || sending) return;
      if (!validateForm()) return;
      const payload = Object.fromEntries(new FormData(form));
      if (payload.botcheck) return;
      delete payload.botcheck;
      sending = true;
      fieldset.disabled = true;
      form.setAttribute("aria-busy", "true");
      button.textContent = "Invio in corso…";
      result.textContent = "";
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || data.success !== true) throw new Error("submission-failed");
        form.reset();
        resetExtras();
        fields.forEach((field) => {
          field.removeAttribute("aria-invalid");
          errors.get(field).hidden = true;
        });
        result.textContent = isArtistForm ? "Grazie! La tua candidatura è stata inviata. Se la proposta è in linea con il format, ti contatteremo via email." : "Grazie! La tua proposta di collaborazione è stata inviata. Ti ricontatteremo per approfondire.";
      } catch (error) {
        result.textContent = error.name === "AbortError"
          ? "La conferma tarda ad arrivare: non possiamo verificare l’esito dell’invio. I dati sono ancora qui; riprova più tardi per evitare un doppio invio."
          : "Non siamo riusciti a confermare l’invio. I dati sono ancora qui: controlla la connessione e riprova più tardi.";
      } finally {
        window.clearTimeout(timeout);
        sending = false;
        fieldset.disabled = !isOpen();
        form.removeAttribute("aria-busy");
        button.textContent = idleButtonText;
      }
    });
  });
})();
