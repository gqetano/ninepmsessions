(function () {
  "use strict";
  const deck = document.querySelector(".deck");
  const logo = document.querySelector("[data-bouncer-logo]");
  if (!deck || !logo || deck.dataset.logoGameEnabled === "false" || deck.dataset.logoGameMode !== "flipper") return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ball = { x: 0, y: 0, vx: 0, vy: 0, angle: 0 };
  let frame = 0;
  let lastTime = 0;
  let pointer;
  let docked = false;
  let introFinished = false;

  function bounds() {
    return {
      x: Math.max(0, window.innerWidth - logo.offsetWidth),
      y: Math.max(0, window.innerHeight - logo.offsetHeight),
    };
  }
  function paint() {
    logo.style.setProperty("--logo-x", `${ball.x.toFixed(2)}px`);
    logo.style.setProperty("--logo-y", `${ball.y.toFixed(2)}px`);
    logo.style.setProperty("--logo-rotation", `${ball.angle.toFixed(2)}deg`);
  }
  function stop() {
    window.cancelAnimationFrame(frame);
    frame = 0;
  }
  function dock() {
    stop();
    pointer = null;
    logo.removeAttribute("data-dragging");
    docked = true;
    introFinished = true;
    ball.vx = ball.vy = ball.angle = 0;
    const limit = bounds();
    const gap = Math.max(10, Math.min(window.innerWidth, window.innerHeight) * 0.018);
    ball.x = Math.max(0, limit.x - gap);
    ball.y = Math.max(0, limit.y - gap);
    logo.setAttribute("data-docked", "true");
    deck.dataset.logoGame = "docked";
    paint();
    deck.dispatchEvent(new Event("logo-game-change"));
  }
  function advance(now) {
    frame = 0;
    if (docked || pointer || document.hidden) return;
    const dt = Math.min(0.032, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    const limit = bounds();
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < 0 || ball.x > limit.x) {
      ball.x = Math.max(0, Math.min(limit.x, ball.x));
      ball.vx = (ball.x === 0 ? 1 : -1) * Math.abs(ball.vx) * 0.84;
    }
    if (ball.y < 0 || ball.y > limit.y) {
      ball.y = Math.max(0, Math.min(limit.y, ball.y));
      ball.vy = (ball.y === 0 ? 1 : -1) * Math.abs(ball.vy) * 0.84;
    }
    const friction = Math.exp(-0.18 * dt);
    ball.vx *= friction;
    ball.vy *= friction;
    ball.angle = (ball.angle + ball.vx * dt * 0.08) % 360;
    paint();
    if (Math.hypot(ball.vx, ball.vy) > 12) frame = window.requestAnimationFrame(advance);
    else ball.vx = ball.vy = 0;
  }
  function launch() {
    stop();
    docked = false;
    logo.removeAttribute("data-docked");
    lastTime = performance.now();
    frame = window.requestAnimationFrame(advance);
  }

  function toggleFlight() {
    if (!docked || reducedMotion.matches) {
      dock();
      return;
    }
    const angle = Math.random() * Math.PI * 2;
    const speed = 450 + Math.random() * 350;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    launch();
  }

  logo.setAttribute("data-flipper", "true");
  logo.setAttribute("aria-label", "Flipper 9PM: premi per lanciare o riporre il logo, trascina per lanciarlo a mano");
  logo.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    stop();
    const rect = logo.getBoundingClientRect();
    ball.x = rect.left;
    ball.y = rect.top;
    ball.vx = ball.vy = 0;
    pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
      offsetX: event.clientX - ball.x, offsetY: event.clientY - ball.y,
      moved: false, samples: [{ x: ball.x, y: ball.y, time: performance.now() }] };
    logo.setAttribute("data-dragging", "true");
    logo.setPointerCapture(event.pointerId);
    paint();
  });
  logo.addEventListener("pointermove", (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    event.preventDefault();
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 6 && !pointer.moved) return;
    pointer.moved = true;
    docked = false;
    logo.removeAttribute("data-docked");
    const limit = bounds();
    ball.x = Math.max(0, Math.min(limit.x, event.clientX - pointer.offsetX));
    ball.y = Math.max(0, Math.min(limit.y, event.clientY - pointer.offsetY));
    const now = performance.now();
    pointer.samples.push({ x: ball.x, y: ball.y, time: now });
    pointer.samples = pointer.samples.filter((sample) => now - sample.time <= 100);
    paint();
  });
  function release(event, cancelled = false) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const gesture = pointer;
    pointer = null;
    logo.removeAttribute("data-dragging");
    if (logo.hasPointerCapture(event.pointerId)) logo.releasePointerCapture(event.pointerId);
    if (cancelled || reducedMotion.matches) {
      dock();
      return;
    }
    if (!gesture.moved) {
      toggleFlight();
      return;
    }
    const now = performance.now();
    const samples = gesture.samples.filter((sample) => now - sample.time <= 100);
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const seconds = Math.max(0.016, (last.time - first.time) / 1000);
      ball.vx = (last.x - first.x) / seconds;
      ball.vy = (last.y - first.y) / seconds;
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > 2400) { ball.vx *= 2400 / speed; ball.vy *= 2400 / speed; }
    }
    deck.dataset.logoGame = introFinished ? "docked" : "active";
    launch();
  }
  logo.addEventListener("pointerup", (event) => release(event));
  logo.addEventListener("pointercancel", (event) => release(event, true));
  logo.addEventListener("lostpointercapture", (event) => { if (pointer) release(event, true); });
  logo.addEventListener("click", (event) => { if (event.detail === 0) toggleFlight(); });
  deck.addEventListener("logo-dock", dock);
  window.addEventListener("resize", () => {
    if (docked) dock();
    else {
      const limit = bounds();
      ball.x = Math.max(0, Math.min(limit.x, ball.x));
      ball.y = Math.max(0, Math.min(limit.y, ball.y));
      paint();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!docked && !pointer && Math.hypot(ball.vx, ball.vy) > 12) launch();
  });
  reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) dock(); });

  if (location.hash.toLowerCase() === "#submissions" || reducedMotion.matches) dock();
  else {
    const limit = bounds();
    ball.x = limit.x * 0.4;
    ball.y = limit.y * 0.3;
    ball.vx = 380;
    ball.vy = 290;
    deck.dataset.logoGame = "active";
    paint();
    launch();
  }
})();
