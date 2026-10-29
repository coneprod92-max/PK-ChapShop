
const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`
};

const categoriesEl = document.getElementById("categories");
const storesEl = document.getElementById("stores");
const searchInput = document.getElementById("searchInput");
const cartCountEl = document.getElementById("cartCount");

let categories = [];
let stores = [];
let products = [];
let selectedCategory = null;
let productsSearchAvailable = false;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchRows(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`Supabase a répondu avec le statut ${response.status}`);
  }

  return response.json();
}

/* Vérifie si une mise à la une est encore active. */
function isFeaturedActive(item) {
  if (!item || item.is_featured !== true) return false;

  if (!item.featured_until) return true;

  const endDate = new Date(item.featured_until);

  return !Number.isNaN(endDate.getTime()) &&
    endDate.getTime() > Date.now();
}

function renderCategories() {
  if (!categoriesEl) return;

  categoriesEl.innerHTML = `
    <button type="button"
      class="category ${selectedCategory === null ? "active" : ""}"
      onclick="filterCategory(null)">
      <span class="category-icon">✨</span>
      <span class="category-name">Tous</span>
    </button>
  `;

  categories.forEach(category => {
    categoriesEl.innerHTML += `
      <button type="button"
        class="category ${
          String(selectedCategory) === String(category.id) ? "active" : ""
        }"
        onclick="filterCategory('${esc(category.id)}')">
        <span class="category-icon">${esc(category.icon || "🏪")}</span>
        <span class="category-name">${esc(category.name)}</span>
      </button>
    `;
  });
}

async function loadCategories() {
  if (!categoriesEl) return;

  try {
    categories = await fetchRows(
      "store_categories?select=id,name,slug,icon&order=name.asc"
    );

    if (!Array.isArray(categories)) categories = [];

    renderCategories();
  } catch (error) {
    console.error("Chargement des catégories :", error);

    categoriesEl.innerHTML =
      '<div class="empty">Les catégories sont momentanément indisponibles.</div>';
  }
}

async function loadProductsForSearch() {
  products = [];
  productsSearchAvailable = false;

  try {
    products = await fetchRows(
      "products?select=id,store_id,name,description,is_available,is_featured,featured_until&is_available=eq.true"
    );

    if (!Array.isArray(products)) {
      throw new Error("La réponse des produits est invalide.");
    }

    productsSearchAvailable = true;
  } catch (error) {
    console.warn("Recherche de produits indisponible :", error);
  }
}

async function loadStores() {
  if (!storesEl) return;

  storesEl.innerHTML =
    '<div class="loading">Chargement des commerces...</div>';

  try {
    stores = await fetchRows(
      "stores?select=id,name,slug,description,phone,address,city,logo_url,cover_url,is_open,delivery_available,category_id,is_featured,featured_until&is_published=eq.true&order=created_at.desc"
    );

    if (!Array.isArray(stores)) {
      throw new Error("La réponse des commerces est invalide.");
    }

    await loadProductsForSearch();
    renderStores();
  } catch (error) {
    console.error("Chargement des commerces :", error);

    storesEl.innerHTML = `
      <div class="empty error">
        Impossible de charger les commerces. Vérifie ta connexion et réessaie.
        <br><br>
        <button type="button" class="view-button" onclick="loadStores()">
          Réessayer
        </button>
      </div>
    `;
  }
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

function renderStores() {
  if (!storesEl || !searchInput) return;

  const search = normalize(searchInput.value);

  const featuredProducts = products.filter(product =>
    isFeaturedActive(product)
  );

  const filtered = stores.filter(store => {
    const categoryMatch =
      selectedCategory === null ||
      String(store.category_id) === String(selectedCategory);

    const storeTextMatch =
      !search ||
      normalize(store.name).includes(search) ||
      normalize(store.description).includes(search) ||
      normalize(store.city).includes(search);

    const productMatch = search && productsSearchAvailable
      ? products.some(product =>
          String(product.store_id) === String(store.id) &&
          (
            normalize(product.name).includes(search) ||
            normalize(product.description).includes(search)
          )
        )
      : false;

    return categoryMatch && (storeTextMatch || productMatch);
  });

  /*
   * Les commerces mis à la une apparaissent en premier.
   * La recherche et le filtre par catégorie restent appliqués.
   */
  filtered.sort((a, b) => {
    const aFeatured = isFeaturedActive(a) ? 1 : 0;
    const bFeatured = isFeaturedActive(b) ? 1 : 0;

    return bFeatured - aFeatured;
  });

  if (!filtered.length && !featuredProducts.length) {
    const message = search && !productsSearchAvailable
      ? "Aucun commerce trouvé avec ce terme. La recherche de produits est momentanément indisponible."
      : "Aucun commerce ou produit ne correspond à votre recherche.";

    storesEl.innerHTML = `
      <div class="empty">
        ${esc(message)}
        <br><br>
        <button type="button" class="view-button" onclick="clearSearch()">
          Effacer la recherche
        </button>
      </div>
    `;
    return;
  }

  /*
   * Section des produits à la une.
   * Elle n'apparaît que si des produits ont été mis à la une
   * et que la recherche actuelle ne les exclut pas.
   */
  const visibleFeaturedProducts = featuredProducts.filter(product => {
    if (search) {
      const productMatches =
        normalize(product.name).includes(search) ||
        normalize(product.description).includes(search);

      const store = stores.find(
        item => String(item.id) === String(product.store_id)
      );

      const storeMatches = store && (
        normalize(store.name).includes(search) ||
        normalize(store.city).includes(search)
      );

      if (!productMatches && !storeMatches) return false;
    }

    if (selectedCategory !== null) {
      const store = stores.find(
        item => String(item.id) === String(product.store_id)
      );

      if (
        !store ||
        String(store.category_id) !== String(selectedCategory)
      ) {
        return false;
      }
    }

    return true;
  });

  const featuredProductsHTML = visibleFeaturedProducts.length
    ? `
      <section class="pk-featured-section">
        <h2 class="pk-featured-heading">⭐ Produits à la une</h2>

        <div class="pk-featured-products">
          ${visibleFeaturedProducts.map(product => {
            const store = stores.find(
              item => String(item.id) === String(product.store_id)
            );

            return `
              <article class="store-card pk-featured-product">
                <div class="store-cover pk-featured-product-cover">
                  ⭐
                </div>

                <div class="store-content">
                  <span class="pk-featured-badge">À LA UNE</span>

                  <h3>${esc(product.name)}</h3>

                  <p>
                    ${esc(product.description ||
                      "Découvrez ce produit chez notre commerçant partenaire.")}
                  </p>

                  <div class="store-meta">
                    🏪 ${esc(store ? store.name : "Commerce partenaire")}
                    ${store && store.city
                      ? ` • 📍 ${esc(store.city)}`
                      : ""}
                  </div>

                  <a class="view-button"
                     href="store.html?id=${encodeURIComponent(product.store_id)}">
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

  const storesHTML = filtered.length
    ? `
      <section class="pk-stores-section">
        <h2 class="pk-featured-heading">
          ${search ? "Résultats de recherche" : "Nos commerces"}
        </h2>

        <div class="pk-store-grid">
          ${filtered.map(store => {
            const image = store.cover_url || store.logo_url;
            const featured = isFeaturedActive(store);

            const imageStyle = image
              ? `style="background-image:url('${esc(image)}');background-size:cover;background-position:center"`
              : "";

            return `
              <article class="store-card ${featured ? "pk-store-featured" : ""}">
                <div class="store-cover" ${imageStyle}>
                  ${image ? "" : "🏪"}
                  ${featured
                    ? '<span class="pk-featured-badge pk-cover-badge">⭐ À LA UNE</span>'
                    : ""}
                </div>

                <div class="store-content">
                  ${featured
                    ? '<span class="pk-featured-badge">⭐ COMMERCE À LA UNE</span>'
                    : ""}

                  <h3>${esc(store.name)}</h3>

                  <p>
                    ${esc(store.description ||
                      "Découvrez les produits et services de ce commerce.")}
                  </p>

                  <div class="store-meta">
                    📍 ${esc(store.city || "Bénin")}
                    ${store.is_open ? " • 🟢 Ouvert" : " • 🔴 Fermé"}
                    ${store.delivery_available
                      ? " • 🚚 Livraison disponible"
                      : ""}
                  </div>

                  <a class="view-button"
                     href="store.html?id=${encodeURIComponent(store.id)}">
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
        Aucun commerce ne correspond à votre recherche.
        <br><br>
        <button type="button" class="view-button" onclick="clearSearch()">
          Effacer la recherche
        </button>
      </div>
    `;

  storesEl.innerHTML = `
    <style>
      .pk-featured-section,
      .pk-stores-section {
        width: 100%;
        margin-bottom: 28px;
      }

      .pk-featured-heading {
        margin: 0 0 16px;
        font-size: 1.25rem;
        font-weight: 800;
      }

      .pk-featured-products,
      .pk-store-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 18px;
      }

      .pk-featured-badge {
        display: inline-block;
        width: fit-content;
        margin-bottom: 8px;
        padding: 5px 9px;
        border-radius: 5px;
        background: #d5b36a;
        color: #172018;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.04em;
      }

      .pk-cover-badge {
        position: absolute;
        top: 10px;
        left: 10px;
        margin: 0;
      }

      .pk-featured-product-cover {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.5rem;
        background: #f4eddd;
      }

      .pk-store-featured {
        border: 2px solid #d5b36a;
      }

      .store-cover {
        position: relative;
      }

      .pk-store-grid .store-card,
      .pk-featured-products .store-card {
        min-width: 0;
      }
    </style>

    ${featuredProductsHTML}
    ${storesHTML}
  `;
}

function filterCategory(categoryId) {
  selectedCategory = categoryId;
  renderCategories();
  renderStores();
  #stores.stores-grid {
  display: block !important;
}

function clearSearch() {
  if (searchInput) searchInput.value = "";

  selectedCategory = null;

  renderCategories();
  renderStores();
}

function updateCartCount() {
  if (!cartCountEl) return;

  try {
    const cart = JSON.parse(localStorage.getItem("pk_cart") || "[]");

    const count = Array.isArray(cart)
      ? cart.reduce(
          (total, item) => total + Number(item.quantity || 0),
          0
        )
      : 0;

    cartCountEl.textContent = count;
  } catch (error) {
    console.warn("Lecture du panier impossible :", error);
    cartCountEl.textContent = "0";
  }
}

if (searchInput) {
  searchInput.addEventListener("input", renderStores);
}

window.filterCategory = filterCategory;
window.clearSearch = clearSearch;
window.loadStores = loadStores;

loadCategories();
loadStores();
updateCartCount();
