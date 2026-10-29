
/* =========================================================
   PK-ChapShop — Application publique
   Commerces, catégories, recherche et mises à la une
   ========================================================= */

const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const categoriesEl = document.getElementById("categories");
const storesEl = document.getElementById("stores");
const searchInput = document.getElementById("searchInput");
const cartCountEl = document.getElementById("cartCount");
const resultsLabel = document.getElementById("resultsLabel");

let categories = [];
let stores = [];
let products = [];
let selectedCategory = null;
let storesError = null;
let productsError = null;

/* ---------- Utilitaires ---------- */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- WhatsApp ---------- */

function getWhatsAppLink(number, message) {
  let digits = String(number || "").trim().replace(/\D/g, "");

  // Convertir le préfixe international 00 en indicatif classique.
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Numéro béninois local à 10 chiffres : 01XXXXXXXX.
  if (digits.length === 10 && digits.startsWith("01")) {
    digits = "229" + digits;
  }

  // Éviter les liens incomplets ou les numéros trop longs.
  if (digits.length < 8 || digits.length > 15) {
    return "";
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

async function supabaseGet(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase (${response.status}) : ${detail || response.statusText}`
    );
  }

  return response.json();
}

function isFeaturedActive(item) {
  if (item?.is_featured !== true) return false;

  if (!item.featured_until) return true;

  const end = new Date(item.featured_until).getTime();

  return Number.isFinite(end) && end > Date.now();
}

function storeIsPublished(store) {
  return store?.is_published === true;
}

/* ---------- Catégories ---------- */

async function loadCategories() {
  if (!categoriesEl) return;

  try {
    let result;

    try {
      result = await supabaseGet(
        "store_categories?select=id,name,slug,icon&order=name.asc"
      );
    } catch (firstError) {
      // Compatibilité si la colonne icon n'existe pas.
      result = await supabaseGet(
        "store_categories?select=id,name,slug&order=name.asc"
      );
    }

    categories = Array.isArray(result) ? result : [];
    renderCategories();
  } catch (error) {
    console.error("Erreur de chargement des catégories :", error);

    categoriesEl.innerHTML = `
      <div class="empty">
        Les catégories sont momentanément indisponibles.
      </div>
    `;
  }
}

function renderCategories() {
  if (!categoriesEl) return;

  const allButton = `
    <button type="button"
      class="category ${selectedCategory === null ? "active" : ""}"
      data-category="">
      <span class="category-icon">✨</span>
      <span class="category-name">Tous</span>
    </button>
  `;

  const categoryButtons = categories.map(category => `
    <button type="button"
      class="category ${
        String(selectedCategory) === String(category.id) ? "active" : ""
      }"
      data-category="${escapeHTML(category.id)}">
      <span class="category-icon">${escapeHTML(category.icon || "🏪")}</span>
      <span class="category-name">${escapeHTML(category.name)}</span>
    </button>
  `).join("");

  categoriesEl.innerHTML = allButton + categoryButtons;

  categoriesEl.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      const value = button.getAttribute("data-category");
      filterCategory(value === "" ? null : value);
    });
  });
}

function filterCategory(categoryId) {
  selectedCategory = categoryId;
  renderCategories();
  renderStores();
}

window.filterCategory = filterCategory;

/* ---------- Commerces ---------- */

async function loadStores() {
  if (!storesEl) return;

  storesError = null;

  storesEl.innerHTML = `
    <div class="loading">
      <span class="loading-spinner"></span>
      Chargement des commerces...
    </div>
  `;

  try {
    /*
     * Première tentative : colonnes complètes, y compris la mise à la une.
     */
    try {
      stores = await supabaseGet(
        "stores?select=id,name,slug,description,phone,whatsapp,address,city,logo_url,cover_url,is_open,delivery_available,category_id,is_published,is_featured,featured_until&is_published=eq.true&order=created_at.desc"
      );
    } catch (firstError) {
      console.warn(
        "Chargement avec les champs de mise en avant impossible :",
        firstError
      );

      /*
       * CORRECTION IMPORTANTE :
       * whatsapp est également récupéré dans la requête de secours.
       */
      stores = await supabaseGet(
        "stores?select=id,name,slug,description,phone,whatsapp,address,city,logo_url,cover_url,is_open,delivery_available,category_id,is_published&is_published=eq.true&order=created_at.desc"
      );

      stores = stores.map(store => ({
        ...store,
        is_featured: false,
        featured_until: null
      }));
    }

    if (!Array.isArray(stores)) {
      throw new Error("La réponse des commerces n'est pas une liste valide.");
    }

    renderStores();
  } catch (error) {
    storesError = error;
    console.error("Erreur de chargement des commerces :", error);

    storesEl.innerHTML = `
      <div class="empty error">
        <p>Impossible de charger les commerces.</p>
        <p style="font-size:12px;margin-top:8px">
          Vérifie les autorisations de lecture Supabase et les colonnes
          de la table stores.
        </p>
        <button type="button" class="view-button" id="retryStores">
          Réessayer
        </button>
      </div>
    `;

    const retryButton = document.getElementById("retryStores");

    if (retryButton) {
      retryButton.addEventListener("click", loadStores);
    }
  }
}

/* ---------- Produits ---------- */

async function loadProducts() {
  productsError = null;
  products = [];

  try {
    try {
      products = await supabaseGet(
        "products?select=id,store_id,name,description,price,image_url,is_available,is_featured,featured_until&is_available=eq.true"
      );
    } catch (firstError) {
      console.warn(
        "Chargement des produits avec les champs de mise en avant impossible :",
        firstError
      );

      products = await supabaseGet(
        "products?select=id,store_id,name,description,price,image_url,is_available&is_available=eq.true"
      );

      products = products.map(product => ({
        ...product,
        is_featured: false,
        featured_until: null
      }));
    }

    if (!Array.isArray(products)) {
      throw new Error("La réponse des produits n'est pas une liste valide.");
    }
  } catch (error) {
    productsError = error;
    products = [];
    console.error("Erreur de chargement des produits :", error);
  }
}

/* ---------- Recherche et filtrage ---------- */

function getVisibleStores() {
  const search = normalizeText(searchInput?.value || "");

  return stores.filter(store => {
    const categoryMatches =
      selectedCategory === null ||
      String(store.category_id) === String(selectedCategory);

    const storeMatches =
      !search ||
      normalizeText(store.name).includes(search) ||
      normalizeText(store.description).includes(search) ||
      normalizeText(store.city).includes(search) ||
      normalizeText(store.address).includes(search);

    const productMatches = search && products.some(product =>
      String(product.store_id) === String(store.id) &&
      (
        normalizeText(product.name).includes(search) ||
        normalizeText(product.description).includes(search)
      )
    );

    return categoryMatches && (storeMatches || productMatches);
  }).sort((a, b) =>
    Number(isFeaturedActive(b)) - Number(isFeaturedActive(a))
  );
}

function getVisibleFeaturedProducts() {
  const search = normalizeText(searchInput?.value || "");

  return products.filter(product => {
    if (!isFeaturedActive(product)) return false;

    const parentStore = stores.find(
      store => String(store.id) === String(product.store_id)
    );

    // Ne pas afficher un produit si son commerce n'est pas publié.
    if (!parentStore || !storeIsPublished(parentStore)) return false;

    if (
      selectedCategory !== null &&
      String(parentStore.category_id) !== String(selectedCategory)
    ) {
      return false;
    }

    if (!search) return true;

    return (
      normalizeText(product.name).includes(search) ||
      normalizeText(product.description).includes(search) ||
      normalizeText(parentStore.name).includes(search) ||
      normalizeText(parentStore.city).includes(search)
    );
  });
}

/* ---------- Affichage ---------- */

function renderStores() {
  if (!storesEl) return;

  storesEl.style.display = "block";

  const visibleStores = getVisibleStores();
  const featuredProducts = getVisibleFeaturedProducts();

  if (resultsLabel) {
    resultsLabel.textContent = visibleStores.length === 1
      ? "1 commerce affiché"
      : `${visibleStores.length} commerces affichés`;
  }

  /* Produits à la une */

  const featuredProductsHTML = featuredProducts.length
    ? `
      <section class="pk-featured-section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">⭐ SÉLECTION DU MOMENT</span>
            <h2>Produits à <span>la une.</span></h2>
            <p>Les produits sélectionnés par nos commerçants.</p>
          </div>
        </div>

        <div class="pk-featured-grid">
          ${featuredProducts.map(product => {
            const store = stores.find(
              item => String(item.id) === String(product.store_id)
            );

            const storeLink =
              `store.html?id=${encodeURIComponent(product.store_id)}`;

            const productWhatsApp = getWhatsAppLink(
              store?.whatsapp || store?.phone,
              `Bonjour ${store?.name || ""} ! Je souhaite commander le produit "${product.name}" vu sur PK-ChapShop. Pouvez-vous me donner les informations pour la commande ?`
            );

            return `
              <article class="store-card pk-product-card">

                <div class="pk-product-symbol ${
                  product.image_url ? "has-image" : ""
                }">
                  ${product.image_url
                    ? `<img
                        src="${escapeHTML(product.image_url)}"
                        alt="${escapeHTML(product.name)}"
                        loading="lazy"
                        onerror="this.remove(); this.parentElement.classList.remove('has-image'); this.parentElement.textContent='🛍️';"
                      >`
                    : "🛍️"}
                </div>

                <div class="store-content">
                  <span class="pk-featured-badge">PRODUIT À LA UNE</span>

                  <h3>${escapeHTML(product.name)}</h3>

<div class="pk-product-price">
  ${product.price !== null && product.price !== undefined &&
    String(product.price).trim() !== "" &&
    Number.isFinite(Number(product.price))
      ? `${Number(product.price).toLocaleString("fr-FR", {
          maximumFractionDigits: 2
        })} FCFA`
      : "Prix à confirmer"}
</div>

<p>${escapeHTML(
  product.description || "Découvrez ce produit."
)}</p>

                  <div class="store-meta">
                    🏪 ${escapeHTML(store?.name || "Commerce partenaire")}
                    ${store?.city
                      ? ` · 📍 ${escapeHTML(store.city)}`
                      : ""}
                  </div>

                  <a class="view-button" href="${storeLink}">
                    Voir le commerce →
                  </a>

                  ${productWhatsApp ? `
                    <a
                      class="pk-whatsapp-button"
                      href="${escapeHTML(productWhatsApp)}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span aria-hidden="true">◉</span>
                      Commander sur WhatsApp
                    </a>
                  ` : ""}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `
    : "";

  /* Cartes des commerces */

  const storesHTML = visibleStores.length
    ? `
      <section class="pk-stores-section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">LE MARCHÉ LOCAL</span>
            <h2>
              ${searchInput?.value ? "Résultats de" : "Nos commerces à"}
              <span>${
                searchInput?.value ? "recherche." : "découvrir."
              }</span>
            </h2>
          </div>
        </div>

        <div class="pk-store-grid">
          ${visibleStores.map(store => {
            const image = store.cover_url || "";
const featured = isFeaturedActive(store);

const storeLogo = store.logo_url || "";

const storeCategory = categories.find(
  category => String(category.id) === String(store.category_id)
);

            const storeLink =
              `store.html?id=${encodeURIComponent(store.id)}`;

            const storeWhatsApp = getWhatsAppLink(
              store.whatsapp || store.phone,
              `Bonjour ${store.name} ! Je vous contacte depuis PK-ChapShop. Pouvez-vous me renseigner sur vos produits et services ?`
            );

            return `
              <article class="store-card ${
                featured ? "pk-store-featured" : ""
              }">
                
<div class="store-cover pk-store-cover"
  style="${image
    ? `background-image:url('${escapeHTML(image)}')`
    : ""}">

  ${!image ? '<span class="pk-cover-placeholder" aria-hidden="true">🏪</span>' : ""}

  ${featured
    ? '<span class="pk-featured-badge pk-cover-badge">⭐ À LA UNE</span>'
    : ""}

  ${storeLogo ? `
    <div class="pk-store-logo">
      <img
        src="${escapeHTML(storeLogo)}"
        alt="Logo de ${escapeHTML(store.name)}"
        loading="lazy"
        onerror="this.parentElement.style.display='none';"
      >
    </div>
  ` : ""}

</div>

                  ${image
                    ? `style="background-image:url('${escapeHTML(image)}')"`
                    : ""}>
                  ${!image
                    ? '<span aria-hidden="true">🏪</span>'
                    : ""}

                  ${featured
                    ? '<span class="pk-featured-badge pk-cover-badge">⭐ À LA UNE</span>'
                    : ""}
                </div>

                <div class="store-content">
                  ${featured
                    ? '<span class="pk-featured-badge">COMMERCE À LA UNE</span>'
                    : ""}

                  <h3>${escapeHTML(store.name)}</h3>
${storeCategory ? `
  <span class="pk-store-category">
    ${escapeHTML(storeCategory.icon || "🏪")}
    ${escapeHTML(storeCategory.name)}
  </span>
` : ""}
                  <p>${escapeHTML(
                    store.description || "Découvrez ce commerce local."
                  )}</p>

                  <div class="store-meta">
                    📍 ${escapeHTML(store.city || "Bénin")}
                    ${store.is_open === true ? " · 🟢 Ouvert" : ""}
                    ${store.delivery_available ? " · 🚚 Livraison" : ""}
                  </div>

                  <a class="view-button" href="${storeLink}">
                    Voir le commerce →
                  </a>

                  ${storeWhatsApp ? `
                    <a
                      class="pk-whatsapp-button"
                      href="${escapeHTML(storeWhatsApp)}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span aria-hidden="true">◉</span>
                      Contacter sur WhatsApp
                    </a>
                  ` : ""}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `
    : `
      <div class="empty">
        <p>Aucun commerce ne correspond à cette recherche.</p>
        <button type="button" class="view-button" id="clearSearchButton">
          Effacer les filtres
        </button>
      </div>
    `;

  let productWarning = "";

  if (productsError) {
    productWarning = `
      <p class="pk-load-warning">
        Les commerces sont affichés, mais les produits n'ont pas pu être chargés.
      </p>
    `;
  }

  if (!visibleStores.length && !featuredProducts.length && storesError) {
    return;
  }

  storesEl.innerHTML = `
    <style>
      #stores {
        display: block !important;
        width: 100%;
      }

      .pk-featured-section,
      .pk-stores-section {
        display: block;
        width: 100%;
        margin: 0 0 36px;
      }

      .pk-featured-grid,
      .pk-store-grid {
        display: grid;
        grid-template-columns: repeat(
          auto-fit,
          minmax(min(100%, 240px), 1fr)
        );
        gap: 20px;
        width: 100%;
      }

      .pk-featured-section .section-heading,
      .pk-stores-section .section-heading {
        margin: 0 0 20px;
      }

      .pk-featured-section h2,
      .pk-stores-section h2 {
        color: #123b2d;
        font-size: clamp(24px, 3vw, 34px);
        font-weight: 800;
      }

      .pk-featured-section h2 span,
      .pk-stores-section h2 span {
        color: #b78b34;
      }

      .pk-featured-badge {
        display: inline-block;
        width: fit-content;
        margin: 0 0 9px;
        padding: 5px 9px;
        border-radius: 5px;
        background: #d5ad58;
        color: #123b2d;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .5px;
      }

      .pk-cover-badge {
        position: absolute;
        top: 12px;
        left: 12px;
      }

      .pk-store-cover {
        position: relative;
        background-size: cover;
        background-position: center;
      }

      .pk-store-cover > span:not(.pk-featured-badge) {
        font-size: 44px;
      }

      .pk-store-featured {
        border: 2px solid #d5ad58;
      }

      .pk-product-symbol.has-image {
        padding: 0;
        overflow: hidden;
        background: #f7f5ef;
      }

      .pk-product-symbol.has-image img {
        display: block;
        width: 100%;
        height: 190px;
        object-fit: cover;
      }

      .pk-load-warning {
        margin: 0 0 18px;
        padding: 12px 15px;
        border-radius: 10px;
        background: #fff7e7;
        color: #76571c;
        font-size: 13px;
      }

      .pk-featured-grid .store-card,
      .pk-store-grid .store-card {
        min-width: 0;
      }

/* ==========================================
   PK-ChapShop — Cartes premium produits
   et commerces
   ========================================== */

/* Cartes : bordures fines, relief et animation */
.pk-featured-grid .pk-product-card,
.pk-store-grid .store-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e9e5d9;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 5px 18px rgba(18, 59, 45, 0.07);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    border-color 0.25s ease;
}

.pk-featured-grid .pk-product-card:hover,
.pk-store-grid .store-card:hover {
  transform: translateY(-5px);
  border-color: #d5ad58;
  box-shadow: 0 13px 30px rgba(18, 59, 45, 0.13);
}

/* Photos des commerces */
.pk-store-grid .pk-store-cover {
  height: 190px;
  min-height: 190px;
  overflow: hidden;
  background-color: #f4f1e8;
  background-size: cover;
  background-position: center;
  border-radius: 0;
}

/* Photos des produits */
.pk-featured-grid .pk-product-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 190px;
  min-height: 190px;
  overflow: hidden;
  background: linear-gradient(145deg, #f8f6ef, #eeeadf);
  color: #b78b34;
  font-size: 48px;
}

/* Image : remplir proprement la zone */
.pk-featured-grid .pk-product-symbol.has-image {
  padding: 0;
}

.pk-featured-grid .pk-product-symbol.has-image img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 190px;
  object-fit: cover;
  transition: transform 0.35s ease;
}

.pk-featured-grid .pk-product-card:hover .pk-product-symbol img {
  transform: scale(1.04);
}

/* Espacement intérieur */
.pk-featured-grid .pk-product-card .store-content,
.pk-store-grid .store-card .store-content {
  padding: 18px;
  gap: 10px;
}

/* Titres plus nets */
.pk-featured-grid .store-content h3,
.pk-store-grid .store-content h3 {
  margin: 0;
  color: #123b2d;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

/* Descriptions plus lisibles */
.pk-featured-grid .store-content > p,
.pk-store-grid .store-content > p {
  margin: 0;
  color: #666b66;
  font-size: 13px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

/* Informations sur le commerce */
.pk-featured-grid .store-meta,
.pk-store-grid .store-meta {
  margin-top: 2px;
  color: #52665a;
  font-size: 12px;
  line-height: 1.7;
}

/* Prix des produits : conserver le vert et le doré */
.pk-featured-grid .pk-product-price {
  margin: 2px 0 5px;
  color: #a77b24;
  font-size: 25px;
  font-weight: 900;
  line-height: 1.35;
}

/* Bouton pour consulter le commerce */
.pk-featured-grid .store-content .view-button,
.pk-store-grid .store-content .view-button {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 44px;
  margin-top: 5px;
  padding: 12px 14px;
  border: 1px solid #123b2d;
  border-radius: 10px;
  background: #123b2d;
  color: #ffffff;
  text-align: center;
  text-decoration: none;
  font-size: 13px;
  font-weight: 800;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.pk-featured-grid .store-content .view-button:hover,
.pk-store-grid .store-content .view-button:hover {
  border-color: #b78b34;
  background: #1c503d;
  color: #ffffff;
}

/* Bouton WhatsApp : harmonisé avec les cartes */
.pk-featured-grid .pk-whatsapp-button,
.pk-store-grid .pk-whatsapp-button {
  box-sizing: border-box;
  min-height: 44px;
  margin-top: 0;
  border-radius: 10px;
  font-size: 12px;
}

/* Badge doré plus élégant */
.pk-featured-grid .pk-featured-badge,
.pk-store-grid .pk-featured-badge {
  border-radius: 5px;
  letter-spacing: 0.6px;
}

/* Adaptation aux petits écrans */
@media (max-width: 600px) {
  .pk-featured-grid .pk-product-card,
  .pk-store-grid .store-card {
    border-radius: 15px;
  }

  .pk-featured-grid .pk-product-symbol,
  .pk-store-grid .pk-store-cover {
    height: 200px;
    min-height: 200px;
  }

  .pk-featured-grid .pk-product-symbol.has-image img {
    min-height: 200px;
  }

  .pk-featured-grid .pk-product-card .store-content,
  .pk-store-grid .store-card .store-content {
    padding: 15px;
  }

  .pk-featured-grid .pk-product-price {
    font-size: 23px;
  }
}

      .pk-whatsapp-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        width: 100%;
        box-sizing: border-box;
        margin-top: 10px;
        padding: 13px 15px;
        border: 1px solid #1f9d58;
        border-radius: 11px;
        background: #168849;
        color: #fff;
        text-align: center;
        text-decoration: none;
        font-size: 12px;
        font-weight: 800;
        transition: background .2s, transform .2s;
      }

      .pk-whatsapp-button:hover {
        background: #116d39;
        color: #fff;
        transform: translateY(-2px);
      }

      .pk-whatsapp-button span {
        font-size: 17px;
        line-height: 1;
      }

      .pk-product-card .store-content,
      .pk-store-grid .store-content {
        display: flex;
        flex-direction: column;
      }

      .pk-product-card .store-content > a,
      .pk-store-grid .store-content > a {
        width: 100%;
        box-sizing: border-box;
      }
.pk-product-price {
  display: block;
  margin: 8px 0 12px;
  color: #b78b34;
  font-size: 25px;
  font-weight: 900;
  line-height: 1.3;
  letter-spacing: -0.4px;
}

.pk-product-card .store-content h3 {
  margin-bottom: 2px;
}

@media (max-width: 600px) {
  .pk-product-price {
    font-size: 23px;
  }
}
      @media (max-width: 600px) {
        .pk-featured-grid,
        .pk-store-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      
/* Vitrines des commerces */
.pk-store-grid .pk-store-cover {
  position: relative;
  width: 100%;
  height: 185px;
  min-height: 185px;
  overflow: hidden;
  background-color: #f2efe5;
  background-position: center;
  background-size: cover;
  border-radius: 0;
}

/* Logo indépendant de la photo de couverture */
.pk-store-logo {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 66px;
  height: 66px;
  overflow: hidden;
  border: 3px solid #fff;
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, .18);
}

.pk-store-logo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Catégorie lisible */
.pk-store-category {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  max-width: 100%;
  padding: 6px 10px;
  border: 1px solid #e9dfc4;
  border-radius: 20px;
  background: #faf6e9;
  color: #72551d;
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

/* Prévenir les débordements de texte */
.pk-store-grid .store-content,
.pk-store-grid .store-content h3,
.pk-store-grid .store-content p {
  min-width: 0;
  overflow-wrap: anywhere;
}

/* Images et cartes sur mobile */
@media (max-width: 600px) {
  #stores {
    max-width: 100%;
    overflow-x: clip;
  }

  .pk-store-grid,
  .pk-featured-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .pk-store-grid .pk-store-cover {
    height: 175px;
    min-height: 175px;
  }

  .pk-store-logo {
    width: 58px;
    height: 58px;
    right: 12px;
    bottom: 12px;
  }

  .pk-store-grid .store-content h3 {
    font-size: 18px;
    line-height: 1.45;
  }

  .pk-store-grid .store-content > p {
    font-size: 14px;
    line-height: 1.7;
  }

  .pk-store-grid .store-content .view-button,
  .pk-store-grid .store-content .pk-whatsapp-button {
    min-height: 46px;
    font-size: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pk-store-grid .store-card,
  .pk-featured-grid .pk-product-card,
  .pk-whatsapp-button {
    transition: none;
    transform: none;
  }
}

    </style>

    ${productWarning}
    ${featuredProductsHTML}
    ${storesHTML}
  `;

  const clearButton = document.getElementById("clearSearchButton");

  if (clearButton) {
    clearButton.addEventListener("click", clearSearch);
  }
}

function clearSearch() {
  if (searchInput) searchInput.value = "";

  selectedCategory = null;
  renderCategories();
  renderStores();
}

window.clearSearch = clearSearch;
window.loadStores = loadStores;

/* ---------- Panier ---------- */

function updateCartCount() {
  if (!cartCountEl) return;

  try {
    const cart = JSON.parse(localStorage.getItem("pk_cart") || "[]");

    const count = Array.isArray(cart)
      ? cart.reduce((total, item) => {
          const quantity = Number(item.quantity ?? 1);
          return total + (
            Number.isFinite(quantity) ? quantity : 0
          );
        }, 0)
      : 0;

    cartCountEl.textContent = String(count);
  } catch (error) {
    console.warn("Lecture du panier impossible :", error);
    cartCountEl.textContent = "0";
  }
}

/* ---------- Recherche ---------- */

if (searchInput) {
  searchInput.addEventListener("input", renderStores);
}

/* ---------- Démarrage ---------- */

async function initializePKChapShop() {
  updateCartCount();

  // Une erreur de produits ne bloque pas le chargement des commerces.
  await Promise.allSettled([
    loadCategories(),
    loadStores()
  ]);

  await loadProducts();
  renderStores();
}

initializePKChapShop();
