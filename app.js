
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

async function loadCategories() {
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

function renderCategories() {
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
        class="category ${selectedCategory === category.id ? "active" : ""}"
        onclick="filterCategory('${esc(category.id)}')">
        <span class="category-icon">${esc(category.icon || "🏪")}</span>
        <span class="category-name">${esc(category.name)}</span>
      </button>
    `;
  });
}

async function loadStores() {
  storesEl.innerHTML = '<div class="loading">Chargement des commerces...</div>';

  try {
    stores = await fetchRows(
      "stores?select=id,name,slug,description,phone,address,city,logo_url,cover_url,is_open,delivery_available,category_id&is_published=eq.true&order=created_at.desc"
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

async function loadProductsForSearch() {
  products = [];
  productsSearchAvailable = false;

  try {
    products = await fetchRows(
      "products?select=id,store_id,name,description,is_available&is_available=eq.true"
    );

    if (!Array.isArray(products)) {
      throw new Error("La réponse des produits est invalide.");
    }

    productsSearchAvailable = true;
  } catch (error) {
    // Les commerces restent consultables même si la recherche de produits
    // n'est pas disponible à cause des permissions ou du schéma de la base.
    console.warn("Recherche de produits indisponible :", error);
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
  const search = normalize(searchInput.value);

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

  if (!filtered.length) {
    const message = search && !productsSearchAvailable
      ? "Aucun commerce trouvé avec ce terme. La recherche de produits est momentanément indisponible."
      : "Aucun commerce ou produit ne correspond à votre recherche.";

    storesEl.innerHTML = `
      <div class="empty">
        ${esc(message)}
        <br><br>
        <button type="button" class="view-button"
          onclick="clearSearch()">
          Effacer la recherche
        </button>
      </div>
    `;
    return;
  }

  storesEl.innerHTML = filtered.map(store => {
    const image = store.cover_url || store.logo_url;
    const imageStyle = image
      ? `style="background-image:url('${esc(image)}');background-size:cover;background-position:center"`
      : "";

    return `
      <article class="store-card">
        <div class="store-cover" ${imageStyle}>
          ${image ? "" : "🏪"}
        </div>

        <div class="store-content">
          <h3>${esc(store.name)}</h3>

          <p>
            ${esc(store.description ||
              "Découvrez les produits et services de ce commerce.")}
          </p>

          <div class="store-meta">
            📍 ${esc(store.city || "Parakou")}
            ${store.is_open ? " • 🟢 Ouvert" : " • 🔴 Fermé"}
            ${store.delivery_available ? " • 🚚 Livraison disponible" : ""}
          </div>

          <a class="view-button"
             href="store.html?id=${encodeURIComponent(store.id)}">
            Voir le commerce →
          </a>
        </div>
      </article>
    `;
  }).join("");
}

function filterCategory(categoryId) {
  selectedCategory = categoryId;
  renderCategories();
  renderStores();
}

function clearSearch() {
  searchInput.value = "";
  selectedCategory = null;
  renderCategories();
  renderStores();
}

function updateCartCount() {
  try {
    const cart = JSON.parse(localStorage.getItem("pk_cart") || "[]");
    const count = Array.isArray(cart)
      ? cart.reduce((total, item) => total + Number(item.quantity || 0), 0)
      : 0;

    cartCountEl.textContent = count;
  } catch (error) {
    console.warn("Lecture du panier impossible :", error);
    cartCountEl.textContent = "0";
  }
}

searchInput.addEventListener("input", renderStores);

window.filterCategory = filterCategory;
window.clearSearch = clearSearch;
window.loadStores = loadStores;

loadCategories();
loadStores();
updateCartCount();
