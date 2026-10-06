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
let selectedCategory = null;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadCategories() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/store_categories?select=id,name,slug,icon&order=name.asc`,
      { headers }
    );

    categories = await response.json();
    renderCategories();

  } catch (error) {
    console.error(error);
  }
}

function renderCategories() {

  categoriesEl.innerHTML = `
    <div class="category ${selectedCategory === null ? "active" : ""}"
         onclick="filterCategory(null)">
      <span class="category-icon">✨</span>
      <span class="category-name">Tous</span>
    </div>
  `;

  categories.forEach(category => {

    categoriesEl.innerHTML += `
      <div class="category ${selectedCategory === category.id ? "active" : ""}"
           onclick="filterCategory('${category.id}')">

        <span class="category-icon">
          ${esc(category.icon || "🏪")}
        </span>

        <span class="category-name">
          ${esc(category.name)}
        </span>

      </div>
    `;
  });
}

async function loadStores() {

  storesEl.innerHTML = `<div class="loading">Chargement...</div>`;

  try {

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?select=id,name,slug,description,phone,address,city,logo_url,cover_url,is_open,delivery_available,category_id&is_published=eq.true&order=created_at.desc`,
      { headers }
    );

    stores = await response.json();

    renderStores();

  } catch (error) {

    console.error(error);

    storesEl.innerHTML = `
      <div class="empty error">
        Impossible de charger les commerces.
      </div>
    `;
  }
}

function renderStores() {

  const search = searchInput.value.toLowerCase().trim();

  const filtered = stores.filter(store => {

    const categoryMatch =
      selectedCategory === null ||
      store.category_id === selectedCategory;

    const searchMatch =
      !search ||
      store.name.toLowerCase().includes(search) ||
      (store.description || "").toLowerCase().includes(search) ||
      (store.city || "").toLowerCase().includes(search);

    return categoryMatch && searchMatch;
  });

  if (!filtered.length) {

    storesEl.innerHTML = `
      <div class="empty">
        Aucun commerce trouvé.
      </div>
    `;

    return;
  }

  storesEl.innerHTML = filtered.map(store => {

    const image = store.cover_url || store.logo_url;

    return `
      <article class="store-card">

        <div class="store-cover"
             ${image ? `style="background-image:url('${esc(image)}');background-size:cover;background-position:center;"` : ""}>
          ${!image ? "🏪" : ""}
        </div>

        <div class="store-content">

          <h3>${esc(store.name)}</h3>

          <p>
            ${esc(
              store.description ||
              "Découvrez les produits et services de ce commerce."
            )}
          </p>

          <div class="store-meta">
            📍 ${esc(store.city || "Parakou")}
            ${store.is_open ? " • 🟢 Ouvert" : " • 🔴 Fermé"}
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

searchInput.addEventListener("input", renderStores);

function updateCartCount() {

  const cart = JSON.parse(
    localStorage.getItem("pk_cart") || "[]"
  );

  const count = cart.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );

  cartCountEl.textContent = count;
}

loadCategories();
loadStores();
updateCartCount();
