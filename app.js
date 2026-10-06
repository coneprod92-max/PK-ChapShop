const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: "Bearer " + SUPABASE_KEY
};

let allStores = [];
let selectedCategory = null;

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#039;"
}[char]));

async function api(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function renderCategories(categories) {
  const box = document.getElementById("categories");

  box.innerHTML = categories.map(category => `
    <div class="cat" data-id="${category.id}">
      <span class="icon">${esc(category.icon || "📍")}</span>
      <b>${esc(category.name)}</b>
    </div>
  `).join("");

  document.querySelectorAll(".cat").forEach(element => {
    element.onclick = () => {
      selectedCategory =
        selectedCategory === element.dataset.id
          ? null
          : element.dataset.id;

      document.querySelectorAll(".cat").forEach(item => {
        item.classList.toggle(
          "active",
          item.dataset.id === selectedCategory
        );
      });

      renderStores();
    };
  });
}

function renderStores() {
  const query = document
    .getElementById("search")
    .value
    .toLowerCase()
    .trim();

  const filtered = allStores.filter(store => {
    const matchesCategory =
      !selectedCategory || store.category_id === selectedCategory;

    const text =
      `${store.name} ${store.description || ""} ${store.address || ""}`
        .toLowerCase();

    return matchesCategory && (!query || text.includes(query));
  });

  const box = document.getElementById("stores");

  if (!filtered.length) {
    box.innerHTML = `
      <div class="empty">
        Aucun commerce publié pour le moment.
      </div>
    `;
    return;
  }

  box.innerHTML = filtered.map(store => {
    const status = store.is_open
      ? `<span class="badge">OUVERT</span>`
      : `<span class="badge closed">FERMÉ</span>`;

    const image = store.logo_url
      ? `<img src="${esc(store.logo_url)}" alt="${esc(store.name)}">`
      : "🛍️";

    return `
      <article class="card">
        <div class="cover">${image}</div>

        <div class="body">
          ${status}
          <h3>${esc(store.name)}</h3>

          <div class="meta">
            📍 ${esc(store.address || store.city || "Parakou")}
          </div>

          <div class="meta">
            ${esc(store.description || "Commerce local sur PK ChapShop")}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

document.getElementById("search").addEventListener("input", renderStores);

async function start() {
  try {
    const categories = await api(
      "store_categories?select=id,name,icon&order=name"
    );

    renderCategories(categories);

    allStores = await api(
      "stores?select=id,name,category_id,description,address,city,logo_url,is_open&is_published=eq.true&order=name"
    );

    renderStores();
  } catch (error) {
    console.error(error);

    document.getElementById("categories").innerHTML =
      `<div class="empty">Impossible de charger les catégories.</div>`;

    document.getElementById("stores").innerHTML =
      `<div class="empty">Impossible de charger les commerces pour le moment.</div>`;
  }
}

start();
