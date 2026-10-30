
/* =========================================================
   PK-ChapShop — Carrousels premium
   Produits à la une + Commerces à la une
   Compatible avec app.js existant
   ========================================================= */

(function () {
  "use strict";

  const STYLE_ID = "pk-featured-carousel-styles";
  const SELECTOR =
    "#stores .pk-featured-grid, #stores .pk-store-grid";

  const activeTracks = new WeakMap();
  let carouselNumber = 0;

  /* ---------- Styles ---------- */

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      .pk-carousel-wrap {
        position: relative;
        width: 100%;
        margin: 0 0 30px;
      }

      .pk-carousel-track {
        display: flex !important;
        flex-wrap: nowrap !important;
        align-items: stretch;
        gap: 18px !important;
        width: 100%;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding: 5px 3px 19px;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        scrollbar-width: thin;
        scrollbar-color: #d5ad58 #edf1e9;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch;
      }

      .pk-carousel-track::-webkit-scrollbar {
        height: 6px;
      }

      .pk-carousel-track::-webkit-scrollbar-track {
        background: #edf1e9;
        border-radius: 20px;
      }

      .pk-carousel-track::-webkit-scrollbar-thumb {
        background: #d5ad58;
        border-radius: 20px;
      }

      .pk-carousel-track > .store-card {
        flex: 0 0 clamp(250px, 30%, 330px) !important;
        width: clamp(250px, 30%, 330px) !important;
        min-width: 0 !important;
        scroll-snap-align: start;
        height: auto;
      }

      .pk-carousel-controls {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 9px;
        min-height: 42px;
        margin: 0 0 10px;
      }

      .pk-carousel-controls[hidden] {
        display: none !important;
      }

      .pk-carousel-controls button {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 1px solid #d8dfd5;
        border-radius: 50%;
        background: #fff;
        color: #123b2d;
        font-size: 25px;
        line-height: 1;
        cursor: pointer;
        transition:
          background .2s,
          color .2s,
          border-color .2s,
          transform .2s;
      }

      .pk-carousel-controls button:hover {
        background: #123b2d;
        border-color: #123b2d;
        color: #fff;
        transform: translateY(-2px);
      }

      .pk-carousel-controls button:focus-visible {
        outline: 3px solid #d5ad58;
        outline-offset: 3px;
      }

      .pk-carousel-track > .store-card {
        box-sizing: border-box;
      }

      @media (max-width: 650px) {
        .pk-carousel-wrap {
          margin-bottom: 24px;
        }

        .pk-carousel-track {
          gap: 14px !important;
          padding-bottom: 15px;
        }

        .pk-carousel-track > .store-card {
          flex-basis: min(84vw, 330px) !important;
          width: min(84vw, 330px) !important;
        }

        .pk-carousel-controls button {
          width: 37px;
          height: 37px;
          font-size: 23px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .pk-carousel-track {
          scroll-behavior: auto;
        }

        .pk-carousel-controls button {
          transition: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* ---------- Initialisation ---------- */

  function activateCarousel(track) {
    if (!track || activeTracks.has(track)) return;

    const parent = track.parentNode;
    if (!parent) return;

    activeTracks.set(track, true);

    track.classList.add("pk-carousel-track");

    if (!track.id) {
      carouselNumber++;
      track.id = "pk-carousel-" + carouselNumber;
    }

    track.setAttribute("role", "region");
    track.setAttribute("aria-roledescription", "carrousel");

    const wrapper = document.createElement("div");
    wrapper.className = "pk-carousel-wrap";

    const controls = document.createElement("div");
    controls.className = "pk-carousel-controls";
    controls.setAttribute("aria-label", "Navigation du carrousel");
    controls.hidden = true;

    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "‹";
    previous.setAttribute("aria-label", "Éléments précédents");
    previous.setAttribute("aria-controls", track.id);

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "›";
    next.setAttribute("aria-label", "Éléments suivants");
    next.setAttribute("aria-controls", track.id);

    controls.append(previous, next);

    parent.insertBefore(wrapper, track);
    wrapper.append(controls, track);

    /* ---------- Navigation ---------- */

    function move(direction) {
      const cards = track.querySelectorAll(":scope > .store-card");
      const card = cards[0];

      if (!card) return;

      const styles = window.getComputedStyle(track);
      const gap = parseFloat(styles.columnGap) || 18;
      const distance = card.getBoundingClientRect().width + gap;

      const maxScroll =
        track.scrollWidth - track.clientWidth;

      if (maxScroll <= 5) return;

      const target = track.scrollLeft + direction * distance;

      if (target > maxScroll - 8) {
        track.scrollTo({
          left: 0,
          behavior: "smooth"
        });
      } else if (target < 8) {
        track.scrollTo({
          left: maxScroll,
          behavior: "smooth"
        });
      } else {
        track.scrollTo({
          left: target,
          behavior: "smooth"
        });
      }
    }

    previous.addEventListener("click", function () {
      pauseAutomatic();
      move(-1);
    });

    next.addEventListener("click", function () {
      pauseAutomatic();
      move(1);
    });

    /* ---------- État du carrousel ---------- */

    function updateControls() {
      if (!track.isConnected) return;

      const canScroll =
        track.scrollWidth > track.clientWidth + 8;

      controls.hidden = !canScroll;

      previous.disabled = !canScroll;
      next.disabled = !canScroll;
    }

    /* ---------- Défilement automatique ---------- */

    let timer = null;
    let resumeTimer = null;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const touchDevice = window.matchMedia(
      "(pointer: coarse)"
    );

    function stopAutomatic() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function pauseAutomatic() {
      stopAutomatic();

      if (resumeTimer !== null) {
        window.clearTimeout(resumeTimer);
      }

      if (touchDevice.matches) return;

      resumeTimer = window.setTimeout(function () {
        resumeTimer = null;
        startAutomatic();
      }, 7000);
    }

    function startAutomatic() {
      stopAutomatic();

      if (
        !track.isConnected ||
        reducedMotion.matches ||
        touchDevice.matches ||
        document.hidden ||
        track.scrollWidth <= track.clientWidth + 8
      ) {
        return;
      }

      timer = window.setInterval(function () {
        if (!track.isConnected || document.hidden) {
          stopAutomatic();
          return;
        }

        if (
          track.matches(":hover") ||
          track.contains(document.activeElement)
        ) {
          return;
        }

        move(1);
      }, 5000);
    }

    track.addEventListener("mouseenter", stopAutomatic);

    track.addEventListener("mouseleave", function () {
      startAutomatic();
    });

    track.addEventListener("focusin", stopAutomatic);

    track.addEventListener("focusout", function () {
      startAutomatic();
    });

    track.addEventListener("touchstart", function () {
      stopAutomatic();
    }, { passive: true });

    track.addEventListener("touchend", function () {
      // Pas de redémarrage automatique sur téléphone.
      stopAutomatic();
    }, { passive: true });

    track.addEventListener("pointerdown", function () {
      pauseAutomatic();
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopAutomatic();
      } else {
        startAutomatic();
      }
    });

    if (reducedMotion.addEventListener) {
      reducedMotion.addEventListener("change", startAutomatic);
      touchDevice.addEventListener("change", startAutomatic);
    }

    /* ---------- Redimensionnement ---------- */

    let resizeObserver = null;

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(function () {
        updateControls();
        startAutomatic();
      });

      resizeObserver.observe(track);
    } else {
      window.addEventListener("resize", function () {
        updateControls();
        startAutomatic();
      });
    }

    track.addEventListener("scroll", updateControls, {
      passive: true
    });

    updateControls();
    startAutomatic();
  }

  /* ---------- Recherche des deux carrousels ---------- */

  function scan() {
    document.querySelectorAll(SELECTOR).forEach(function (track) {
      activateCarousel(track);
    });
  }

  /* ---------- Démarrage ---------- */

  function initialize() {
    installStyles();

    const stores = document.getElementById("stores");

    if (!stores) return;

    const observer = new MutationObserver(function () {
      scan();
    });

    observer.observe(stores, {
      childList: true,
      subtree: true
    });

    scan();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

})();
