/* Логика страницы: загрузчик, плавный скролл, появления, курсор, магнитные кнопки. */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover:hover) and (pointer:fine)").matches;

  /* ---------- загрузчик ---------- */
  function startLoader() {
    const loader = document.getElementById("loader");
    const fill = document.getElementById("loaderFill");
    const num = document.getElementById("loaderNum");
    if (!loader) return finish();

    let shown = 0;
    let done = false;
    const tick = setInterval(() => {
      // догоняем 100% быстрее, если страница уже загрузилась
      const target = done ? 100 : Math.min(92, shown + Math.random() * 9);
      shown += (target - shown) * 0.3;
      const v = Math.round(shown);
      if (fill) fill.style.width = v + "%";
      if (num) num.textContent = String(v).padStart(2, "0");
      if (done && v >= 100) {
        clearInterval(tick);
        loader.classList.add("done");
        setTimeout(finish, 260);
      }
    }, 55);

    const ready = () => { done = true; };
    if (document.readyState === "complete") setTimeout(ready, 260);
    else window.addEventListener("load", () => setTimeout(ready, 200));
    // страховка: не держим посетителя дольше 4 секунд
    setTimeout(ready, 4000);
  }

  function finish() {
    document.body.classList.remove("is-loading");
    document.body.classList.add("ready");
  }

  /* ---------- плавная прокрутка ---------- */
  function initScroll() {
    if (reduced || typeof window.Lenis !== "function") return null;
    const lenis = new window.Lenis({ duration: 1.1, smoothWheel: true, wheelMultiplier: 0.9 });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const el = document.querySelector(a.getAttribute("href"));
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: -70 });
      });
    });
    return lenis;
  }

  /* ---------- появление блоков ---------- */
  function initReveals() {
    const items = document.querySelectorAll(
      ".anim-fade,.anim-up,.reveal-work,.reveal-step,.reveal-card,.step"
    );
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- манифест: слова загораются по мере чтения ---------- */
  function initWords() {
    const box = document.querySelector(".reveal-words");
    if (!box) return;
    const GOLD = ["заявок", "продавать"];

    const words = box.textContent.trim().split(/\s+/);
    box.textContent = "";
    const spans = words.map((word, i) => {
      const s = document.createElement("span");
      s.className = "w";
      // ключевое слово подсвечиваем без запятых и точек рядом с ним
      const bare = word.replace(/[^А-Яа-яЁё\w-]/g, "");
      if (GOLD.includes(bare.toLowerCase())) {
        const at = word.indexOf(bare);
        s.append(word.slice(0, at));
        const g = document.createElement("span");
        g.className = "g";
        g.textContent = bare;
        s.append(g, word.slice(at + bare.length));
      } else {
        s.textContent = word;
      }
      box.appendChild(s);
      if (i < words.length - 1) box.appendChild(document.createTextNode(" "));
      return s;
    });

    if (reduced) { spans.forEach((s) => s.classList.add("lit")); return; }

    const onScroll = () => {
      const r = box.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 — блок только въехал снизу, 1 — дочитан до верхней трети экрана
      const p = (vh * 0.82 - r.top) / (vh * 0.52 + r.height * 0.3);
      const lit = Math.round(Math.max(0, Math.min(1, p)) * spans.length);
      spans.forEach((s, i) => s.classList.toggle("lit", i < lit));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- живой замер: цифры считает сам браузер ---------- */
  function initLive() {
    const cells = document.querySelectorAll("[data-live]");
    if (!cells.length) return;
    const cell = (k) => document.querySelector(`[data-live="${k}"]`);

    // плавный счётчик от нуля до значения
    const countTo = (el, value, digits = 0) => {
      if (!el) return;
      const end = Number(value);
      if (!isFinite(end)) return;
      // по-русски дробная часть пишется через запятую
      const show = (n) => { el.textContent = n.toFixed(digits).replace(".", ","); };
      if (reduced) { show(end); return; }
      const dur = 900;
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        show(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const measure = () => {
      const nav = performance.getEntriesByType("navigation")[0];

      // «появился» — момент первой отрисовки, то есть когда посетитель увидел страницу
      const paint = performance.getEntriesByType("paint")
        .find((p) => p.name === "first-contentful-paint");
      const shown = paint ? paint.startTime / 1000
        : nav ? (nav.domContentLoadedEventEnd || nav.responseEnd) / 1000 : 0;
      countTo(cell("load"), Math.max(0.05, shown), 2);

      // вес самой страницы: разметка, стили и скрипты (фото работ грузятся отдельно, по мере прокрутки)
      const size = (r) => r.transferSize || r.decodedBodySize || 0;
      let bytes = nav ? size(nav) : 0;
      performance.getEntriesByType("resource")
        .filter((r) => /\.(css|js)(\?|$)/.test(r.name))
        .forEach((r) => { bytes += size(r); });
      countTo(cell("weight"), Math.round(bytes / 1024));
    };
    if (document.readyState === "complete") measure();
    else window.addEventListener("load", () => setTimeout(measure, 120));

    // ширина экрана — обновляется прямо при изменении размера окна
    const w = cell("width");
    const setW = () => { if (w) w.textContent = String(window.innerWidth); };
    window.addEventListener("resize", setW, { passive: true });
    setW();

    // частота кадров — считаем секунду реальной отрисовки
    const fps = cell("fps");
    if (fps) {
      let frames = 0;
      const t0 = performance.now();
      const tick = (t) => {
        frames++;
        if (t - t0 < 1000) requestAnimationFrame(tick);
        else countTo(fps, Math.round((frames * 1000) / (t - t0)));
      };
      requestAnimationFrame(tick);
    }
  }

  /* ---------- шапка: фон после прокрутки ---------- */
  function initNav() {
    const nav = document.getElementById("nav");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("stuck", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- свой курсор ---------- */
  function initCursor() {
    const cur = document.getElementById("cursor");
    if (!cur || !finePointer) return;
    let x = window.innerWidth / 2, y = window.innerHeight / 2, tx = x, ty = y;

    window.addEventListener("pointermove", (e) => {
      tx = e.clientX; ty = e.clientY;
      cur.classList.add("on");
    }, { passive: true });

    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("[data-cursor]");
      cur.classList.toggle("hover", !!t && t.dataset.cursor === "link");
      cur.classList.toggle("open", !!t && t.dataset.cursor === "open");
    });

    (function loop() {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      cur.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- магнитные кнопки ---------- */
  function initMagnetic() {
    if (!finePointer || reduced) return;
    document.querySelectorAll(".magnetic").forEach((el) => {
      const strength = 0.28;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- лёгкий наклон обложек ---------- */
  function initTilt() {
    if (!finePointer || reduced) return;
    document.querySelectorAll(".tilt").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(1100px) rotateX(${-py * 4}deg) rotateY(${px * 5}deg)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------- подсветка карточек услуг под курсором ---------- */
  function initSpotlight() {
    if (!finePointer) return;
    document.querySelectorAll(".srv").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }

  function initYear() {
    const y = document.getElementById("year");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  document.addEventListener("DOMContentLoaded", () => {
    startLoader();
    initScroll();
    initReveals();
    initWords();
    initLive();
    initNav();
    initCursor();
    initMagnetic();
    initTilt();
    initSpotlight();
    initYear();
  });
})();
