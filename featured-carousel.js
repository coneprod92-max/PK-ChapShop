
/* =========================================================
   PK-ChapShop — Carrousels produits et commerces
   Version corrigée : priorité sur les styles de app.js
   ========================================================= */

(function () {
  "use strict";

  const STYLE_ID = "pk-featured-carousel-styles";
  const SELECTOR =
    "#stores .pk-featured-grid, #stores .pk-store-grid";

  const activeTracks = new WeakMap();
  let carouselNumber = 0;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      /* Priorité renforcée face aux styles intégrés dans app.js */
      #stores .pk-carousel-track {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        grid-template-columns: none !important;
        grid-auto-columns: auto !important;
        align-items: stretch !important;
        gap: 18px !important;
        width: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding: 6px 3px 18px !important;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        scrollbar-width: thin;
        scrollbar-color: #d5ad58 #edf1e9;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-x pan-y;
      }

      #stores .pk-carousel-track::-webkit-scrollbar {
        height: 6px;
      }

      #stores .pk-carousel-track::-webkit-scrollbar-track {
        background: #edf1e9;
        border-radius: 20px;
      }

      #stores .pk-carousel-track::-webkit-scrollbar-thumb {
        background: #d5ad58;
        border-radius: 20px;
      }

      #stores .pk-carousel-track > .store-card {
        display: flex;
        flex-direction: column;
        flex: 0 0 clamp(250px, 30%, 330px) !important;
        width: clamp(250px, 30%, 330px) !important;
        min-width: 250px !important;
        max-width: 330px !important;
        box-sizing: border-box;
        scroll-snap-align: start;
        height: auto;
      }

      .pk-carousel-wrap {
        position: relative;
        width: 100%;
        margin: 0 0 30px;
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
        background: white;
        color: #123b2d;
        font-size: 25px;
        line-height: 1;
        cursor: pointer;
      }

      .pk-carousel-controls button:hover {
        background: #123b2d;
        border-color: #123b2d;
        color: white;
      }

      .pk-carousel-controls button:focus-visible {
        outline: 3px solid #d5ad58;
        outline-offset: 3px;
      }

      @media (max-width: 650px) {
        .pk-carousel-wrap {
          margin-bottom: 24px;
        }

        #stores .pk-carousel-track {
          gap: 14px !important;
          padding-bottom: 15px !important;
        }

        #stores .pk-carousel-track > .store-card {
          flex-basis: 84vw !important;
          width: 84vw !important;
          min-width: 250px !important;
          max-width: 330px !important;
        }

        .pk-carousel-controls button {
          width: 37px;
          height: 37px;
          font-size: 23px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #stores .pk-carousel-track {
          scroll-behavior: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

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

    function move(direction) {
      const cards = track.querySelectorAll(":scope > .store-card");
      const card = cards[0];

      if (!card) return;

      const gap =
        parseFloat(getComputedStyle(track).columnGap) || 18;

      const distance = card.getBoundingClientRect().width + gap;
      const maxScroll = track.scrollWidth - track.clientWidth;

      if (maxScroll <= 5) return;

      const target = track.scrollLeft + direction * distance;

      if (target > maxScroll - 8) {
        track.scrollTo({ left: 0, behavior: "smooth" });
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

    function updateControls() {
      if (!track.isConnected) return;

      const canScroll =
        track.scrollWidth > track.clientWidth + 8;

      controls.hidden = !canScroll;
      previous.disabled = !canScroll;
      next.disabled = !canScroll;
    }

    /* Défilement automatique sur ordinateur uniquement */
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
        clearInterval(timer);
        timer = null;
      }
    }

    function pauseAutomatic() {
      stopAutomatic();

      if (resumeTimer !== null) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }

      resumeTimer = setTimeout(function () {
        resumeTimer = null;
        startAutomatic();
      }, 7000);
    }

    function startAutomatic() {
      stopAutomatic();

      if (
  !track.isConnected ||
  reducedMotion.matches ||
  document.hidden ||
  track.scrollWidth <= track.clientWidth + 8
) {
  return;
}

      timer = setInterval(function () {
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

    track.addEventListener("mouseleave", startAutomatic);

    track.addEventListener("focusin", stopAutomatic);

    track.addEventListener("focusout", startAutomatic);

    track.addEventListener("pointerdown", pauseAutomatic, {
      passive: true
    });

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

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(function () {
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

  function scan() {
    document.querySelectorAll(SELECTOR).forEach(activateCarousel);
  }

  function initialize() {
    installStyles();

    const stores = document.getElementById("stores");
    if (!stores) return;

    const observer = new MutationObserver(scan);

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
