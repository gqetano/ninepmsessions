(function () {
  const deck = document.querySelector(".deck");
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  const knownPanels = new Set(panels.map((panel) => panel.dataset.panel));
  const root = document.documentElement;
  // La fascia appartiene alla sezione che la contiene, anche se viene spostata.
  panels.forEach((panel) => {
    if (panel.querySelector(":scope > [data-marquee-text]")) {
      panel.style.setProperty("--panel-banner-height", "var(--marquee-height)");
      deck.style.setProperty(`--${panel.dataset.panel}-banner-height`, "var(--marquee-height)");
    }
  });
  const panelDuration = 700;
  const panelEase = cubicBezier(0.16, 1, 0.3, 1);
  let panelAnimationFrame;
  let panelDrag;
  let wheelReleaseTimer;
  let resizeFrame;
  const colophonPanel = panels.find((panel) => panel.dataset.panel === "colophon");

  function getTime() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  }

  function requestFrame(callback) {
    if (typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(callback);
    }

    return window.setTimeout(() => callback(getTime()), 16);
  }

  function cancelFrame(frame) {
    if (typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(frame);
      return;
    }

    window.clearTimeout(frame);
  }

  function cubicBezier(x1, y1, x2, y2) {
    function sampleCurveX(t) {
      return ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t;
    }

    function sampleCurveY(t) {
      return ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
    }

    function sampleCurveDerivativeX(t) {
      return (3 * (1 - 3 * x2 + 3 * x1) * t + 2 * (3 * x2 - 6 * x1)) * t + 3 * x1;
    }

    return function solve(x) {
      let t = x;

      for (let i = 0; i < 6; i += 1) {
        const currentX = sampleCurveX(t) - x;
        const derivative = sampleCurveDerivativeX(t);

        if (Math.abs(currentX) < 0.001 || Math.abs(derivative) < 0.001) {
          break;
        }

        t -= currentX / derivative;
      }

      return sampleCurveY(Math.min(1, Math.max(0, t)));
    };
  }

  function parseRows(rows) {
    return rows.split(" ").map((row) => Number.parseFloat(row));
  }

  function formatRows(rows) {
    return rows.map((row) => `${row.toFixed(3)}px`).join(" ");
  }

  function createMarqueePair(text) {
    const fragment = document.createDocumentFragment();
    const phrase = document.createElement("span");
    const separator = document.createElement("span");

    phrase.textContent = text;
    separator.textContent = "•";
    fragment.append(phrase, separator);

    return fragment;
  }

  // La fascia si ricostruisce solo se cambia la sua larghezza o la dimensione del
  // testo (sul telefono "resize" arriva anche quando compare o sparisce la barra del
  // browser). Ricostruendola, riprende dal punto in cui era: niente salto.
  let marqueeBuiltFor = "";
  function buildSubmissionMarquee() {
    const marquee = document.querySelector("[data-marquee-text]");
    const track = marquee && marquee.firstElementChild;

    if (!marquee || !track || !marquee.clientWidth) {
      return;
    }

    const signature = `${marquee.clientWidth}|${getComputedStyle(marquee).fontSize}`;
    if (signature === marqueeBuiltFor) return;
    marqueeBuiltFor = signature;

    const running = track.getAnimations ? track.getAnimations()[0] : null;
    const elapsed = running ? running.currentTime : null;
    const text = marquee.dataset.marqueeText || "";
    const group = document.createElement("span");

    track.innerHTML = "";
    group.append(createMarqueePair(text));
    track.append(group);

    const minimumGroupWidth = marquee.clientWidth * 2;

    while (group.scrollWidth < minimumGroupWidth && group.childNodes.length < 400) {
      group.append(createMarqueePair(text));
    }

    const clone = group.cloneNode(true);

    clone.setAttribute("aria-hidden", "true");
    track.append(clone);
    track.style.animation = "none";
    track.getBoundingClientRect();
    track.style.animation = "";
    const restarted = track.getAnimations ? track.getAnimations()[0] : null;
    if (restarted && elapsed != null) restarted.currentTime = elapsed;
  }

  function calibrateTitleSize() {
    const referenceTitle = document.querySelector("[data-panel] > .panel-title > button > span");
    const referenceTab = document.querySelector("[data-panel] > .panel-title > button");
    const titleStyle = getComputedStyle(referenceTitle);
    const horizontalPadding =
      parseFloat(titleStyle.paddingLeft) + parseFloat(titleStyle.paddingRight);
    const availableWidth = Math.max(1, referenceTab.clientWidth - horizontalPadding);
    const baseSize = 100;
    const previousSize = root.style.getPropertyValue("--label-size");

    root.style.setProperty("--label-size", `${baseSize}px`);
    const measuredWidth = Math.max(
      1,
      referenceTitle.getBoundingClientRect().width - horizontalPadding,
    );

    if (previousSize) {
      root.style.setProperty("--label-size", previousSize);
    } else {
      root.style.removeProperty("--label-size");
    }

    const size = (availableWidth / measuredWidth) * baseSize;

    root.style.setProperty("--label-size", `${size.toFixed(4)}px`);
  }

  function scheduleTitleCalibration() {
    cancelFrame(resizeFrame);
    resizeFrame = requestFrame(() => {
      calibrateTitleSize();
      buildSubmissionMarquee();
      pinColophonFooter();
    });
  }

  // Le schede sopra quella aperta spariscono (altezza zero) e lei
  // prende tutto lo spazio; quelle sotto restano come linguette. Va applicato anche
  // quando si misura lo stato d'arrivo di un trascinamento, altrimenti le righe
  // d'arrivo non sommano l'altezza dello schermo e si vede il fondo arancione.
  function setCollapsedAbove(panelName) {
    const activeIndex = panels.findIndex((panel) => panel.dataset.panel === panelName);
    panels.forEach((panel, index) => {
      const variable = `--${panel.dataset.panel}-row`;
      if (deck.dataset.stackMode === "collapse-above" && index < activeIndex) {
        deck.style.setProperty(variable, "0px");
        panel.dataset.above = "";
      } else {
        deck.style.removeProperty(variable);
        delete panel.dataset.above;
      }
    });
  }

  function applyPanelState(panelName) {
    const previousPanel = deck.dataset.active;
    deck.dataset.active = panelName;
    setCollapsedAbove(panelName);
    syncSiteMenu(panelName);
    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === panelName;
      const tab = panel.querySelector("button");
      // Il contenuto delle sezioni chiuse non è raggiungibile da Tab né dagli screen reader.
      const content = panel.querySelector(":scope > .panel-content");
      if (content) content.inert = !isActive;

      if (!isActive && tab.getAttribute("aria-expanded") === "true") {
        panel.dataset.peekDismissed = "true";
      } else if (isActive) {
        delete panel.dataset.peekDismissed;
      }
      tab.setAttribute("aria-expanded", String(isActive));
      if (!isActive || previousPanel !== panelName) {
        panel.scrollTop = 0;
      }
    });
    resetOverscroll();
    updateScrollEnds();
    // All'apertura la barra si mostra un attimo: dice subito se c'è altro testo.
    if (previousPanel !== panelName) {
      const opened = panels.find((panel) => panel.dataset.panel === panelName);
      if (opened) wakeScrollBar(opened, scrollBarOpenDelay);
    }
  }

  // Barra di scorrimento: una per sezione, fissa sotto il titolo. Il cursore è
  // proporzionale al testo visibile e tocca il fondo quando il testo è finito.
  const scrollBars = new Map();
  panels.forEach((panel) => {
    const tab = panel.querySelector(":scope > .panel-title > button");
    if (!tab) return;
    const bar = document.createElement("div");
    bar.className = "scroll-bar";
    bar.setAttribute("aria-hidden", "true");
    bar.append(document.createElement("span"));
    tab.parentElement.after(bar);
    scrollBars.set(panel, bar);
  });

  function updateScrollEnd(panel) {
    const bar = scrollBars.get(panel);
    if (!bar) return;
    const tab = panel.querySelector(":scope > .panel-title > button");
    const banner = panel.querySelector(":scope > [data-marquee-text]");
    const header = tab.offsetHeight + (banner ? banner.offsetHeight : 0);
    const inset = 8;
    const track = panel.clientHeight - header - inset * 2;
    const scrollable = panel.scrollHeight - panel.clientHeight;
    const visible = scrollable > 2 && track > 40;
    bar.dataset.visible = String(visible);
    if (!visible) return;
    const thumb = Math.max(24, track * (panel.clientHeight - header) / (panel.scrollHeight - header));
    const offset = (track - thumb) * Math.min(1, Math.max(0, panel.scrollTop / scrollable));
    bar.style.setProperty("--scroll-bar-top", `${header + inset}px`);
    bar.style.setProperty("--scroll-bar-track", `${track.toFixed(1)}px`);
    bar.style.setProperty("--scroll-bar-thumb", `${thumb.toFixed(1)}px`);
    bar.style.setProperty("--scroll-bar-offset", `${offset.toFixed(1)}px`);
  }

  function updateScrollEnds() {
    panels.forEach(updateScrollEnd);
  }

  // La barra resta nascosta finché non serve: compare quando si scorre e
  // sparisce dopo una breve pausa; col mouse vicino al bordo destro resta visibile.
  const scrollBarHideDelay = 900;
  const scrollBarOpenDelay = 1400;
  const scrollBarHoverZone = 56;
  let scrollBarHover = null;

  function wakeScrollBar(panel, delay = scrollBarHideDelay) {
    const bar = scrollBars.get(panel);
    if (!bar) return;
    bar.dataset.awake = "true";
    window.clearTimeout(bar.hideTimer);
    if (scrollBarHover === panel) return;
    bar.hideTimer = window.setTimeout(() => {
      if (scrollBarHover !== panel) delete bar.dataset.awake;
    }, delay);
  }

  deck.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const panel = panels.find((item) => item.dataset.panel === deck.dataset.active);
    const rect = panel ? panel.getBoundingClientRect() : null;
    const near = rect && event.clientX >= rect.right - scrollBarHoverZone &&
      event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (near && scrollBarHover !== panel) {
      scrollBarHover = panel;
      wakeScrollBar(panel);
    } else if (!near && scrollBarHover) {
      const left = scrollBarHover;
      scrollBarHover = null;
      wakeScrollBar(left);
    }
  }, { passive: true });
  deck.addEventListener("pointerleave", () => {
    if (!scrollBarHover) return;
    const left = scrollBarHover;
    scrollBarHover = null;
    wakeScrollBar(left);
  });

  // Fine del testo: come il rimbalzo di iOS. Il testo arriva al bordo con la sua
  // velocità, lo supera un po' (lasciando un vuoto) e torna subito indietro con una
  // molla smorzata. Col dito appoggiato il testo segue il dito, con resistenza.
  const springOmega = 8; // rigidità della molla (1/s): ~0,12 s per il picco, ~0,5 s per tornare
  const overscroll = { panel: null, content: null, x: 0, v: 0, x0: 0, v0: 0, start: 0, frame: 0, drag: 0 };

  function overscrollLimit(panel) {
    return Math.min(150, panel.clientHeight * 0.25);
  }

  function renderOverscroll() {
    if (!overscroll.content) return;
    const limit = overscrollLimit(overscroll.panel) * 1.15;
    const shown = Math.max(-limit, Math.min(limit, overscroll.x));
    overscroll.content.style.transform = Math.abs(shown) < 0.3 ? "" : `translateY(${(-shown).toFixed(2)}px)`;
    // La barra segue il rimbalzo: si schiaccia contro il bordo verso cui si spinge.
    const bar = scrollBars.get(overscroll.panel);
    if (!bar) return;
    const thumb = parseFloat(bar.style.getPropertyValue("--scroll-bar-thumb")) || 0;
    const squash = Math.min(thumb * 0.55, Math.abs(shown) * 0.9);
    if (squash < 0.3) {
      bar.style.removeProperty("--scroll-bar-squash");
      bar.style.removeProperty("--scroll-bar-squash-shift");
      return;
    }
    bar.style.setProperty("--scroll-bar-squash", `${squash.toFixed(2)}px`);
    bar.style.setProperty("--scroll-bar-squash-shift", shown > 0 ? `${squash.toFixed(2)}px` : "0px");
  }

  // Dopo il rimbalzo serve una pausa prima di poter passare alla sezione successiva:
  // il ritorno del testo (e l'inerzia del trackpad) non deve valere come nuovo scroll.
  const bounceQuiet = 450;
  let overscrollSettledAt = -Infinity;

  function bounceLocked(panel, now) {
    if (overscroll.panel === panel && (overscroll.frame || Math.abs(overscroll.x) >= 0.3)) return true;
    return now - overscrollSettledAt < bounceQuiet;
  }

  function resetOverscroll() {
    if (overscroll.panel && (overscroll.frame || Math.abs(overscroll.x) >= 0.3)) overscrollSettledAt = getTime();
    if (overscroll.frame) cancelFrame(overscroll.frame);
    overscroll.frame = 0;
    overscroll.x = overscroll.v = overscroll.drag = 0;
    renderOverscroll();
    overscroll.panel = null;
    overscroll.content = null;
  }

  function attachOverscroll(panel) {
    if (overscroll.panel === panel) return true;
    resetOverscroll();
    const content = panel.querySelector(":scope > .panel-content");
    if (!content) return false;
    overscroll.panel = panel;
    overscroll.content = content;
    return true;
  }

  function stepSpring(now) {
    const t = Math.max(0, now - overscroll.start) / 1000;
    const a = overscroll.x0;
    const b = overscroll.v0 + springOmega * a;
    const decay = Math.exp(-springOmega * t);
    overscroll.x = (a + b * t) * decay;
    overscroll.v = (b - springOmega * (a + b * t)) * decay;
    renderOverscroll();
    if (t > 0.1 && Math.abs(overscroll.x) < 0.3 && Math.abs(overscroll.v) < 30) {
      overscroll.frame = 0;
      resetOverscroll();
      return;
    }
    overscroll.frame = requestFrame(stepSpring);
  }

  function startSpring(velocity = 0) {
    if (overscroll.frame) cancelFrame(overscroll.frame);
    overscroll.x0 = overscroll.x;
    overscroll.v0 = velocity;
    overscroll.drag = 0;
    overscroll.start = getTime();
    overscroll.frame = requestFrame(stepSpring);
  }

  // Il testo sbatte contro il bordo a una certa velocità (px/s, positiva verso la fine).
  function kickOverscroll(panel, velocity) {
    if (!velocity || reducedMotion.matches || !attachOverscroll(panel)) return false;
    // Velocità massima tale che il picco non superi il limite.
    const maxSpeed = overscrollLimit(panel) * springOmega * Math.E;
    const speed = Math.max(-maxSpeed, Math.min(maxSpeed, overscroll.v + velocity));
    startSpring(speed);
    wakeScrollBar(panel);
    return true;
  }

  function overscrollActive(panel) {
    return overscroll.panel === panel && Math.abs(overscroll.x) >= 0.3;
  }

  // Dito appoggiato oltre il bordo: il testo lo segue con una resistenza crescente.
  // Restituisce true finché l'elastico è teso.
  function dragOverscroll(panel, delta) {
    if (!delta || reducedMotion.matches || !attachOverscroll(panel)) return false;
    const limit = overscrollLimit(panel);
    if (overscroll.frame) {
      cancelFrame(overscroll.frame);
      overscroll.frame = 0;
      // Riprende dal punto in cui si trova la molla.
      const ratio = Math.min(0.95, Math.abs(overscroll.x) / limit);
      overscroll.drag = Math.sign(overscroll.x) * -limit * 2 * Math.log(1 - ratio);
    }
    const previous = overscroll.drag;
    const drag = previous + delta;
    if (previous && Math.sign(drag) !== Math.sign(previous)) {
      resetOverscroll();
      return false;
    }
    overscroll.drag = drag;
    overscroll.x = Math.sign(drag) * limit * (1 - Math.exp(-Math.abs(drag) / (limit * 2)));
    overscroll.v = 0;
    renderOverscroll();
    wakeScrollBar(panel);
    return true;
  }

  function releaseOverscroll() {
    if (overscroll.panel && !overscroll.frame && overscroll.x) startSpring(0);
  }

  function animatePanelState(panelName, duration = panelDuration) {
    const startRows = parseRows(getComputedStyle(deck).gridTemplateRows);

    if (panelAnimationFrame) {
      cancelFrame(panelAnimationFrame);
      panelAnimationFrame = null;
    }

    const changesPanel = deck.dataset.active !== panelName;
    const openingPanel = panels.find((panel) => panel.dataset.panel === panelName);
    deck.style.transition = "none";
    deck.style.gridTemplateRows = "";
    applyPanelState(panelName);

    const targetRows = parseRows(getComputedStyle(deck).gridTemplateRows);
    const startedAt = getTime();

    deck.style.gridTemplateRows = formatRows(startRows);
    deck.getBoundingClientRect();

    function step(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const easedProgress = panelEase(progress);
      const currentRows = startRows.map((row, index) => {
        const targetRow = targetRows[index] || 0;

        return row + (targetRow - row) * easedProgress;
      });

      deck.style.gridTemplateRows = formatRows(currentRows);
      if (changesPanel) openingPanel.scrollTop = 0;

      if (progress < 1) {
        panelAnimationFrame = requestFrame(step);
        return;
      }

      deck.style.gridTemplateRows = "";
      deck.style.transition = "";
      if (changesPanel) openingPanel.scrollTop = 0;
      panelAnimationFrame = null;
    }

    panelAnimationFrame = requestFrame(step);
  }

  function setActivePanel(panelName, shouldAnimate = true) {
    discardPanelDrag();
    resetSubmissionIdle();
    if (!knownPanels.has(panelName)) {
      panelName = "home";
    }

    const canAnimate =
      shouldAnimate &&
      deck.dataset.active !== panelName &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (canAnimate) {
      animatePanelState(panelName);
    } else {
      if (panelAnimationFrame) {
        cancelFrame(panelAnimationFrame);
        panelAnimationFrame = null;
      }

      deck.style.gridTemplateRows = "";
      deck.style.transition = "";
      applyPanelState(panelName);
    }
  }

  panels.forEach((panel) => {
    const tab = panel.querySelector("button");

    panel.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") delete panel.dataset.peekDismissed;
    });
    tab.addEventListener("blur", () => { delete panel.dataset.peekDismissed; });

    tab.addEventListener("click", () => {
      const panelName = panel.dataset.panel;
      const nextPanel = deck.dataset.active === panelName && panelName !== "home"
        ? "home"
        : panelName;

      setActivePanel(nextPanel);
    });
  });

  // Il tondo 9PM in basso a destra apre l'elenco delle sezioni
  // (passandoci sopra col mouse o toccandolo) e porta direttamente alla scheda.
  const siteMenu = document.querySelector("[data-site-menu]");
  const siteMenuToggle = siteMenu && siteMenu.querySelector("[data-site-menu-toggle]");
  function setSiteMenuOpen(open) {
    if (!siteMenu) return;
    siteMenu.dataset.open = String(open);
    siteMenuToggle.setAttribute("aria-expanded", String(open));
    siteMenuToggle.setAttribute("aria-label", open ? "Chiudi il menu" : "Apri il menu");
  }
  function syncSiteMenu(panelName) {
    if (!siteMenu) return;
    siteMenu.querySelectorAll("[data-menu-target]").forEach((item) => {
      if (item.dataset.menuTarget === panelName) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    });
  }
  if (siteMenu) {
    const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)");
    let closeTimer = 0;
    siteMenu.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || !hoverCapable.matches) return;
      window.clearTimeout(closeTimer);
      setSiteMenuOpen(true);
    });
    siteMenu.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse" || !hoverCapable.matches) return;
      closeTimer = window.setTimeout(() => setSiteMenuOpen(false), 220);
    });
    // Col mouse il menu è già aperto dal passaggio sopra: il clic non lo richiude.
    siteMenuToggle.addEventListener("click", (event) => {
      if (event.pointerType === "mouse" && hoverCapable.matches) setSiteMenuOpen(true);
      else setSiteMenuOpen(siteMenu.dataset.open !== "true");
    });
    siteMenu.querySelectorAll("[data-menu-target]").forEach((item) => {
      item.addEventListener("click", () => {
        setActivePanel(item.dataset.menuTarget);
        setSiteMenuOpen(false);
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && siteMenu.dataset.open === "true") {
        setSiteMenuOpen(false);
        siteMenuToggle.focus();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (siteMenu.dataset.open === "true" && !siteMenu.contains(event.target)) setSiteMenuOpen(false);
    });
    setSiteMenuOpen(false);
  }

  // Prova disattivabile con data-scroll-navigation="false" sul main.
  const editableFields = "input, textarea, select, [contenteditable]";
  let touchNavigation;
  let wheelNavigation;
  let wheelTail = false;
  let lastWheelTime = -Infinity;
  let lastWheelDelta = 0;
  let wheelSpeed = 0;
  let bounceSpent = false;
  let lastKickAt = -Infinity;
  let lastContentScrollTime = -Infinity;
  let lastEdgePush = -Infinity;
  const edgeCooldown = 350;
  let navigationLockedUntil = 0;

  function canScrollNavigate(target) {
    return deck.dataset.scrollNavigation !== "false" && !panelAnimationFrame &&
      getTime() >= navigationLockedUntil;
  }

  function captureNavigation() {
    const panel = panels.find((item) => item.dataset.panel === deck.dataset.active);
    return {
      panel,
      atTop: panel.scrollTop <= 2,
      atBottom: panel.scrollHeight - panel.clientHeight - panel.scrollTop <= 2,
    };
  }

  function adjacentPanel(gesture, direction) {
    if (document.activeElement && document.activeElement.closest(editableFields)) return null;
    if (!gesture || gesture.panel.dataset.panel !== deck.dataset.active) return null;
    const stillAtEdge = direction > 0
      ? gesture.panel.scrollHeight - gesture.panel.clientHeight - gesture.panel.scrollTop <= 2
      : gesture.panel.scrollTop <= 2;
    if (!(direction > 0 ? gesture.atBottom : gesture.atTop) || !stillAtEdge) return null;
    return panels[panels.indexOf(gesture.panel) + direction] || null;
  }

  function discardPanelDrag() {
    window.clearTimeout(wheelReleaseTimer);
    if (!panelDrag) return;
    const original = panelDrag;
    panelDrag = null;
    delete deck.dataset.panelDrag;
    deck.style.gridTemplateRows = "";
    deck.style.transition = "";
    original.panel.scrollTop = original.scrollTop;
  }

  function dragPanel(gesture, next, distance) {
    if (!panelDrag) {
      resetSubmissionIdle();
      resetOverscroll();
      deck.dataset.panelDrag = "true";
      deck.style.transition = "none";
      const startRows = parseRows(getComputedStyle(deck).gridTemplateRows);
      const from = deck.dataset.active;
      const scrollTop = gesture.panel.scrollTop;
      deck.dataset.active = next.dataset.panel;
      setCollapsedAbove(next.dataset.panel);
      const targetRows = parseRows(getComputedStyle(deck).gridTemplateRows);
      deck.dataset.active = from;
      setCollapsedAbove(from);
      const fullTravel = Math.max(120, Math.abs(targetRows[panels.indexOf(next)] - startRows[panels.indexOf(next)]));
      const travel = fullTravel;
      panelDrag = { panel: gesture.panel, from, to: next.dataset.panel,
        startRows, targetRows, scrollTop, progress: 0, travel, input: gesture.input,
        // Basta un gesto breve: ~60px di rotella, ~56px di dito (max 22% della corsa).
        commitProgress: Math.min(0.22, (gesture.input === "wheel" ? 60 : 56) / travel),
      };
    }
    if (panelDrag.to !== next.dataset.panel) return;
    panelDrag.progress = Math.min(1, Math.max(0, distance / panelDrag.travel));
    if (!reducedMotion.matches) {
      deck.style.gridTemplateRows = formatRows(panelDrag.startRows.map((row, index) =>
        row + (panelDrag.targetRows[index] - row) * panelDrag.progress
      ));
    }
  }

  function releasePanelDrag(cancel = false, flick = false) {
    window.clearTimeout(wheelReleaseTimer);
    if (!panelDrag) return;
    const drag = panelDrag;
    panelDrag = null;
    if (drag.input === "wheel") {
      wheelNavigation = null;
      wheelTail = true;
    }
    // Uno swipe veloce ("flick") conferma anche se breve (almeno 12px).
    const commit = !cancel &&
      (drag.progress >= drag.commitProgress || (flick && drag.progress * drag.travel >= 12));
    const destination = commit ? drag.to : drag.from;
    const duration = Math.max(300, Math.min(650, panelDuration * (commit ? 1 - drag.progress : drag.progress)));
    if (reducedMotion.matches) {
      deck.style.gridTemplateRows = "";
      deck.style.transition = "";
      applyPanelState(destination);
    } else {
      animatePanelState(destination, duration);
    }
    delete deck.dataset.panelDrag;
    if (!commit) drag.panel.scrollTop = drag.scrollTop;
    navigationLockedUntil = getTime() + (reducedMotion.matches ? 0 : duration);
    resetSubmissionIdle();
  }

  function routePanelScroll(panel, delta) {
    panel.scrollTop = Math.max(0, Math.min(panel.scrollHeight - panel.clientHeight,
      panel.scrollTop + delta));
  }

  deck.addEventListener("touchstart", (event) => {
    touchNavigation = null;
    if (event.touches.length !== 1 || !canScrollNavigate(event.target)) return;
    const touch = event.touches[0];
    touchNavigation = { ...captureNavigation(), x: touch.clientX, y: touch.clientY,
      lastY: touch.clientY, next: null, direction: 0, samples: [] };
    touchNavigation.routed = event.target.closest("[data-panel]") !== touchNavigation.panel ||
      Boolean(event.target.closest(".submission-form"));
  }, { passive: true, capture: true });

  deck.addEventListener("touchmove", (event) => {
    if (!touchNavigation) return;
    if (event.touches.length !== 1 || !canScrollNavigate(event.target)) {
      touchNavigation = null;
      releasePanelDrag(true);
      return;
    }
    const dx = event.touches[0].clientX - touchNavigation.x;
    const dy = event.touches[0].clientY - touchNavigation.y;
    const sampleTime = getTime();
    touchNavigation.samples.push({ t: sampleTime, y: event.touches[0].clientY });
    touchNavigation.samples = touchNavigation.samples.filter((sample) => sampleTime - sample.t <= 120);
    if (!panelDrag && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      touchNavigation = null;
      return;
    }
    if (!panelDrag && (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(dx) * 1.3)) return;
    if (panelDrag) {
      if (event.cancelable) event.preventDefault();
      dragPanel(touchNavigation, touchNavigation.next, -dy * touchNavigation.direction);
      return;
    }
    const direction = dy < 0 ? 1 : -1;
    const next = bounceLocked(touchNavigation.panel, getTime()) ? null : adjacentPanel(touchNavigation, direction);
    if (!next) {
      const step = touchNavigation.lastY - event.touches[0].clientY;
      const panel = touchNavigation.panel;
      if (touchNavigation.routed) {
        if (event.cancelable) event.preventDefault();
        const before = panel.scrollTop;
        routePanelScroll(panel, step);
        const leftover = step - (panel.scrollTop - before);
        if (Math.abs(leftover) > 0.5) dragOverscroll(panel, leftover);
      } else if (step) {
        // Lo scroll nativo è arrivato al bordo: da qui il dito tende l'elastico.
        const atEdge = step > 0
          ? panel.scrollHeight - panel.clientHeight - panel.scrollTop <= 1
          : panel.scrollTop <= 1;
        if (overscrollActive(panel) || atEdge) {
          if (dragOverscroll(panel, step) && event.cancelable) event.preventDefault();
        }
      }
      touchNavigation.lastY = event.touches[0].clientY;
      return;
    }
    if (event.cancelable) event.preventDefault();
    touchNavigation.next = next;
    touchNavigation.direction = direction;
    dragPanel(touchNavigation, next, Math.abs(dy));
  }, { passive: false, capture: true });

  deck.addEventListener("touchend", (event) => {
    const gesture = touchNavigation;
    touchNavigation = null;
    let flick = false;
    if (gesture && panelDrag && gesture.samples.length >= 2) {
      const first = gesture.samples[0];
      const last = gesture.samples[gesture.samples.length - 1];
      const speed = ((first.y - last.y) * gesture.direction) / Math.max(1, last.t - first.t);
      flick = speed >= 0.3 && getTime() - last.t < 80;
    }
    releasePanelDrag(!canScrollNavigate(event.target), flick);
    releaseOverscroll();
  }, { passive: true, capture: true });
  deck.addEventListener("touchcancel", () => {
    touchNavigation = null;
    releaseOverscroll();
    releasePanelDrag(true);
  }, { passive: true });

  // Un unico gestore possiede lo scroll verticale, anche sopra titoli e form.
  deck.addEventListener("wheel", (event) => {
    if (event.ctrlKey || deck.dataset.scrollNavigation === "false" ||
        !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (event.cancelable) event.preventDefault();

    const now = getTime();
    const gap = now - lastWheelTime;
    lastWheelTime = now;
    const panel = panels.find((item) => item.dataset.panel === deck.dataset.active);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? panel.clientHeight : 1;
    const delta = event.deltaY * unit;
    const magnitude = Math.abs(delta);
    // Scatti separati della rotella, rispetto agli eventi ravvicinati del trackpad.
    const wheelNotch = gap >= 50 && magnitude >= 40 &&
      (event.deltaMode !== 0 || Math.abs(magnitude - lastWheelDelta) <= magnitude * 0.25);
    // Un nuovo swipe sul trackpad, anche sopra l'inerzia del precedente: il delta risale.
    const accelerating = gap < 160 && magnitude >= 20 && magnitude > lastWheelDelta * 2;
    lastWheelDelta = magnitude;
    // Velocità dello scroll (px/s): serve a dare forza al rimbalzo di fine testo.
    const instantSpeed = gap < 100 ? (delta / Math.max(8, gap)) * 1000 : delta * 10;
    wheelSpeed = gap < 100 && Math.sign(instantSpeed) === Math.sign(wheelSpeed)
      ? wheelSpeed * 0.4 + instantSpeed * 0.6
      : instantSpeed;

    if (panelAnimationFrame || now < navigationLockedUntil) {
      wheelNavigation = null;
      wheelTail = true;
      return;
    }
    if (wheelTail) {
      // Lascia terminare i piccoli eventi residui; un impulso nuovo sblocca subito.
      // L'inerzia residua (eventi ravvicinati e decrescenti) non scorre la nuova sezione;
      // un nuovo swipe (delta che risale) o un nuovo scatto di rotella sblocca subito.
      if (gap < 160 && !accelerating && !wheelNotch) return;
      wheelTail = false;
      wheelNavigation = null;
    }

    const freshGesture = !wheelNavigation || gap > 160 ||
      ((wheelNotch || accelerating) && !panelDrag) || wheelNavigation.panel !== panel;
    if (freshGesture) {
      wheelNavigation = { ...captureNavigation(), input: "wheel", distance: 0,
        direction: Math.sign(delta), next: null };
    }
    const gesture = wheelNavigation;
    // Il testo ha appena smesso di scorrere (o si sta ancora spingendo contro il bordo):
    // lo scroll che arriva in fondo non deve anche cambiare sezione. Serve una pausa
    // di almeno edgeCooldown ms senza input, poi un nuovo scroll.
    // Un nuovo swipe netto (delta che risale con decisione) è ammesso dopo 250ms dall'ultimo
    // movimento del testo, anche sopra l'inerzia del precedente.
    const movedAgo = now - lastContentScrollTime;
    // Durante e subito dopo il rimbalzo l'inerzia non cambia sezione; un nuovo swipe
    // deciso sì, appena il rimbalzo ha raggiunto il punto più lontano.
    const freshSwipe = (accelerating || wheelNotch) && now - lastKickAt > 180;
    const bouncing = !gesture.next && !freshSwipe && bounceLocked(panel, now);
    const settling = bouncing || (!gesture.next && (accelerating
      ? movedAgo < 250
      : Math.min(movedAgo, now - lastEdgePush) < edgeCooldown));
    const next = gesture.next || (settling ? null : adjacentPanel(gesture, Math.sign(delta)));
    if (!next) {
      const scrollBefore = panel.scrollTop;
      routePanelScroll(panel, delta);
      const moved = panel.scrollTop - scrollBefore;
      if (moved) lastContentScrollTime = now;
      else if (bouncing || (settling && !accelerating)) lastEdgePush = now;
      // Il testo è arrivato al bordo: un solo rimbalzo con la velocità che aveva.
      // L'inerzia che continua ad arrivare non lo prolunga; un nuovo gesto sì.
      const leftover = delta - moved;
      // Un solo rimbalzo per gesto: l'inerzia del trackpad (che sul Mac dura oltre
      // un secondo) non deve farne partire un secondo dopo il primo. Si riarma solo
      // dopo una pausa vera o con un gesto nuovo (swipe deciso o scatto di rotella).
      if (gap > 160 || accelerating || wheelNotch) bounceSpent = false;
      // Il rimbalzo parte solo se il testo stava scorrendo e arriva al bordo adesso.
      // Se il testo era già fermo in fondo, lo scroll passa alla sezione successiva.
      const arriving = moved !== 0 || now - lastContentScrollTime < 120;
      if (Math.abs(leftover) > 0.5 && !bounceSpent && arriving) {
        const speed = Math.max(900, Math.min(4000, Math.abs(wheelSpeed)));
        kickOverscroll(panel, Math.sign(leftover) * speed);
        bounceSpent = true;
        lastKickAt = now;
      }
      return;
    }
    if (!gesture.next) gesture.direction = Math.sign(delta);
    gesture.next = next;
    gesture.distance = Math.max(0, gesture.distance + delta * gesture.direction);
    dragPanel(gesture, next, gesture.distance);
    window.clearTimeout(wheelReleaseTimer);
    wheelReleaseTimer = window.setTimeout(() => releasePanelDrag(), 160);
    // Conferma subito al raggiungimento della soglia, senza attendere la pausa.
    if (panelDrag && panelDrag.progress >= panelDrag.commitProgress) releasePanelDrag();
  }, { passive: false, capture: true });

  window.addEventListener("resize", discardPanelDrag);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) discardPanelDrag();
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      calibrateTitleSize();
      // Col font vero le parole cambiano larghezza: la fascia va rimisurata.
      marqueeBuiltFor = "";
      buildSubmissionMarquee();
    });
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let submissionIdleTimer;
  let submissionNudgeFrame;

  function resetSubmissionIdle() {
    window.clearTimeout(submissionIdleTimer);
    if (submissionNudgeFrame) {
      cancelFrame(submissionNudgeFrame);
      submissionNudgeFrame = null;
    }
    delete deck.dataset.submissionNudge;
    deck.style.removeProperty("--submission-nudge-height");
    if (document.hidden || reducedMotion.matches) return;

    submissionIdleTimer = window.setTimeout(() => {
      const editing = document.activeElement && document.activeElement.closest("input, textarea, select, [contenteditable]");
      if (["submissions", "colophon"].includes(deck.dataset.active) || panelAnimationFrame || panelDrag || editing) return;
      const submissionPanel = panels.find((panel) => panel.dataset.panel === "submissions");
      // Le pagine senza sezione Submissions (Side B) non hanno niente da richiamare.
      if (!submissionPanel) return;
      const title = submissionPanel.querySelector("button");
      const banner = submissionPanel.querySelector(":scope > [data-marquee-text]");
      const distance = Math.max(0, title.offsetHeight + (banner ? banner.offsetHeight : 0) - submissionPanel.clientHeight);
      if (!distance) {
        resetSubmissionIdle();
        return;
      }
      deck.dataset.submissionNudge = "true";
      const startedAt = getTime();
      const bounces = [
        { duration: 850, height: 1 },
        { duration: 450, height: 0.28 },
        { duration: 240, height: 0.08 },
      ];

      function bounce(now) {
        let elapsed = now - startedAt;
        const current = bounces.find((item) => {
          if (elapsed < item.duration) return true;
          elapsed -= item.duration;
          return false;
        });
        if (!current) {
          submissionNudgeFrame = null;
          resetSubmissionIdle();
          return;
        }
        const progress = elapsed / current.duration;
        const amount = current.height * 4 * progress * (1 - progress);
        deck.style.setProperty("--submission-nudge-height", `${(distance * amount).toFixed(2)}px`);
        submissionNudgeFrame = requestFrame(bounce);
      }
      submissionNudgeFrame = requestFrame(bounce);
    }, 8000);
  }

  ["pointermove", "pointerdown", "wheel", "keydown", "scroll", "input", "focusin", "focusout"].forEach((eventName) => {
    document.addEventListener(eventName, resetSubmissionIdle, { passive: true, capture: true });
  });
  document.addEventListener("visibilitychange", resetSubmissionIdle);
  reducedMotion.addEventListener("change", resetSubmissionIdle);

  // Scroll nativo a inerzia (dito già sollevato): se arriva al bordo con velocità, rimbalza.
  const nativeScroll = new WeakMap();
  function trackNativeScroll(panel) {
    const now = getTime();
    const previous = nativeScroll.get(panel);
    const top = panel.scrollTop;
    nativeScroll.set(panel, { top, time: now, speed: 0 });
    if (!previous || panel.dataset.panel !== deck.dataset.active || panelDrag || panelAnimationFrame ||
        now < navigationLockedUntil || now - lastWheelTime < 200 || touchNavigation) return;
    const gap = now - previous.time;
    const step = top - previous.top;
    if (gap > 120 || Math.abs(step) > 600) return;
    const speed = gap ? (step / gap) * 1000 * 0.6 + previous.speed * 0.4 : previous.speed;
    nativeScroll.get(panel).speed = speed;
    const atBottom = panel.scrollHeight - panel.clientHeight - top <= 1;
    const atTop = top <= 1;
    if ((atBottom && speed > 150) || (atTop && speed < -150)) {
      kickOverscroll(panel, speed);
      nativeScroll.delete(panel);
    }
  }

  // La barra di scorrimento segue scroll, apertura delle sezioni, resize e campi che crescono.
  document.addEventListener("scroll", (event) => {
    if (panels.includes(event.target)) {
      updateScrollEnd(event.target);
      wakeScrollBar(event.target);
      trackNativeScroll(event.target);
    }
  }, { passive: true, capture: true });
  if (typeof ResizeObserver === "function") {
    const scrollEndObserver = new ResizeObserver(updateScrollEnds);
    panels.forEach((panel) => {
      scrollEndObserver.observe(panel);
      const content = panel.querySelector(":scope > .panel-content");
      if (content) scrollEndObserver.observe(content);
    });
  }
  window.addEventListener("resize", updateScrollEnds);

  // Nel colophon Get in touch parte come il testo delle altre schede e loghi e crediti
  // stanno in fondo. L'altezza minima del contenuto si fissa su quella della scheda
  // aperta: durante l'apertura e la chiusura tutto si muove insieme al titolo, invece
  // di restare incollato al bordo basso.
  function pinColophonFooter() {
    const content = colophonPanel && colophonPanel.querySelector(":scope > .panel-content");
    if (!content || panelAnimationFrame || panelDrag) return;
    const index = panels.indexOf(colophonPanel);
    const active = deck.dataset.active;
    const inlineRows = deck.style.gridTemplateRows;
    const inlineTransition = deck.style.transition;
    // Senza transizione, altrimenti la misura restituisce le righe di partenza.
    deck.style.transition = "none";
    deck.style.gridTemplateRows = "";
    deck.dataset.active = "colophon";
    setCollapsedAbove("colophon");
    const openHeight = parseRows(getComputedStyle(deck).gridTemplateRows)[index];
    deck.dataset.active = active;
    setCollapsedAbove(active);
    deck.style.gridTemplateRows = inlineRows;
    deck.getBoundingClientRect();
    deck.style.transition = inlineTransition;
    let above = parseFloat(getComputedStyle(content).marginTop) || 0;
    for (const child of colophonPanel.children) {
      if (child === content) break;
      if (getComputedStyle(child).position !== "absolute") above += child.offsetHeight;
    }
    content.style.minHeight = `${Math.max(0, openHeight - above)}px`;
  }
  window.addEventListener("resize", () => requestFrame(pinColophonFooter));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestFrame(pinColophonFooter));

  window.addEventListener("resize", scheduleTitleCalibration);

  calibrateTitleSize();
  buildSubmissionMarquee();
  const opensSubmissions = location.hash.toLowerCase() === "#submissions";
  setActivePanel(opensSubmissions ? "submissions" : "home", false);

  window.addEventListener("hashchange", () => {
    if (location.hash.toLowerCase() === "#submissions") {
      setActivePanel("submissions");
    } else if (!location.hash) {
      setActivePanel("home");
    }
  });
})();
