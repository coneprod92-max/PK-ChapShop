
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
      // Compatibilité si la table ne possède pas de colonne icon.
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
     * On tente d'abord de charger les colonnes de mise en avant.
     * En cas d'erreur, on réessaie sans ces colonnes.
     */
    try {
      stores = await supabaseGet(
        "stores?select=id,name,slug,description,phone,address,city,logo_url,cover_url,is_open,delivery_available,category_id,is_published,is_featured,featured_until&is_published=eq.true&order=created_at.desc"
      );
    } catch (firstError) {
      console.warn(
        "Chargement des commerces avec les champs de mise en avant impossible :",
        firstError
      );

      stores = await supabaseGet(
        "stores?select=id,name,slug,description,phone,address,city,logo_url,cover_url,is_open,delivery_available,category_id,is_published&is_published=eq.true&order=created_at.desc"
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
  }).sort((a, b) => Number(isFeaturedActive(b)) - Number(isFeaturedActive(a)));
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

  // #stores contient les sections et leurs grilles de cartes.
  storesEl.style.display = "block";

  const visibleStores = getVisibleStores();
  const featuredProducts = getVisibleFeaturedProducts();

  if (resultsLabel) {
    resultsLabel.textContent = visibleStores.length === 1
      ? "1 commerce affiché"
      : `${visibleStores.length} commerces affichés`;
  }

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

            // CORRECTION : store.js attend l'identifiant id, pas le slug.
            const storeLink =
              `store.html?id=${encodeURIComponent(product.store_id)}`;

            return `
              <article class="store-card pk-product-card">
                
<div class="pk-product-symbol ${product.image_url ? "has-image" : ""}">
  ${product.image_url
    ? `<img
        src="${escapeHTML(product.image_url)}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
        onerror="this.remove(); this.parentElement.classList.remove('has-image'); this.textContent='🛍️';"
      >`
    : "🛍️"}
</div>


                <div class="store-content">
                  <span class="pk-featured-badge">PRODUIT À LA UNE</span>
                  <h3>${escapeHTML(product.name)}</h3>
                  <p>${escapeHTML(product.description || "Découvrez ce produit.")}</p>

                  <div class="store-meta">
                    🏪 ${escapeHTML(store?.name || "Commerce partenaire")}
                    ${store?.city ? ` · 📍 ${escapeHTML(store.city)}` : ""}
                  </div>

                  <a class="view-button" href="${storeLink}">
                    Voir le commerce →
                  </a>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `
    : "";

  const storesHTML = visibleStores.length
    ? `
      <section class="pk-stores-section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">LE MARCHÉ LOCAL</span>
            <h2>${searchInput?.value ? "Résultats de" : "Nos commerces à"}
              <span>${searchInput?.value ? "recherche." : "découvrir."}</span>
            </h2>
          </div>
        </div>

        <div class="pk-store-grid">
          ${visibleStores.map(store => {
            const image = store.cover_url || store.logo_url;
            const featured = isFeaturedActive(store);

            // CORRECTION : toujours transmettre l'identifiant du commerce.
            const storeLink =
              `store.html?id=${encodeURIComponent(store.id)}`;

            return `
              <article class="store-card ${featured ? "pk-store-featured" : ""}">
                <div class="store-cover pk-store-cover"
                  ${image ? `style="background-image:url('${escapeHTML(image)}')"` : ""}>
                  ${!image ? '<span aria-hidden="true">🏪</span>' : ""}

                  ${featured
                    ? '<span class="pk-featured-badge pk-cover-badge">⭐ À LA UNE</span>'
                    : ""}
                </div>

                <div class="store-content">
                  ${featured
                    ? '<span class="pk-featured-badge">COMMERCE À LA UNE</span>'
                    : ""}

                  <h3>${escapeHTML(store.name)}</h3>
                  <p>${escapeHTML(store.description || "Découvrez ce commerce local.")}</p>

                  <div class="store-meta">
                    📍 ${escapeHTML(store.city || "Bénin")}
                    ${store.is_open === true ? " · 🟢 Ouvert" : ""}
                    ${store.delivery_available ? " · 🚚 Livraison" : ""}
                  </div>

                  <a class="view-button" href="${storeLink}">
                    Voir le commerce →
                  </a>
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
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
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

      @media (max-width: 600px) {
        .pk-featured-grid,
        .pk-store-grid {
          grid-template-columns: minmax(0, 1fr);
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
          return total + (Number.isFinite(quantity) ? quantity : 0);
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
