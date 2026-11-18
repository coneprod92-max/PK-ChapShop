
/* =========================================================
   PK-ChapShop — Application publique
   Commerces, catégories, recherche et mises à la une
   Version : Featured Experience 2026
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
let storeFeaturedMetadataAvailable = true;
let storeFeaturedMetadataError = null;
let productFeaturedMetadataError = null;

window.PKChapShopGetSearchData = () => ({
  stores,
  categories,
  products
});

/* =========================================================
   UTILITAIRES
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

function getPriority(item) {
  const priority = Number(item?.featured_priority);

  return Number.isFinite(priority) && priority > 0
    ? priority
    : 9999;
}

function comparePriority(a, b) {
  return (
    getPriority(a) - getPriority(b) ||
    String(a.name || "").localeCompare(
      String(b.name || ""),
      "fr"
    )
  );
}

/* =========================================================
   WHATSAPP
   ========================================================= */

function getWhatsAppLink(number, message) {
  let digits = String(number || "")
    .trim()
    .replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === 10 && digits.startsWith("01")) {
    digits = "229" + digits;
  }

  if (digits.length < 8 || digits.length > 15) {
    return "";
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/* =========================================================
   SUPABASE
   ========================================================= */

async function supabaseGet(path) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");

    throw new Error(
      `Supabase (${response.status}) : ${
        detail || response.statusText
      }`
    );
  }

  return response.json();
}

/* =========================================================
   GESTION DES MISES À LA UNE
   ========================================================= */

function isFeaturedActive(item) {
  if (item?.is_featured !== true) return false;

  if (!item.featured_until) return true;

  const expiration = new Date(
    item.featured_until
  ).getTime();

  return (
    Number.isFinite(expiration) &&
    expiration > Date.now()
  );
}

function storeIsPublished(store) {
  return store?.is_published === true;
}

function getStoreById(storeId) {
  return stores.find(
    store => String(store.id) === String(storeId)
  ) || null;
}

function isStoreFeatured(store) {
  return Boolean(
    store &&
    storeIsPublished(store) &&
    isFeaturedActive(store)
  );
}

/*
 * Trois situations :
 *
 * 1. inherited :
 *    Produit d'une boutique mise à la une.
 *
 * 2. individual :
 *    Produit sélectionné individuellement.
 *
 * 3. none :
 *    Produit ordinaire.
 *
 * Une priorité héritée ne modifie jamais
 * products.is_featured.
 */

function getProductFeaturedType(product) {
  if (!product || product.is_available !== true) {
    return "none";
  }

  const store = getStoreById(product.store_id);

  if (!store || !storeIsPublished(store)) {
    return "none";
  }

  if (isStoreFeatured(store)) {
    return "inherited";
  }

  if (isFeaturedActive(product)) {
    return "individual";
  }

  return "none";
}

function getProductFeaturedPriority(product) {
  const store = getStoreById(product.store_id);
  const type = getProductFeaturedType(product);

  if (type === "inherited") {
    return getPriority(store);
  }

  if (type === "individual") {
    return getPriority(product);
  }

  return 9999;
}

/* =========================================================
   CATÉGORIES
   ========================================================= */

function formatProductPrice(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "Prix à confirmer";
  }

  return `${Number(value).toLocaleString("fr-FR", {
    maximumFractionDigits: 2
  })} FCFA`;
}

async function loadCategories() {
  if (!categoriesEl) return;

  try {
    let result;

    try {
      result = await supabaseGet(
        "store_categories?select=id,name,slug,icon&order=name.asc"
      );
    } catch (firstError) {
      result = await supabaseGet(
        "store_categories?select=id,name,slug&order=name.asc"
      );
    }

    categories = Array.isArray(result) ? result : [];

    renderCategories();
  } catch (error) {
    console.error(
      "Erreur de chargement des catégories :",
      error
    );

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
    <button
      type="button"
      class="category ${
        selectedCategory === null ? "active" : ""
      }"
      data-category=""
    >
      <span class="category-icon">✨</span>
      <span class="category-name">Tous</span>
    </button>
  `;

  const categoryButtons = categories.map(category => `
    <button
      type="button"
      class="category ${
        String(selectedCategory) === String(category.id)
          ? "active"
          : ""
      }"
      data-category="${escapeHTML(category.id)}"
    >
      <span class="category-icon">
        ${escapeHTML(category.icon || "🏪")}
      </span>

      <span class="category-name">
        ${escapeHTML(category.name)}
      </span>
    </button>
  `).join("");

  categoriesEl.innerHTML =
    allButton + categoryButtons;

  categoriesEl
    .querySelectorAll("[data-category]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const value = button.getAttribute("data-category");

        filterCategory(
          value === "" ? null : value
        );
      });
    });
}

function filterCategory(categoryId) {
  selectedCategory = categoryId;

  renderCategories();
  renderStores();
}

window.filterCategory = filterCategory;

/* =========================================================
   CHARGEMENT DES COMMERCES
   ========================================================= */

async function loadStores() {
  if (!storesEl) return;

  storesError = null;
  storeFeaturedMetadataAvailable = true;
  storeFeaturedMetadataError = null;

  storesEl.innerHTML = `
    <div class="loading">
      <span class="loading-spinner"></span>
      Chargement des commerces...
    </div>
  `;

  try {
    const publicStores = await supabaseGet(
      "stores?select=id,name,slug,description,phone,whatsapp,address,city,logo_url,cover_url,is_open,delivery_available,category_id,is_published&is_published=eq.true&order=created_at.desc"
    );

    if (!Array.isArray(publicStores)) {
      throw new Error(
        "La réponse des commerces n'est pas une liste valide."
      );
    }

    stores = publicStores;

    try {
      const featuredMetadata = await supabaseGet(
        "stores?select=id,is_featured,featured_until,featured_priority&is_published=eq.true"
      );

      if (!Array.isArray(featuredMetadata)) {
        throw new Error(
          "Les métadonnées des mises en avant ne sont pas une liste valide."
        );
      }

      const metadataById = new Map(
        featuredMetadata.map(store => [String(store.id), store])
      );

      if (publicStores.some(store => !metadataById.has(String(store.id)))) {
        throw new Error(
          "Les métadonnées des mises en avant sont incomplètes."
        );
      }

      stores = publicStores.map(store => ({
        ...store,
        ...metadataById.get(String(store.id))
      }));
    } catch (error) {
      storeFeaturedMetadataAvailable = false;
      storeFeaturedMetadataError = error;

      console.error(
        "Lecture des champs de mise en avant des commerces impossible :",
        error
      );
    }

    renderStores();
  } catch (error) {
    storesError = error;

    console.error(
      "Erreur de chargement des commerces :",
      error
    );

    storesEl.innerHTML = `
      <div class="empty error">
        <p>Impossible de charger les commerces.</p>

        <p style="font-size:12px;margin-top:8px">
          Vérifie les autorisations de lecture Supabase
          et les colonnes de la table stores.
        </p>

        <button
          type="button"
          class="view-button"
          id="retryStores"
        >
          Réessayer
        </button>
      </div>
    `;

    document
      .getElementById("retryStores")
      ?.addEventListener("click", loadStores);
  }
}

/* =========================================================
   CHARGEMENT DES PRODUITS
   ========================================================= */

async function loadProducts() {
  productsError = null;
  products = [];
  productFeaturedMetadataError = null;

  try {
    try {
      products = await supabaseGet(
        "products?select=id,store_id,name,description,price,image_url,is_available,is_featured,featured_until,featured_priority&is_available=eq.true"
      );
    } catch (firstError) {
      console.warn(
        "Chargement des champs de mise en avant des produits impossible :",
        firstError
      );

      products = await supabaseGet(
        "products?select=id,store_id,name,description,price,image_url,is_available&is_available=eq.true"
      );

      productFeaturedMetadataError = firstError;
    }

    if (!Array.isArray(products)) {
      throw new Error(
        "La réponse des produits n'est pas une liste valide."
      );
    }
  } catch (error) {
    productsError = error;
    products = [];

    console.error(
      "Erreur de chargement des produits :",
      error
    );
  }
}

/* =========================================================
   RECHERCHE ET FILTRAGE
   ========================================================= */

function storeMatchesSearch(store, search) {
  if (!search) return true;

  const hybridSearch = window.PKChapShopHybridSearch;

  if (hybridSearch) {
    const data = window.PKChapShopGetSearchData();

    return (
      hybridSearch.matchStore(store, search, data) > 0
    );
  }

  const normalizedSearch = normalizeText(search);

  return (
    normalizeText(store.name).includes(normalizedSearch) ||
    normalizeText(store.description).includes(normalizedSearch) ||
    normalizeText(store.city).includes(normalizedSearch) ||
    normalizeText(store.address).includes(normalizedSearch) ||
    products.some(product =>
      String(product.store_id) === String(store.id) &&
      (
        normalizeText(product.name).includes(normalizedSearch) ||
        normalizeText(product.description).includes(normalizedSearch)
      )
    )
  );
}

function productMatchesSearch(product, search) {
  if (!search) return true;

  const store = getStoreById(product.store_id);

  const hybridSearch = window.PKChapShopHybridSearch;

  if (hybridSearch) {
    const data = window.PKChapShopGetSearchData();

    return (
      hybridSearch.matchProduct(product, search, data) > 0
    );
  }

  const normalizedSearch = normalizeText(search);

  return (
    normalizeText(product.name).includes(normalizedSearch) ||
    normalizeText(product.description).includes(normalizedSearch) ||
    normalizeText(store?.name).includes(normalizedSearch) ||
    normalizeText(store?.city).includes(normalizedSearch)
  );
}

function categoryMatchesStore(store) {
  return (
    selectedCategory === null ||
    String(store.category_id) === String(selectedCategory)
  );
}

function getVisibleStores() {
  const search = searchInput?.value || "";

  const visibleStores = stores
    .filter(store =>
      storeIsPublished(store) &&
      categoryMatchesStore(store) &&
      storeMatchesSearch(store, search)
    );

  if (!storeFeaturedMetadataAvailable) {
    return visibleStores;
  }

  return visibleStores.sort((a, b) => {
    const featuredDifference =
      Number(isStoreFeatured(b)) -
      Number(isStoreFeatured(a));

    return featuredDifference || comparePriority(a, b);
  });
}

/*
 * Retourne les produits bénéficiant d'une priorité.
 *
 * Les produits hérités passent avant les produits
 * individuellement sélectionnés.
 *
 * Chaque produit apparaît une seule fois.
 */

function getVisibleFeaturedProducts() {
  const search = searchInput?.value || "";

  return products
    .filter(product => {
      if (product.is_available !== true) {
        return false;
      }

      const store = getStoreById(product.store_id);

      if (!store || !storeIsPublished(store)) {
        return false;
      }

      if (!categoryMatchesStore(store)) {
        return false;
      }

      const type = getProductFeaturedType(product);

      if (type === "none") {
        return false;
      }

      return productMatchesSearch(product, search);
    })
    .sort((a, b) => {
      const typeA = getProductFeaturedType(a);
      const typeB = getProductFeaturedType(b);

      const inheritedDifference =
        Number(typeB === "inherited") -
        Number(typeA === "inherited");

      if (inheritedDifference) {
        return inheritedDifference;
      }

      const priorityDifference =
        getProductFeaturedPriority(a) -
        getProductFeaturedPriority(b);

      if (priorityDifference) {
        return priorityDifference;
      }

      return String(a.name || "").localeCompare(
        String(b.name || ""),
        "fr"
      );
    });
}

/* =========================================================
   CATÉGORIES DES COMMERCES
   ========================================================= */

function getStoreCategory(store) {
  return categories.find(
    category =>
      String(category.id) === String(store.category_id)
  ) || null;
}

/* =========================================================
   CARTE PRODUIT
   ========================================================= */

function renderProductCard(product) {
  const store = getStoreById(product.store_id);

  if (!store || !storeIsPublished(store)) {
    return "";
  }

  const storeLink =
    `store.html?id=${encodeURIComponent(product.store_id)}`;

  const productWhatsApp = getWhatsAppLink(
    store.whatsapp || store.phone,
    `Bonjour ${store.name || ""} ! Je souhaite commander le produit "${product.name}" vu sur PK-ChapShop. Pouvez-vous me donner les informations pour la commande ?`
  );

  const type = getProductFeaturedType(product);

  const inherited = type === "inherited";

  const price = formatProductPrice(product.price);

  return `
    <article
      class="store-card pk-product-card"
      data-product-id="${escapeHTML(product.id)}"
    >

      <div class="pk-product-symbol ${
        product.image_url ? "has-image" : ""
      }">

        ${
          product.image_url
            ? `
              <img
                src="${escapeHTML(product.image_url)}"
                alt="${escapeHTML(product.name)}"
                loading="lazy"
                onerror="this.hidden=true;this.parentElement.classList.remove('has-image');this.parentElement.classList.add('image-error');"
              >
            `
            : `
              <span class="pk-product-placeholder">
                <span aria-hidden="true">🛍️</span>
                <small>Photo à venir</small>
              </span>
            `
        }

      </div>

      <div class="store-content">

        <span class="pk-featured-badge">
          ${
            inherited
              ? "⭐ PRIORITÉ BOUTIQUE PARTENAIRE"
              : "⭐ PRODUIT SÉLECTIONNÉ"
          }
        </span>

        <h3>${escapeHTML(product.name)}</h3>

        <div class="pk-product-price">
          ${price}
        </div>

        <p>
          ${escapeHTML(
            product.description || "Découvrez ce produit."
          )}
        </p>

        <div class="store-meta">
          🏪 ${escapeHTML(store.name)}
          ${
            store.city
              ? ` · 📍 ${escapeHTML(store.city)}`
              : ""
          }
        </div>

        <a class="view-button" href="${storeLink}">
          Voir le commerce →
        </a>

        ${
          productWhatsApp
            ? `
              <a
                class="pk-whatsapp-button"
                href="${escapeHTML(productWhatsApp)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span aria-hidden="true">◉</span>
                Commander sur WhatsApp
              </a>
            `
            : ""
        }

      </div>
    </article>
  `;
}

/* =========================================================
   CARTE COMMERCE
   ========================================================= */

function renderStoreCard(store) {
  const featured = isStoreFeatured(store);

  const storeLogo = store.logo_url || "";
  const cover = store.cover_url || "";

  const storeCategory = getStoreCategory(store);

  const storeLink =
    `store.html?id=${encodeURIComponent(store.id)}`;

  const storeWhatsApp = getWhatsAppLink(
    store.whatsapp || store.phone,
    `Bonjour ${store.name} ! Je vous contacte depuis PK-ChapShop. Pouvez-vous me renseigner sur vos produits et services ?`
  );

  return `
    <article
      class="store-card ${
        featured ? "pk-store-featured" : ""
      }"
      data-store-id="${escapeHTML(store.id)}"
    >

      <div class="store-cover pk-store-cover">

        ${
          cover
            ? `
              <img
                src="${escapeHTML(cover)}"
                alt="Vitrine de ${escapeHTML(store.name)}"
                loading="lazy"
                onerror="this.remove();this.parentElement.classList.add('image-error');"
              >
            `
            : `
              <span
                class="pk-cover-placeholder"
                aria-hidden="true"
              >
                🏪
              </span>
            `
        }

        ${
          featured
            ? `
              <span class="pk-featured-badge pk-cover-badge">
                ⭐ À LA UNE
              </span>
            `
            : ""
        }

        ${
          storeLogo
            ? `
              <div class="pk-store-logo">
                <img
                  src="${escapeHTML(storeLogo)}"
                  alt="Logo de ${escapeHTML(store.name)}"
                  loading="lazy"
                  onerror="this.parentElement.style.display='none';"
                >
              </div>
            `
            : ""
        }

      </div>

      <div class="store-content">

        ${
          featured
            ? `
              <span class="pk-featured-badge">
                COMMERCE À LA UNE
              </span>
            `
            : ""
        }

        <h3>${escapeHTML(store.name)}</h3>

        ${
          storeCategory
            ? `
              <span class="pk-store-category">
                ${escapeHTML(storeCategory.icon || "🏪")}
                ${escapeHTML(storeCategory.name)}
              </span>
            `
            : ""
        }

        <p>
          ${escapeHTML(
            store.description ||
            "Découvrez ce commerce local."
          )}
        </p>

        <div class="store-meta">
          📍 ${escapeHTML(store.city || "Bénin")}
          ${store.is_open === true ? " · 🟢 Ouvert" : ""}
          ${
            store.delivery_available
              ? " · 🚚 Livraison"
              : ""
          }
        </div>

        <a class="view-button" href="${storeLink}">
          Voir le commerce →
        </a>

        ${
          storeWhatsApp
            ? `
              <a
                class="pk-whatsapp-button"
                href="${escapeHTML(storeWhatsApp)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span aria-hidden="true">◉</span>
                Contacter sur WhatsApp
              </a>
            `
            : ""
        }

      </div>
    </article>
  `;
}

/* =========================================================
   SÉLECTION SPÉCIALE PK-CHAPSHOP
   ========================================================= */

function renderSpecialSelection(featuredProducts) {
  if (!featuredProducts.length) return "";

  return `
    <section class="pk-special-section" id="pk-featured-products">

      <div class="pk-special-heading">
        <span class="eyebrow">
          ⭐ LES TROUVAILLES DU MOMENT
        </span>

        <h2>
          Sélection spéciale <span>PK-ChapShop.</span>
        </h2>

        <p>
          Des produits choisis dans les commerces de Parakou.
        </p>
      </div>

      <div class="pk-featured-grid pk-special-products">
        ${featuredProducts.map(renderProductCard).join("")}
      </div>
    </section>
  `;
}

/* =========================================================
   STYLES PUBLICS
   ========================================================= */

function getFeaturedStyles() {
  return `
    <style>
      #stores {
        display: block !important;
        width: 100%;
      }

      .pk-special-section,
      .pk-featured-section,
      .pk-stores-section {
        display: block;
        width: 100%;
        margin: 0 0 36px;
      }

      .pk-special-heading,
      .pk-featured-section .section-heading,
      .pk-stores-section .section-heading {
        margin: 0 0 20px;
      }

      .pk-special-heading h2,
      .pk-featured-section h2,
      .pk-stores-section h2 {
        color: #123b2d;
        font-size: clamp(24px, 3vw, 34px);
        font-weight: 800;
      }

      .pk-special-heading h2 span,
      .pk-featured-section h2 span,
      .pk-stores-section h2 span {
        color: #b78b34;
      }

      .pk-special-heading p {
        color: #66736b;
        line-height: 1.7;
      }

      .pk-special-grid {
        display: grid;
        grid-template-columns: repeat(
          auto-fit,
          minmax(min(100%, 260px), 1fr)
        );
        gap: 18px;
      }

      .pk-special-column {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 18px;
        border: 1px solid #e9dfc4;
        border-radius: 16px;
        background: #faf8f1;
      }

      .pk-special-column h3 {
        margin: 0 0 5px;
        color: #123b2d;
        font-size: 16px;
      }

      .pk-special-link {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 11px 13px;
        border: 1px solid #eee8d8;
        border-radius: 10px;
        background: #fff;
        color: #123b2d;
        font-size: 13px;
        font-weight: 700;
        text-decoration: none;
        overflow-wrap: anywhere;
      }

      .pk-special-link small {
        padding-left: 23px;
        color: #788078;
        font-size: 11px;
        font-weight: 400;
      }

      .pk-special-more {
        margin-top: 5px;
        color: #987021;
        font-size: 13px;
        font-weight: 800;
        text-decoration: none;
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

      .pk-featured-grid .store-card,
      .pk-store-grid .store-card {
        min-width: 0;
        overflow: hidden;
        border: 1px solid #e9e5d9;
        border-radius: 18px;
        background: #fff;
        box-shadow: 0 5px 18px rgba(18,59,45,.07);
        transition: transform .25s ease, box-shadow .25s ease;
      }

      .pk-featured-grid .store-card:hover,
      .pk-store-grid .store-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 13px 30px rgba(18,59,45,.13);
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

      .pk-store-cover {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 190px;
        overflow: hidden;
        background: #f2efe5;
      }

      .pk-store-cover > img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .pk-cover-placeholder {
        font-size: 44px;
      }

      .pk-cover-badge {
        position: absolute;
        top: 12px;
        left: 12px;
      }

      .pk-store-logo {
        position: absolute;
        right: 14px;
        bottom: 14px;
        width: 66px;
        height: 66px;
        overflow: hidden;
        border: 3px solid #fff;
        border-radius: 15px;
        background: #fff;
        box-shadow: 0 4px 14px rgba(0,0,0,.18);
      }

      .pk-store-logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .pk-store-featured {
        border: 2px solid #d5ad58 !important;
      }

      .pk-product-symbol {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 190px;
        overflow: hidden;
        background: linear-gradient(145deg,#f8f6ef,#eeeadf);
        color: #b78b34;
        font-size: 48px;
      }

      .pk-product-symbol.has-image {
        padding: 0;
      }

      .pk-product-symbol img {
        width: 100%;
        height: 100%;
        min-height: 190px;
        object-fit: cover;
      }

      .pk-featured-grid .store-content,
      .pk-store-grid .store-content {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 18px;
      }

      .pk-featured-grid .store-content h3,
      .pk-store-grid .store-content h3 {
        margin: 0;
        color: #123b2d;
        font-size: 18px;
        font-weight: 800;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .pk-featured-grid .store-content p,
      .pk-store-grid .store-content p {
        margin: 0;
        color: #666b66;
        font-size: 13px;
        line-height: 1.7;
        overflow-wrap: anywhere;
      }

      .pk-product-price {
        color: #a77b24;
        font-size: 25px;
        font-weight: 900;
        line-height: 1.35;
      }

      .pk-store-category {
        display: inline-flex;
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

      .pk-featured-grid .store-meta,
      .pk-store-grid .store-meta {
        color: #52665a;
        font-size: 12px;
        line-height: 1.7;
      }

      .pk-featured-grid .view-button,
      .pk-store-grid .view-button {
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 100%;
        min-height: 44px;
        padding: 12px 14px;
        border: 1px solid #123b2d;
        border-radius: 10px;
        background: #123b2d;
        color: #fff;
        text-align: center;
        text-decoration: none;
        font-size: 13px;
        font-weight: 800;
      }

      .pk-whatsapp-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        box-sizing: border-box;
        width: 100%;
        min-height: 44px;
        padding: 13px 15px;
        border: 1px solid #1f9d58;
        border-radius: 10px;
        background: #168849;
        color: #fff;
        text-align: center;
        text-decoration: none;
        font-size: 12px;
        font-weight: 800;
      }

      .pk-load-warning {
        margin: 0 0 18px;
        padding: 12px 15px;
        border-radius: 10px;
        background: #fff7e7;
        color: #76571c;
        font-size: 13px;
      }

      @media (max-width: 600px) {
        .pk-featured-grid,
        .pk-store-grid {
          grid-template-columns: minmax(0,1fr);
          gap: 16px;
        }

        .pk-featured-grid .store-content,
        .pk-store-grid .store-content {
          padding: 15px;
        }

        .pk-store-cover,
        .pk-product-symbol {
          height: 200px;
        }

        .pk-store-logo {
          width: 58px;
          height: 58px;
        }

        .pk-product-price {
          font-size: 23px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .pk-featured-grid .store-card,
        .pk-store-grid .store-card,
        .pk-whatsapp-button {
          transition: none;
          transform: none;
        }
      }
    </style>
  `;
}

/* =========================================================
   AFFICHAGE PRINCIPAL
   ========================================================= */

function renderStores() {
  if (!storesEl) return;

  storesEl.style.display = "block";

  const visibleStores = getVisibleStores();

  const featuredStores = storeFeaturedMetadataAvailable
    ? visibleStores
        .filter(store => isStoreFeatured(store))
        .sort(comparePriority)
    : [];

  const directoryStores = storeFeaturedMetadataAvailable
    ? visibleStores.filter(store => !isStoreFeatured(store))
    : visibleStores;

  const featuredProducts = getVisibleFeaturedProducts();

  if (resultsLabel) {
    resultsLabel.textContent =
      visibleStores.length === 1
        ? "1 commerce affiché"
        : `${visibleStores.length} commerces affichés`;
  }

  /* 1. Commerces mis en avant */

  const featuredStoresHTML = featuredStores.length
    ? `
      <section
        class="pk-stores-section"
        id="pk-featured-stores"
      >
        <div class="section-heading">
          <div>
            <span class="eyebrow">
              ⭐ NOS PARTENAIRES
            </span>

            <h2>
              Boutiques partenaires
              <span>à la une.</span>
            </h2>

            <p>
              Les commerces mis en avant sur PK-ChapShop.
            </p>
          </div>
        </div>

        <div class="pk-store-grid">
          ${featuredStores.map(renderStoreCard).join("")}
        </div>
      </section>
    `
    : "";

  /* 2. Sélection spéciale des produits */

  const specialHTML = renderSpecialSelection(featuredProducts);

  /* 3. Annuaire complet */

  const directoryStoresHTML = directoryStores.length
    ? `
      <section class="pk-stores-section pk-directory-section" id="annuaire-section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">
              ${storeFeaturedMetadataAvailable ? "LE MARCHÉ LOCAL" : "ANNUAIRE LOCAL"}
            </span>

            <h2>
              ${
                searchInput?.value
                  ? "Résultats de recherche"
                  : "Tous les commerces"
              }
            </h2>
            ${
              storeFeaturedMetadataAvailable
                ? ""
                : "<p>Les commerces restent consultables ; leur statut de mise en avant est momentanément indisponible.</p>"
            }
          </div>
        </div>

        <div class="pk-store-grid">
          ${directoryStores.map(renderStoreCard).join("")}
        </div>
      </section>
    `
    : "";

  const loadWarnings = [];

  if (productsError) {
    loadWarnings.push(
      "Les commerces sont affichés, mais les produits n'ont pas pu être chargés."
    );
  }

  if (storeFeaturedMetadataError) {
    loadWarnings.push(
      "Les commerces restent consultables, mais leurs informations de mise en avant sont indisponibles."
    );
  }

  if (productFeaturedMetadataError) {
    loadWarnings.push(
      "Les champs de mise en avant des produits sont indisponibles. Les produits ordinaires restent consultables dans leurs boutiques."
    );
  }

  const warningHTML = loadWarnings.length
    ? `<p class="pk-load-warning" role="status">${loadWarnings.map(escapeHTML).join(" ")}</p>`
    : "";

  const emptyHTML =
    !visibleStores.length && !featuredProducts.length
      ? `
        <div class="empty">
          <p>
            Aucun commerce ni produit ne correspond
            à cette recherche.
          </p>

          <button
            type="button"
            class="view-button"
            id="clearSearchButton"
          >
            Effacer les filtres
          </button>
        </div>
      `
      : "";

  storesEl.innerHTML = `
    ${getFeaturedStyles()}

    ${warningHTML}

    ${specialHTML}

    ${featuredStoresHTML}

    ${directoryStoresHTML}

    ${emptyHTML}
  `;

  document
    .getElementById("clearSearchButton")
    ?.addEventListener("click", clearSearch);
}

/* =========================================================
   EFFACER LES FILTRES
   ========================================================= */

function clearSearch() {
  if (searchInput) {
    searchInput.value = "";
  }

  selectedCategory = null;

  renderCategories();
  renderStores();
}

window.clearSearch = clearSearch;
window.loadStores = loadStores;

/* =========================================================
   PANIER
   ========================================================= */

function updateCartCount() {
  if (!cartCountEl) return;

  try {
    const cart = JSON.parse(
      localStorage.getItem("pk_cart") || "[]"
    );

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
    console.warn(
      "Lecture du panier impossible :",
      error
    );

    cartCountEl.textContent = "0";
  }
}

/* =========================================================
   RECHERCHE
   ========================================================= */

if (searchInput) {
  searchInput.addEventListener("input", renderStores);
}

/* =========================================================
   DÉMARRAGE
   ========================================================= */

async function initializePKChapShop() {
  updateCartCount();

  await Promise.allSettled([
    loadCategories(),
    loadStores()
  ]);

  await loadProducts();

  renderStores();
}

initializePKChapShop();
