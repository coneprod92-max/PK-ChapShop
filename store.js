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
    throw new Error("Erreur de chargement des données.");
  }

  return response.json();
}

function updateCartCount() {
  try {
    const cart = JSON.parse(
      localStorage.getItem("pk_cart") || "[]"
    );

    cartCountEl.textContent = cart.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
  } catch {
    cartCountEl.textContent = "0";
  }
}

function showToast(message) {
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

async function loadStore() {
  if (!storeId) {
    storeInfoEl.innerHTML = `
      <div class="empty error">
        Commerce introuvable : aucun identifiant fourni.
      </div>
    `;
    galleryEl.innerHTML = "";
    productsEl.innerHTML = "";
    return;
  }

  try {
    const query =
      `${SUPABASE_URL}/rest/v1/stores?` +
      `select=id,name,description,phone,whatsapp,address,city,` +
      `logo_url,cover_url,is_open,delivery_available` +
      `&id=eq.${encodeURIComponent(storeId)}` +
      `&is_published=eq.true`;

    const stores = await fetchRows(query);

    if (!Array.isArray(stores) || !stores.length) {
      storeInfoEl.innerHTML = `
        <div class="empty error">
          Commerce introuvable ou non publié.
        </div>
      `;
      galleryEl.innerHTML = "";
      productsEl.innerHTML = "";
      return;
    }

    const store = stores[0];
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
          📍 ${esc(store.address || store.city || "Parakou")}
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
            📞 <a href="tel:${esc(String(store.phone).replace(/[^\d+]/g, ""))}">
              Contacter le commerce
            </a>
          </div>
        ` : ""}

        ${store.whatsapp ? `
          <div class="store-location">
            <a
              href="https://wa.me/${esc(String(store.whatsapp).replace(/\D/g, ""))}"
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 Écrire sur WhatsApp
            </a>
          </div>
        ` : ""}
      </div>
    `;

    await Promise.all([
      loadGallery(),
      loadProducts()
    ]);
  } catch (error) {
    console.error("Erreur commerce :", error);

    storeInfoEl.innerHTML = `
      <div class="empty error">
        Impossible de charger ce commerce.
        Vérifiez votre connexion puis réessayez.
      </div>
    `;
  }
}

async function loadGallery() {
  galleryEl.innerHTML = `
    <div class="loading">Chargement de la galerie...</div>
  `;

  try {
    const query =
      `${SUPABASE_URL}/rest/v1/store_media?` +
      `select=id,media_type,media_url,title,is_cover,created_at` +
      `&store_id=eq.${encodeURIComponent(storeId)}` +
      `&order=is_cover.desc,created_at.desc`;

    const media = await fetchRows(query);

    if (!Array.isArray(media) || !media.length) {
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

async function loadProducts() {
  productsEl.innerHTML = `
    <div class="loading">Chargement des produits...</div>
  `;

  try {
    const query =
      `${SUPABASE_URL}/rest/v1/products?` +
      `select=id,name,slug,description,price,image_url,is_available` +
      `&store_id=eq.${encodeURIComponent(storeId)}` +
      `&is_available=eq.true` +
      `&order=created_at.desc`;

    const products = await fetchRows(query);

    if (!Array.isArray(products) || !products.length) {
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
        store_id: storeId
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
        Réessayez dans quelques instants.
      </div>
    `;
  }
}

function addToCart(product) {
  let cart;

  try {
    cart = JSON.parse(localStorage.getItem("pk_cart") || "[]");

    if (!Array.isArray(cart)) {
      cart = [];
    }
  } catch {
    cart = [];
  }

  if (
    cart.length &&
    String(cart[0].store_id) !== String(product.store_id)
  ) {
    const replace = confirm(
      "Votre panier contient déjà des produits d'un autre commerce. " +
      "Voulez-vous le remplacer ?"
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

updateCartCount();
loadStore();
