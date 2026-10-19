(function () {
  const deck = document.querySelector(".deck");
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  const bouncingLogo = document.querySelector("[data-bouncer-logo]");
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
  const maxBouncingLogos = 80;
  let panelAnimationFrame;
  let panelDrag;
  let wheelReleaseTimer;
  let resizeFrame;
  let logoAnimationFrame;
  let logoResizeFrame;
  let logoLastTime = 0;
  const bouncingLogoStates = [];
  const bouncingLogoListeners = new WeakSet();
  let isLogoDocked = false;

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

  function buildSubmissionMarquee() {
    const marquee = document.querySelector("[data-marquee-text]");
    const track = marquee && marquee.firstElementChild;

    if (!marquee || !track) {
      return;
    }

    const text = marquee.dataset.marqueeText || "";
    const group = document.createElement("span");

    track.innerHTML = "";
    group.append(createMarqueePair(text));
    track.append(group);

    const minimumGroupWidth = marquee.clientWidth * 2;

    while (group.scrollWidth < minimumGroupWidth) {
      group.append(createMarqueePair(text));
    }

    const clone = group.cloneNode(true);

    clone.setAttribute("aria-hidden", "true");
    track.append(clone);
    marquee.style.setProperty("--marquee-distance", `${group.scrollWidth}px`);
    track.style.animation = "none";
    track.getBoundingClientRect();
    track.style.animation = "";
  }

  function getLogoBounds(logo) {
    const rect = logo.getBoundingClientRect();
    const width = logo.offsetWidth || rect.width || 80;
    const height = logo.offsetHeight || rect.height || width;

    return {
      height,
      maxX: Math.max(0, window.innerWidth - width),
      maxY: Math.max(0, window.innerHeight - height),
      width,
    };
  }

  function getLogoDockGap() {
    return Math.max(10, Math.min(window.innerWidth, window.innerHeight) * 0.018);
  }

  function getDockedLogoPosition(logo) {
    const bounds = getLogoBounds(logo);
    const gap = getLogoDockGap();

    return {
      x: Math.max(0, bounds.maxX - gap),
      y: Math.max(0, bounds.maxY - gap),
    };
  }

  function setLogoPosition(logoState, x, y) {
    logoState.x = x;
    logoState.y = y;
    logoState.element.style.setProperty("--logo-x", `${x.toFixed(2)}px`);
    logoState.element.style.setProperty("--logo-y", `${y.toFixed(2)}px`);
  }

  function handleBouncingLogoPointer(event) {
    event.preventDefault();

    if (isLogoDocked) {
      restartBouncingLogos();
      return;
    }

    dockBouncingLogos();
  }

  function createBouncingLogoState(element) {
    const state = {
      element,
      rotation: 0,
      rotationVelocity: 0,
      velocityX: 0,
      velocityY: 0,
      x: 0,
      y: 0,
    };

    if (!bouncingLogoListeners.has(element)) {
      element.addEventListener("pointerdown", handleBouncingLogoPointer);
      bouncingLogoListeners.add(element);
    }

    return state;
  }

  function setLogoRotation(logoState, rotation) {
    logoState.rotation = rotation;
    logoState.element.style.setProperty("--logo-rotation", `${rotation.toFixed(2)}deg`);
  }

  function randomizeLogoRotation(logoState) {
    const speed = 4 + Math.random() * 6;
    const direction = Math.random() < 0.5 ? -1 : 1;

    logoState.rotationVelocity = speed * direction;
  }

  function randomizeLogoVelocity(logoState) {
    const viewportMin = Math.min(window.innerWidth, window.innerHeight);
    const speed = Math.max(130, Math.min(260, viewportMin * 0.33));
    const angle = ((20 + Math.random() * 50) * Math.PI) / 180;
    const directionX = Math.random() < 0.5 ? -1 : 1;
    const directionY = Math.random() < 0.5 ? -1 : 1;

    logoState.velocityX = Math.cos(angle) * speed * directionX;
    logoState.velocityY = Math.sin(angle) * speed * directionY;
  }

  function duplicateBouncingLogo(sourceState) {
    if (!bouncingLogo || isLogoDocked || bouncingLogoStates.length >= maxBouncingLogos) {
      return;
    }

    const clone = bouncingLogo.cloneNode(true);
    const state = createBouncingLogoState(clone);
    const sourceBounds = getLogoBounds(sourceState.element);

    clone.removeAttribute("data-docked");
    clone.removeAttribute("data-restartable");
    document.body.append(clone);
    bouncingLogoStates.push(state);
    setLogoRotation(state, sourceState.rotation);
    setLogoPosition(
      state,
      Math.min(sourceBounds.maxX, Math.max(0, sourceState.x)),
      Math.min(sourceBounds.maxY, Math.max(0, sourceState.y)),
    );
    randomizeLogoRotation(state);
    randomizeLogoVelocity(state);

    if (state.x <= 0) {
      state.velocityX = Math.abs(state.velocityX);
    } else if (state.x >= sourceBounds.maxX) {
      state.velocityX = -Math.abs(state.velocityX);
    }

    if (state.y <= 0) {
      state.velocityY = Math.abs(state.velocityY);
    } else if (state.y >= sourceBounds.maxY) {
      state.velocityY = -Math.abs(state.velocityY);
    }
  }

  function stepBouncingLogo(now) {
    if (!bouncingLogoStates.length) {
      return;
    }

    if (isLogoDocked) {
      return;
    }

    const delta = Math.min(0.05, Math.max(0, (now - logoLastTime) / 1000));
    const bouncedLogos = [];

    bouncingLogoStates.forEach((logoState) => {
      const bounds = getLogoBounds(logoState.element);
      let nextX = logoState.x + logoState.velocityX * delta;
      let nextY = logoState.y + logoState.velocityY * delta;
      const nextRotation = (logoState.rotation + logoState.rotationVelocity * delta) % 360;
      let didBounce = false;

      if (nextX <= 0 || nextX >= bounds.maxX) {
        logoState.velocityX *= -1;
        nextX = Math.min(bounds.maxX, Math.max(0, nextX));
        didBounce = true;
      }

      if (nextY <= 0 || nextY >= bounds.maxY) {
        logoState.velocityY *= -1;
        nextY = Math.min(bounds.maxY, Math.max(0, nextY));
        didBounce = true;
      }

      setLogoPosition(logoState, nextX, nextY);
      setLogoRotation(logoState, nextRotation);

      if (didBounce) {
        bouncedLogos.push(logoState);
      }
    });

    bouncedLogos.forEach(duplicateBouncingLogo);
    logoLastTime = now;
    logoAnimationFrame = requestFrame(stepBouncingLogo);
  }

  function startBouncingLogo(startPosition) {
    if (!bouncingLogo) {
      return;
    }

    const initialState = createBouncingLogoState(bouncingLogo);
    const bounds = getLogoBounds(initialState.element);
    const startX = startPosition
      ? Math.min(bounds.maxX, Math.max(0, startPosition.x))
      : Math.random() * bounds.maxX;
    const startY = startPosition
      ? Math.min(bounds.maxY, Math.max(0, startPosition.y))
      : Math.random() * bounds.maxY;

    deck.dataset.logoGame = "active";
    isLogoDocked = false;
    bouncingLogoStates.splice(0, bouncingLogoStates.length, initialState);
    bouncingLogo.removeAttribute("data-docked");
    bouncingLogo.removeAttribute("data-restartable");
    setLogoRotation(initialState, 0);
    setLogoPosition(initialState, startX, startY);
    randomizeLogoRotation(initialState);
    randomizeLogoVelocity(initialState);
    logoLastTime = getTime();

    if (logoAnimationFrame) {
      cancelFrame(logoAnimationFrame);
    }

    logoAnimationFrame = requestFrame(stepBouncingLogo);
  }

  function restartBouncingLogos() {
    const restartLogo = bouncingLogoStates[bouncingLogoStates.length - 1];
    const restartPosition = restartLogo
      ? { x: restartLogo.x, y: restartLogo.y }
      : null;

    bouncingLogoStates.forEach((logoState) => {
      if (logoState.element !== bouncingLogo) {
        logoState.element.remove();
      }
    });
    startBouncingLogo(restartPosition);
  }

  function dockBouncingLogos() {
    if (!bouncingLogoStates.length || isLogoDocked) {
      return;
    }

    isLogoDocked = true;
    deck.dataset.logoGame = "docked";
    resetSubmissionIdle();

    if (logoAnimationFrame) {
      cancelFrame(logoAnimationFrame);
      logoAnimationFrame = null;
    }

    bouncingLogoStates.forEach((logoState) => {
      const position = getDockedLogoPosition(logoState.element);

      logoState.element.setAttribute("data-docked", "true");
      logoState.element.removeAttribute("data-restartable");
      setLogoRotation(logoState, 0);
      setLogoPosition(logoState, position.x, position.y);
    });

    bouncingLogoStates[bouncingLogoStates.length - 1].element.setAttribute(
      "data-restartable",
      "true",
    );
  }

  function updateBouncingLogoBounds() {
    if (!bouncingLogoStates.length) {
      return;
    }

    if (isLogoDocked) {
      bouncingLogoStates.forEach((logoState) => {
        const position = getDockedLogoPosition(logoState.element);

        setLogoPosition(logoState, position.x, position.y);
      });
      return;
    }

    bouncingLogoStates.forEach((logoState) => {
      const bounds = getLogoBounds(logoState.element);

      setLogoPosition(
        logoState,
        Math.min(bounds.maxX, Math.max(0, logoState.x)),
        Math.min(bounds.maxY, Math.max(0, logoState.y)),
      );
    });
  }

  function scheduleBouncingLogoBounds() {
    cancelFrame(logoResizeFrame);
    logoResizeFrame = requestFrame(updateBouncingLogoBounds);
  }

  function calibrateTitleSize() {
    const referenceTitle = document.querySelector("[data-panel] > button > span");
    const referenceTab = document.querySelector("[data-panel] > button");
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
    });
  }

  function applyPanelState(panelName) {
    deck.dataset.active = panelName;
    document.getElementById("content-colophon").inert = panelName !== "colophon";
    panels.forEach((panel) => {
      const isActive = panel.dataset.panel === panelName;
      const tab = panel.querySelector("button");

      if (!isActive && tab.getAttribute("aria-expanded") === "true") {
        panel.dataset.peekDismissed = "true";
      } else if (isActive) {
        delete panel.dataset.peekDismissed;
      }
      tab.setAttribute("aria-expanded", String(isActive));
      if (!isActive) {
        panel.scrollTop = 0;
      }
    });
  }

  function animatePanelState(panelName, duration = panelDuration) {
    const startRows = parseRows(getComputedStyle(deck).gridTemplateRows);

    if (panelAnimationFrame) {
      cancelFrame(panelAnimationFrame);
      panelAnimationFrame = null;
    }

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

      if (progress < 1) {
        panelAnimationFrame = requestFrame(step);
        return;
      }

      deck.style.gridTemplateRows = "";
      deck.style.transition = "";
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
      if (deck.dataset.logoGame === "active") {
        return;
      }

      const panelName = panel.dataset.panel;
      const nextPanel = deck.dataset.active === panelName && panelName !== "home"
        ? "home"
        : panelName;

      setActivePanel(nextPanel);
    });
  });

  // Prova disattivabile con data-scroll-navigation="false" sul main.
  const editableFields = "input, textarea, select, [contenteditable]";
  let touchNavigation;
  let wheelNavigation;
  let navigationLockedUntil = 0;

  function canScrollNavigate(target) {
    return deck.dataset.scrollNavigation !== "false" &&
      deck.dataset.logoGame !== "active" && !panelAnimationFrame &&
      getTime() >= navigationLockedUntil && !target.closest(editableFields) &&
      !(document.activeElement && document.activeElement.closest(editableFields));
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
    if (!gesture || gesture.panel.dataset.panel !== deck.dataset.active) return null;
    if (!(direction > 0 ? gesture.atBottom : gesture.atTop)) return null;
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
      deck.dataset.panelDrag = "true";
      deck.style.transition = "none";
      const startRows = parseRows(getComputedStyle(deck).gridTemplateRows);
      const from = deck.dataset.active;
      const scrollTop = gesture.panel.scrollTop;
      deck.dataset.active = next.dataset.panel;
      const targetRows = parseRows(getComputedStyle(deck).gridTemplateRows);
      deck.dataset.active = from;
      panelDrag = { panel: gesture.panel, from, to: next.dataset.panel,
        startRows, targetRows, scrollTop, progress: 0,
        travel: Math.max(120, Math.abs(targetRows[panels.indexOf(next)] - startRows[panels.indexOf(next)])),
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

  function releasePanelDrag(cancel = false) {
    window.clearTimeout(wheelReleaseTimer);
    if (!panelDrag) return;
    const drag = panelDrag;
    panelDrag = null;
    const commit = !cancel && drag.progress >= 0.22;
    const destination = commit ? drag.to : drag.from;
    const duration = Math.max(180, Math.min(450, panelDuration * (commit ? 1 - drag.progress : drag.progress)));
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
      lastY: touch.clientY, next: null, direction: 0 };
    touchNavigation.routed = event.target.closest("[data-panel]") !== touchNavigation.panel;
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
    const next = adjacentPanel(touchNavigation, direction);
    if (!next) {
      if (touchNavigation.routed) {
        if (event.cancelable) event.preventDefault();
        routePanelScroll(touchNavigation.panel, touchNavigation.lastY - event.touches[0].clientY);
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
    touchNavigation = null;
    releasePanelDrag(!canScrollNavigate(event.target));
  }, { passive: true, capture: true });
  deck.addEventListener("touchcancel", () => {
    touchNavigation = null;
    releasePanelDrag(true);
  }, { passive: true });

  deck.addEventListener("wheel", (event) => {
    const now = getTime();
    const newGesture = !wheelNavigation || now - wheelNavigation.lastAt > 140;
    if (newGesture) {
      wheelNavigation = { ...captureNavigation(), lastAt: now, distance: 0,
        direction: Math.sign(event.deltaY), used: false,
        allowed: !event.ctrlKey && canScrollNavigate(event.target), next: null,
      };
    }
    wheelNavigation.lastAt = now;
    if (!wheelNavigation.allowed || wheelNavigation.used || !canScrollNavigate(event.target) ||
        event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const direction = Math.sign(event.deltaY);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? wheelNavigation.panel.clientHeight : 1;
    const next = wheelNavigation.next || adjacentPanel(wheelNavigation, direction);
    if (!next) {
      if (event.target.closest("[data-panel]") !== wheelNavigation.panel) {
        if (event.cancelable) event.preventDefault();
        routePanelScroll(wheelNavigation.panel, event.deltaY * unit);
      }
      return;
    }
    if (event.cancelable) event.preventDefault();
    if (!wheelNavigation.next) wheelNavigation.direction = direction;
    wheelNavigation.next = next;
    wheelNavigation.distance = Math.max(0, wheelNavigation.distance + event.deltaY * unit * wheelNavigation.direction);
    dragPanel(wheelNavigation, next, wheelNavigation.distance);
    window.clearTimeout(wheelReleaseTimer);
    wheelReleaseTimer = window.setTimeout(() => {
      wheelNavigation.used = true;
      releasePanelDrag();
    }, 140);
    if (panelDrag && panelDrag.progress >= 1) {
      wheelNavigation.used = true;
      releasePanelDrag();
    }
  }, { passive: false, capture: true });

  window.addEventListener("resize", discardPanelDrag);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) discardPanelDrag();
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      calibrateTitleSize();
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
    if (document.hidden || reducedMotion.matches || deck.dataset.logoGame === "active") return;

    submissionIdleTimer = window.setTimeout(() => {
      const editing = document.activeElement && document.activeElement.closest("input, textarea, select, [contenteditable]");
      if (["submissions", "colophon"].includes(deck.dataset.active) || deck.dataset.logoGame === "active" || panelAnimationFrame || panelDrag || editing) return;
      const submissionPanel = panels.find((panel) => panel.dataset.panel === "submissions");
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

  window.addEventListener("resize", scheduleTitleCalibration);
  window.addEventListener("resize", scheduleBouncingLogoBounds);

  calibrateTitleSize();
  buildSubmissionMarquee();
  const opensSubmissions = location.hash.toLowerCase() === "#submissions";
  if (deck.dataset.logoGameEnabled !== "false") {
    startBouncingLogo();
    if (opensSubmissions) dockBouncingLogos();
  }
  setActivePanel(opensSubmissions ? "submissions" : "home", false);

  window.addEventListener("hashchange", () => {
    if (location.hash.toLowerCase() === "#submissions") {
      if (deck.dataset.logoGame === "active") dockBouncingLogos();
      setActivePanel("submissions");
    } else if (!location.hash) {
      setActivePanel("home");
    }
  });
})();
