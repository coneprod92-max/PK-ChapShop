
/* PK-ChapShop — Carrousels produits et commerces à la une */
(function () {
  "use strict";

  const STYLE_ID = "pk-featured-carousel-styles";

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .pk-carousel-wrap {
        width: 100%;
        position: relative;
        margin-bottom: 12px;
      }

      .pk-carousel-track {
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 18px !important;
        width: 100%;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding: 4px 3px 18px;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        scrollbar-width: thin;
        scrollbar-color: #d5ad58 #edf1e9;
        overscroll-behavior-x: contain;
      }

      .pk-carousel-track::-webkit-scrollbar {
        height: 7px;
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
        flex: 0 0 clamp(245px, 30%, 330px) !important;
        width: clamp(245px, 30%, 330px) !important;
        min-width: 0;
        scroll-snap-align: start;
      }

      .pk-carousel-controls {
        display: flex;
        justify-content: flex-end;
        gap: 9px;
        margin: 0 0 12px;
      }

      .pk-carousel-controls button {
        display: grid;
        place-items: center;
        width: 39px;
        height: 39px;
        border: 1px solid #d8dfd5;
        border-radius: 50%;
        background: #fff;
        color: #123b2d;
        font-size: 23px;
        cursor: pointer;
        transition: background .2s, color .2s;
      }

      .pk-carousel-controls button:hover {
        background: #123b2d;
        color: #fff;
      }

      .pk-carousel-controls button:focus-visible {
        outline: 3px solid #d5ad58;
        outline-offset: 3px;
      }

      @media (max-width: 600px) {
        .pk-carousel-track > .store-card {
          flex-basis: min(82vw, 320px) !important;
          width: min(82vw, 320px) !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .pk-carousel-track {
          scroll-behavior: auto;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function activateCarousel(track) {
    if (track.dataset.pkCarouselReady === "true") return;

    track.dataset.pkCarouselReady = "true";
    track.classList.add("pk-carousel-track");

    if (!track.id) {
      track.id = "pk-carousel-" +
        Math.random().toString(36).slice(2, 10);
    }

    const wrapper = document.createElement("div");
    wrapper.className = "pk-carousel-wrap";

    const controls = document.createElement("div");
    controls.className = "pk-carousel-controls";
    controls.setAttribute("aria-label", "Navigation du carrousel");

    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "‹";
    previous.setAttribute("aria-label", "Éléments précédents");

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "›";
    next.setAttribute("aria-label", "Éléments suivants");

    controls.append(previous, next);

    track.parentNode.insertBefore(wrapper, track);
    wrapper.append(controls, track);

    function move(direction) {
      const card = track.querySelector(".store-card");
      const gap = 18;
      const distance = card
        ? card.getBoundingClientRect().width + gap
        : track.clientWidth * 0.8;

      const atEnd =
        track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;

      if (direction > 0 && atEnd) {
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else if (direction < 0 && track.scrollLeft <= 8) {
        track.scrollTo({
          left: track.scrollWidth,
          behavior: "smooth"
        });
      } else {
        track.scrollBy({
          left: direction * distance,
          behavior: "smooth"
        });
      }
    }

    previous.addEventListener("click", () => move(-1));
    next.addEventListener("click", () => move(1));

    let timer = null;

    function stop() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      stop();

      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        track.scrollWidth <= track.clientWidth + 8
      ) return;

      timer = window.setInterval(() => {
        if (!track.isConnected) {
          stop();
          return;
        }

        if (
          track.matches(":hover") ||
          track.contains(document.activeElement)
        ) return;

        move(1);
      }, 4500);
    }

    track.addEventListener("mouseenter", stop);
    track.addEventListener("mouseleave", start);
    track.addEventListener("focusin", stop);
    track.addEventListener("focusout", start);
    track.addEventListener("touchstart", stop, { passive: true });
    track.addEventListener("touchend", start, { passive: true });

    start();
  }

  function scan() {
    document
      .querySelectorAll("#stores .pk-featured-grid, #stores .pk-store-grid")
      .forEach(activateCarousel);
  }

  const observer = new MutationObserver(scan);

  function initialize() {
    const stores = document.getElementById("stores");
    if (!stores) return;

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
