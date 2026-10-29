
/* =========================================================
   PK-ChapShop — Fiche commerce
   Compatible avec ?id=... et ?slug=...
   ========================================================= */

const SUPABASE_URL =
  "https://ljzonxmlpygfryfmohhd.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`
};

const storeInfoEl = document.getElementById("storeInfo");
const galleryEl = document.getElementById("storeGallery");
const productsEl = document.getElementById("products");
const cartCountEl = document.getElementById("cartCount");
const toastEl = document.getElementById("toast");

const params = new URLSearchParams(window.location.search);
const storeId = params.get("id");
const storeSlug = params.get("slug");

// L'identifiant réel sera récupéré après le chargement du commerce.
let activeStoreId = null;

/* ---------- Utilitaires ---------- */

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchRows(url) {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase (${response.status}) : ${detail || response.statusText}`
    );
  }

  return response.json();
}

function updateCartCount() {
  try {
    const cart = JSON.parse(
      localStorage.getItem("pk_cart") || "[]"
    );

    const count = Array.isArray(cart)
      ? cart.reduce(
          (total, item) => total + Number(item.quantity || 0),
          0
        )
      : 0;

    if (cartCountEl) {
      cartCountEl.textContent = String(count);
    }
  } catch {
    if (cartCountEl) cartCountEl.textContent = "0";
  }
}

function showToast(message) {
  if (!toastEl) return;

  toastEl.textContent = message;
  toastEl.classList.add("show");

  window.setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2500);
}

function imageFallback(image, type = "product") {
  image.style.display = "none";

  const placeholder = document.createElement("div");
  placeholder.className =
    type === "product" ? "product-placeholder" : "gallery-empty";

  placeholder.textContent =
    type === "product"
      ? "🛍️ Image indisponible"
      : "📸 Image indisponible";

  image.parentElement.appendChild(placeholder);
}

window.imageFallback = imageFallback;

/* ---------- Chargement du commerce ---------- */

async function loadStore() {
  if (!storeId && !storeSlug) {
    showStoreError(
      "Aucun identifiant ni slug fourni pour ce commerce."
    );
    return;
  }

  try {
    /*
     * Si l'adresse contient id, on recherche par identifiant.
     * Sinon, on recherche par slug.
     */
    const filter = storeId
      ? `id=eq.${encodeURIComponent(storeId)}`
      : `slug=eq.${encodeURIComponent(storeSlug)}`;

    const query =
      `${SUPABASE_URL}/rest/v1/stores?` +
      `select=id,slug,name,description,phone,whatsapp,address,city,` +
      `logo_url,cover_url,is_open,delivery_available,is_published` +
      `&${filter}` +
      `&is_published=eq.true`;

    const results = await fetchRows(query);

    if (!Array.isArray(results) || results.length === 0) {
      showStoreError(
        "Commerce introuvable ou non publié. Vérifie que la boutique existe et qu'elle est publiée."
      );
      return;
    }

    const store = results[0];

    // Conserver l'identifiant Supabase pour charger la galerie et les produits.
    activeStoreId = store.id;

    // Normaliser l'adresse avec l'identifiant pour les prochains accès.
    if (!storeId && store.id) {
      const canonicalUrl = new URL(window.location.href);
      canonicalUrl.searchParams.set("id", store.id);
      canonicalUrl.searchParams.delete("slug");

      window.history.replaceState({}, "", canonicalUrl.toString());
    }

    renderStore(store);

    await Promise.all([
      loadGallery(),
      loadProducts()
    ]);
  } catch (error) {
    console.error("Erreur de chargement du commerce :", error);

    showStoreError(
      "Impossible de charger ce commerce. Vérifie la connexion et les autorisations de lecture Supabase."
    );
  }
}

function showStoreError(message) {
  if (storeInfoEl) {
    storeInfoEl.innerHTML = `
      <div class="empty error">
        ${esc(message)}
      </div>
    `;
  }

  if (galleryEl) galleryEl.innerHTML = "";
  if (productsEl) productsEl.innerHTML = "";
}

function renderStore(store) {
  const cover = store.cover_url || store.logo_url || "";

  storeInfoEl.innerHTML = `
    <div
      class="store-cover-large"
      ${cover ? `style="background-image:url('${esc(cover)}')"` : ""}
    ></div>

    <div class="store-details">
      <h1>${esc(store.name)}</h1>

      <p>
        ${esc(store.description || "Bienvenue dans notre commerce.")}
      </p>

      <div class="store-location">
        📍 ${esc(store.address || store.city || "Bénin")}
      </div>

      <div class="store-location">
        ${store.is_open
          ? "🟢 Commerce ouvert"
          : "🔴 Commerce fermé"}
      </div>

      ${store.delivery_available ? `
        <div class="store-location">
          🚚 Livraison disponible
        </div>
      ` : ""}

      ${store.phone ? `
        <div class="store-location">
          📞 <a href="tel:${esc(
            String(store.phone).replace(/[^\d+]/g, "")
          )}">
            Contacter le commerce
          </a>
        </div>
      ` : ""}

      ${store.whatsapp ? `
        <div class="store-location">
          <a
            href="https://wa.me/${esc(
              String(store.whatsapp).replace(/\D/g, "")
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            💬 Écrire sur WhatsApp
          </a>
        </div>
      ` : ""}
    </div>
  `;
}

/* ---------- Galerie photos et vidéos ---------- */

async function loadGallery() {
  if (!activeStoreId || !galleryEl) return;

  galleryEl.innerHTML = `
    <div class="loading">Chargement de la galerie...</div>
  `;

  try {
    const query =
      `${SUPABASE_URL}/rest/v1/store_media?` +
      `select=id,media_type,media_url,title,is_cover,created_at` +
      `&store_id=eq.${encodeURIComponent(activeStoreId)}` +
      `&order=is_cover.desc,created_at.desc`;

    const media = await fetchRows(query);

    if (!Array.isArray(media) || media.length === 0) {
      galleryEl.innerHTML = `
        <div class="gallery-empty">
          📸 Aucune photo ou vidéo pour le moment.
        </div>
      `;
      return;
    }

    galleryEl.innerHTML = media.map(item => {
      const title = esc(item.title || "Galerie de la boutique");
      const url = esc(item.media_url || "");

      if (item.media_type === "video") {
        return `
          <div class="gallery-item gallery-video">
            <video
              src="${url}"
              controls
              playsinline
              preload="metadata"
            ></video>
            <div class="gallery-caption">🎥 ${title}</div>
          </div>
        `;
      }

      return `
        <div class="gallery-item">
          <img
            src="${url}"
            alt="${title}"
            loading="lazy"
            onerror="imageFallback(this, 'gallery')"
          >
          <div class="gallery-caption">📸 ${title}</div>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Erreur galerie :", error);

    galleryEl.innerHTML = `
      <div class="gallery-empty">
        Galerie temporairement indisponible.
      </div>
    `;
  }
}

/* ---------- Produits ---------- */

async function loadProducts() {
  if (!activeStoreId || !productsEl) return;

  productsEl.innerHTML = `
    <div class="loading">Chargement des produits...</div>
  `;

  try {
    const query =
      `${SUPABASE_URL}/rest/v1/products?` +
      `select=id,name,slug,description,price,image_url,is_available` +
      `&store_id=eq.${encodeURIComponent(activeStoreId)}` +
      `&is_available=eq.true` +
      `&order=created_at.desc`;

    const products = await fetchRows(query);

    if (!Array.isArray(products) || products.length === 0) {
      productsEl.innerHTML = `
        <div class="empty">
          Aucun produit disponible pour le moment.
        </div>
      `;
      return;
    }

    productsEl.innerHTML = products.map(product => {
      const price = Number(product.price || 0);

      const cartProduct = {
        id: product.id,
        name: product.name,
        price,
        image_url: product.image_url || "",
        store_id: activeStoreId
      };

      return `
        <article class="product-card">
          <div class="product-image">
            ${product.image_url ? `
              <img
                src="${esc(product.image_url)}"
                alt="${esc(product.name)}"
                loading="lazy"
                onerror="imageFallback(this, 'product')"
              >
            ` : `
              <div class="product-placeholder">
                🛍️ Image à venir
              </div>
            `}
          </div>

          <div class="product-content">
            <h3>${esc(product.name)}</h3>

            <p>
              ${esc(product.description || "Produit disponible.")}
            </p>

            <div class="price">
              ${price.toLocaleString("fr-FR")} FCFA
            </div>

            <button
              class="add-button"
              type="button"
              data-product="${esc(JSON.stringify(cartProduct))}"
            >
              Ajouter au panier
            </button>
          </div>
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error("Erreur produits :", error);

    productsEl.innerHTML = `
      <div class="empty error">
        Impossible de charger les produits.
        Réessaie dans quelques instants.
      </div>
    `;
  }
}

/* ---------- Panier ---------- */

function addToCart(product) {
  let cart;

  try {
    cart = JSON.parse(localStorage.getItem("pk_cart") || "[]");

    if (!Array.isArray(cart)) cart = [];
  } catch {
    cart = [];
  }

  if (
    cart.length &&
    String(cart[0].store_id) !== String(product.store_id)
  ) {
    const replace = confirm(
      "Ton panier contient déjà des produits d'un autre commerce. " +
      "Veux-tu le remplacer ?"
    );

    if (!replace) return;

    cart = [];
  }

  const existing = cart.find(
    item => String(item.id) === String(product.id)
  );

  if (existing) {
    existing.quantity = Number(existing.quantity || 0) + 1;
  } else {
    cart.push({
      ...product,
      quantity: 1
    });
  }

  localStorage.setItem("pk_cart", JSON.stringify(cart));
  updateCartCount();
  showToast("Produit ajouté au panier ✅");
}

if (productsEl) {
  productsEl.addEventListener("click", event => {
    const button = event.target.closest("[data-product]");

    if (!button) return;

    try {
      const product = JSON.parse(button.dataset.product);
      addToCart(product);
    } catch (error) {
      console.error("Erreur ajout panier :", error);
      showToast("Impossible d'ajouter ce produit.");
    }
  });
}

/* ---------- Démarrage ---------- */

updateCartCount();
loadStore();
