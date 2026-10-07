const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// ===============================
// ELEMENTS
// ===============================

const loginSection = document.getElementById("loginSection");
const dashboard = document.getElementById("dashboard");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

const logoutButton = document.getElementById("logoutButton");

const ordersList = document.getElementById("ordersList");
const ordersMessage = document.getElementById("ordersMessage");

const refreshOrders =
  document.getElementById("refreshOrders");

const statOrders =
  document.getElementById("statOrders");

const statPending =
  document.getElementById("statPending");

const statDelivered =
  document.getElementById("statDelivered");

const statStores =
  document.getElementById("statStores");

const storeForm =
  document.getElementById("storeForm");

const storeMessage =
  document.getElementById("storeMessage");

const storesList =
  document.getElementById("storesList");

const storeCategory =
  document.getElementById("storeCategory");

const productForm =
  document.getElementById("productForm");

const productMessage =
  document.getElementById("productMessage");

const productsList =
  document.getElementById("productsList");

const productStore =
  document.getElementById("productStore");


// ===============================
// MESSAGES
// ===============================

function showLoginMessage(message, success = false) {

  loginMessage.innerHTML = `
    <div class="${success ? "admin-success" : "admin-error"}">
      ${message}
    </div>
  `;

}


function showStoreMessage(message, success = false) {

  storeMessage.innerHTML = `
    <div class="${success ? "admin-success" : "admin-error"}">
      ${message}
    </div>
  `;

}


function showProductMessage(message, success = false) {

  productMessage.innerHTML = `
    <div class="${success ? "admin-success" : "admin-error"}">
      ${message}
    </div>
  `;

}


// ===============================
// AFFICHAGE
// ===============================

function showLogin() {

  loginSection.classList.remove("admin-hidden");

  dashboard.classList.add("admin-hidden");

}


function showDashboard() {

  loginSection.classList.add("admin-hidden");

  dashboard.classList.remove("admin-hidden");

}


// ===============================
// VERIFICATION ADMIN
// ===============================

async function checkAdmin() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();


  if (!session) {

    showLogin();

    return false;

  }


  const {
    data,
    error
  } = await supabaseClient.rpc("is_admin");


  if (error || data !== true) {

    await supabaseClient.auth.signOut();

    showLoginMessage(
      "⛔ Ce compte n'a pas accès à l'administration."
    );

    showLogin();

    return false;

  }


  showDashboard();

  await loadEverything();

  return true;

}


// ===============================
// CONNEXION
// ===============================

loginForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();


    const email =
      document.getElementById("adminEmail")
        .value.trim();

    const password =
      document.getElementById("adminPassword")
        .value;


    loginMessage.innerHTML = "";


    const {
      error
    } = await supabaseClient.auth.signInWithPassword({

      email,
      password

    });


    if (error) {

      showLoginMessage(
        "❌ Email ou mot de passe incorrect."
      );

      return;

    }


    await checkAdmin();

  }
);


// ===============================
// DECONNEXION
// ===============================

logoutButton.addEventListener(
  "click",
  async function() {

    await supabaseClient.auth.signOut();

    showLogin();

    showLoginMessage(
      "Vous êtes maintenant déconnecté.",
      true
    );

  }
);


// ===============================
// CHARGEMENT GLOBAL
// ===============================

async function loadEverything() {

  await loadOrders();

  await loadCategories();

  await loadStores();

  await loadProducts();

}


// ===============================
// COMMANDES
// ===============================

async function loadOrders() {

  ordersMessage.innerHTML =
    "<p>Chargement des commandes...</p>";

  ordersList.innerHTML = "";


  const {
    data: orders,
    error
  } = await supabaseClient
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      payment_method,
      subtotal,
      delivery_fee,
      total,
      delivery_address,
      customer_note,
      created_at,

      customers (
        full_name,
        phone,
        whatsapp
      ),

      stores (
        name
      ),

      deliveries (
        status,
        driver_name,
        driver_phone,
        estimated_minutes,
        current_location
      )
    `)
    .order("created_at", {
      ascending: false
    })
    .limit(50);


  if (error) {

    ordersMessage.innerHTML = `
      <div class="admin-error">
        ❌ ${escapeHTML(error.message)}
      </div>
    `;

    return;

  }


  ordersMessage.innerHTML = "";

  updateStats(orders || []);


  if (!orders || orders.length === 0) {

    ordersList.innerHTML =
      "<p>Aucune commande pour le moment.</p>";

    return;

  }


  orders.forEach(order => {

    ordersList.appendChild(
      createOrderCard(order)
    );

  });

}


// ===============================
// STATISTIQUES
// ===============================

function updateStats(orders) {

  statOrders.textContent =
    orders.length;


  statPending.textContent =
    orders.filter(
      order => order.status === "pending"
    ).length;


  statDelivered.textContent =
    orders.filter(
      order => order.status === "delivered"
    ).length;

}


// ===============================
// CARTE COMMANDE
// ===============================

function createOrderCard(order) {

  const customer =
    order.customers || {};

  const store =
    order.stores || {};


  const card =
    document.createElement("div");

  card.className = "item-row";


  const date =
    new Date(order.created_at)
      .toLocaleString("fr-FR");


  card.innerHTML = `

    <div class="item-head">

      <div class="item-title">
        📦 Commande #${order.order_number}
      </div>

      <strong>
        ${Number(order.total)
          .toLocaleString("fr-FR")} FCFA
      </strong>

    </div>


    <div class="item-meta">

      👤 ${escapeHTML(
        customer.full_name || "Client"
      )}

      <br>

      📞 ${escapeHTML(
        customer.phone || "Non renseigné"
      )}

      <br>

      🏪 ${escapeHTML(
        store.name || "Boutique"
      )}

      <br>

      📍 ${escapeHTML(
        order.delivery_address ||
        "Adresse non renseignée"
      )}

      <br>

      💳 ${escapeHTML(
        order.payment_method ||
        "Non renseigné"
      )}

      <br>

      🕒 ${date}

    </div>


    <div class="status-line">

      <select class="order-status">

        ${statusOption(
          "pending",
          "En attente",
          order.status
        )}

        ${statusOption(
          "confirmed",
          "Confirmée",
          order.status
        )}

        ${statusOption(
          "preparing",
          "En préparation",
          order.status
        )}

        ${statusOption(
          "ready",
          "Prête",
          order.status
        )}

        ${statusOption(
          "out_for_delivery",
          "En livraison",
          order.status
        )}

        ${statusOption(
          "delivered",
          "Livrée",
          order.status
        )}

        ${statusOption(
          "cancelled",
          "Annulée",
          order.status
        )}

      </select>


      <button class="admin-button update-order">
        💾 Mettre à jour
      </button>

    </div>

  `;


  const select =
    card.querySelector(".order-status");

  const button =
    card.querySelector(".update-order");


  button.addEventListener(
    "click",
    async function() {

      await updateOrderStatus(
        order.id,
        select.value,
        button
      );

    }
  );


  return card;

}


// ===============================
// STATUT COMMANDE
// ===============================

function statusOption(
  value,
  label,
  current
) {

  return `
    <option
      value="${value}"
      ${value === current ? "selected" : ""}
    >
      ${label}
    </option>
  `;

}


async function updateOrderStatus(
  orderId,
  newStatus,
  button
) {

  button.disabled = true;

  button.textContent =
    "Enregistrement...";


  const {
    error
  } = await supabaseClient
    .from("orders")
    .update({
      status: newStatus
    })
    .eq("id", orderId);


  if (error) {

    alert(
      "Erreur : " + error.message
    );

    button.disabled = false;

    button.textContent =
      "💾 Mettre à jour";

    return;

  }


  button.textContent =
    "✅ Enregistré";


  await loadOrders();


  setTimeout(() => {

    button.disabled = false;

    button.textContent =
      "💾 Mettre à jour";

  }, 1000);

}


// ===============================
// CATEGORIES
// ===============================

async function loadCategories() {

  const {
    data,
    error
  } = await supabaseClient
    .from("store_categories")
    .select("id,name")
    .order("name");


  if (error) {

    console.error(error);

    return;

  }


  storeCategory.innerHTML =
    `<option value="">Choisir une catégorie</option>`;


  data.forEach(category => {

    storeCategory.innerHTML += `
      <option value="${category.id}">
        ${escapeHTML(category.name)}
      </option>
    `;

  });

}


// ===============================
// BOUTIQUES
// ===============================

async function loadStores() {

  storesList.innerHTML =
    "Chargement des boutiques...";


  const {
    data: stores,
    error
  } = await supabaseClient
    .from("stores")
    .select(`
      id,
      name,
      slug,
      description,
      phone,
      whatsapp,
      address,
      city,
      is_open,
      is_published,
      delivery_available,
      store_categories (
        name
      )
    `)
    .order("created_at", {
      ascending: false
    });


  if (error) {

    storesList.innerHTML = `
      <div class="admin-error">
        ❌ ${escapeHTML(error.message)}
      </div>
    `;

    return;

  }


  statStores.textContent =
    stores.length;


  productStore.innerHTML =
    `<option value="">Choisir une boutique</option>`;


  if (stores.length === 0) {

    storesList.innerHTML =
      "<p>Aucune boutique.</p>";

    return;

  }


  stores.forEach(store => {

    productStore.innerHTML += `
      <option value="${store.id}">
        ${escapeHTML(store.name)}
      </option>
    `;

  });


  storesList.innerHTML = "";


  stores.forEach(store => {

    const card =
      document.createElement("div");

    card.className = "item-row";


    card.innerHTML = `

      <div class="item-head">

        <div class="item-title">
          🏪 ${escapeHTML(store.name)}
        </div>

        <strong>
          ${store.is_published
            ? "🟢 Publiée"
            : "⚪ Brouillon"}
        </strong>

      </div>


      <div class="item-meta">

        📂 ${escapeHTML(
          store.store_categories?.name ||
          "Sans catégorie"
        )}

        <br>

        📍 ${escapeHTML(
          store.address || store.city || ""
        )}

        <br>

        📞 ${escapeHTML(
          store.phone || "Non renseigné"
        )}

        <br>

        🚚 ${
          store.delivery_available
            ? "Livraison disponible"
            : "Pas de livraison"
        }

      </div>


      <div class="status-line">

        <button
          class="admin-button toggle-store"
        >
          ${
            store.is_published
              ? "⏸ Dépublier"
              : "🚀 Publier"
          }
        </button>

      </div>

    `;


    card
      .querySelector(".toggle-store")
      .addEventListener(
        "click",
        () => toggleStore(store)
      );


    storesList.appendChild(card);

  });

}


// ===============================
// AJOUTER BOUTIQUE
// ===============================

storeForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();


    const name =
      document.getElementById("storeName")
        .value.trim();


    const slug =
      makeSlug(name);


    const {
      error
    } = await supabaseClient
      .from("stores")
      .insert({

        name,

        slug,

        category_id:
          storeCategory.value,

        description:
          document.getElementById(
            "storeDescription"
          ).value.trim(),

        phone:
          document.getElementById(
            "storePhone"
          ).value.trim(),

        whatsapp:
          document.getElementById(
            "storeWhatsapp"
          ).value.trim(),

        address:
          document.getElementById(
            "storeAddress"
          ).value.trim(),

        city: "Parakou",

        logo_url:
          document.getElementById(
            "storeLogo"
          ).value.trim() || null,

        cover_url:
          document.getElementById(
            "storeCover"
          ).value.trim() || null,

        is_open: true,

        is_published: true,

        delivery_available:
          document.getElementById(
            "storeDelivery"
          ).checked

      });


    if (error) {

      showStoreMessage(
        "❌ " + error.message
      );

      return;

    }


    showStoreMessage(
      "✅ Boutique créée avec succès.",
      true
    );


    storeForm.reset();

    document.getElementById(
      "storeDelivery"
    ).checked = true;


    await loadStores();

  }
);


// ===============================
// PUBLIER / DEPUBLIER
// ===============================

async function toggleStore(store) {

  const {
    error
  } = await supabaseClient
    .from("stores")
    .update({
      is_published:
        !store.is_published
    })
    .eq("id", store.id);


  if (error) {

    alert(
      "Erreur : " + error.message
    );

    return;

  }


  await loadStores();

}


// ===============================
// PRODUITS
// ===============================

async function loadProducts() {

  productsList.innerHTML =
    "Chargement des produits...";


  const {
    data: products,
    error
  } = await supabaseClient
    .from("products")
    .select(`
      id,
      name,
      slug,
      description,
      price,
      image_url,
      is_available,
      stores (
        name
      )
    `)
    .order("created_at", {
      ascending: false
    });


  if (error) {

    productsList.innerHTML = `
      <div class="admin-error">
        ❌ ${escapeHTML(error.message)}
      </div>
    `;

    return;

  }


  if (!products.length) {

    productsList.innerHTML =
      "<p>Aucun produit.</p>";

    return;

  }


  productsList.innerHTML = "";


  products.forEach(product => {

    const card =
      document.createElement("div");

    card.className = "item-row";


    card.innerHTML = `

      <div class="item-head">

        <div class="item-title">
          📦 ${escapeHTML(product.name)}
        </div>

        <strong>
          ${Number(product.price)
            .toLocaleString("fr-FR")} FCFA
        </strong>

      </div>


      <div class="item-meta">

        🏪 ${escapeHTML(
          product.stores?.name ||
          "Boutique"
        )}

        <br>

        ${
          product.is_available
            ? "🟢 Disponible"
            : "🔴 Indisponible"
        }

      </div>


      <div class="status-line">

        <button
          class="admin-button toggle-product"
        >
          ${
            product.is_available
              ? "⏸ Indisponible"
              : "▶ Disponible"
          }
        </button>

      </div>

    `;


    card
      .querySelector(".toggle-product")
      .addEventListener(
        "click",
        () => toggleProduct(product)
      );


    productsList.appendChild(card);

  });

}


// ===============================
// AJOUTER PRODUIT
// ===============================

productForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();


    const name =
      document.getElementById(
        "productName"
      ).value.trim();


    const {
      error
    } = await supabaseClient
      .from("products")
      .insert({

        store_id:
          productStore.value,

        name,

        slug:
          makeSlug(name),

        description:
          document.getElementById(
            "productDescription"
          ).value.trim(),

        price:
          Number(
            document.getElementById(
              "productPrice"
            ).value
          ),

        image_url:
          document.getElementById(
            "productImage"
          ).value.trim() || null,

        is_available:
          document.getElementById(
            "productAvailable"
          ).checked

      });


    if (error) {

      showProductMessage(
        "❌ " + error.message
      );

      return;

    }


    showProductMessage(
      "✅ Produit ajouté avec succès.",
      true
    );


    productForm.reset();

    document.getElementById(
      "productAvailable"
    ).checked = true;


    await loadProducts();

  }
);


// ===============================
// DISPONIBILITE PRODUIT
// ===============================

async function toggleProduct(product) {

  const {
    error
  } = await supabaseClient
    .from("products")
    .update({
      is_available:
        !product.is_available
    })
    .eq("id", product.id);


  if (error) {

    alert(
      "Erreur : " + error.message
    );

    return;

  }


  await loadProducts();

}


// ===============================
// SLUG
// ===============================

function makeSlug(text) {

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

}


// ===============================
// SECURITE HTML
// ===============================

function escapeHTML(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// ===============================
// ACTUALISER
// ===============================

refreshOrders.addEventListener(
  "click",
  loadOrders
);


// ===============================
// DEMARRAGE
// ===============================

checkAdmin();
