const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;
let currentStoreId = null;


// ======================================================
// INITIALISATION
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {

  setupEvents();

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session) {
    currentUser = session.user;
    await openAdmin();
  } else {
    showLogin();
  }

});


// ======================================================
// ÉVÉNEMENTS
// ======================================================

function setupEvents() {

  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  const logoutButton = document.getElementById("logoutButton");

  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }

  const refreshOrders =
    document.getElementById("refreshOrders");

  if (refreshOrders) {
    refreshOrders.addEventListener(
      "click",
      loadOrders
    );
  }

  const refreshAdvertisers =
    document.getElementById("refreshAdvertisers");

  if (refreshAdvertisers) {
    refreshAdvertisers.addEventListener(
      "click",
      loadAdvertiserApplications
    );
  }

  const storeForm =
    document.getElementById("storeForm");

  if (storeForm) {
    storeForm.addEventListener(
      "submit",
      handleStoreSubmit
    );
  }

  const productForm =
    document.getElementById("productForm");

  if (productForm) {
    productForm.addEventListener(
      "submit",
      handleProductSubmit
    );
  }

  const mediaForm =
    document.getElementById("mediaForm");

  if (mediaForm) {
    mediaForm.addEventListener(
      "submit",
      handleMediaUpload
    );
  }

  const mediaStore =
    document.getElementById("mediaStore");

  if (mediaStore) {
    mediaStore.addEventListener(
      "change",
      () => loadGallery(mediaStore.value)
    );
  }

  const productStore =
    document.getElementById("productStore");

  if (productStore) {
    productStore.addEventListener(
      "change",
      () => loadProducts(productStore.value)
    );
  }

}


// ======================================================
// AFFICHAGE CONNEXION
// ======================================================

function showLogin(message = "") {

  const loginSection =
    document.getElementById("loginSection");

  const dashboard =
    document.getElementById("dashboard");

  if (loginSection) {
    loginSection.classList.remove("admin-hidden");
  }

  if (dashboard) {
    dashboard.classList.add("admin-hidden");
  }

  const loginMessage =
    document.getElementById("loginMessage");

  if (loginMessage) {
    loginMessage.innerHTML = message
      ? `<div class="admin-error">${escapeHtml(message)}</div>`
      : "";
  }

}


// ======================================================
// AFFICHAGE ADMIN
// ======================================================

function showDashboard() {

  const loginSection =
    document.getElementById("loginSection");

  const dashboard =
    document.getElementById("dashboard");

  if (loginSection) {
    loginSection.classList.add("admin-hidden");
  }

  if (dashboard) {
    dashboard.classList.remove("admin-hidden");
  }

}


// ======================================================
// CONNEXION
// ======================================================

async function handleLogin(event) {

  event.preventDefault();

  const email =
    document.getElementById("adminEmail")?.value.trim();

  const password =
    document.getElementById("adminPassword")?.value;

  const message =
    document.getElementById("loginMessage");

  if (!email || !password) {

    if (message) {
      message.innerHTML =
        `<div class="admin-error">
          ⚠️ Email et mot de passe obligatoires.
        </div>`;
    }

    return;
  }

  if (message) {
    message.innerHTML =
      `<div class="admin-success">
        ⏳ Connexion...
      </div>`;
  }

  const {
    data,
    error
  } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {

    console.error(error);

    if (message) {
      message.innerHTML =
        `<div class="admin-error">
          ❌ ${escapeHtml(error.message)}
        </div>`;
    }

    return;
  }

  currentUser = data.user;

  await openAdmin();

}


// ======================================================
// VÉRIFICATION ADMIN
// ======================================================

async function checkAdmin() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    return false;
  }

  currentUser = session.user;

  const {
    data: isAdmin,
    error
  } = await supabaseClient.rpc("is_admin");

  if (error) {

    console.error(error);

    return false;
  }

  return isAdmin === true;

}


// ======================================================
// OUVRIR ADMIN
// ======================================================

async function openAdmin() {

  const allowed = await checkAdmin();

  if (!allowed) {

    await supabaseClient.auth.signOut();

    showLogin(
      "Accès administrateur refusé. Vérifie que ce compte possède bien les droits administrateur."
    );

    return;
  }

  showDashboard();

  await loadStats();
  await loadOrders();
  await loadCategories();
  await loadStores();
  await loadAdvertiserApplications();

}


// ======================================================
// DÉCONNEXION
// ======================================================

async function logout() {

  await supabaseClient.auth.signOut();

  currentUser = null;

  showLogin(
    "Vous êtes déconnecté."
  );

}


// ======================================================
// STATISTIQUES
// ======================================================

async function loadStats() {

  try {

    const {
      count: ordersCount
    } = await supabaseClient
      .from("orders")
      .select("*", {
        count: "exact",
        head: true
      });

    const {
      count: pendingCount
    } = await supabaseClient
      .from("orders")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("status", "pending");

    const {
      count: deliveredCount
    } = await supabaseClient
      .from("orders")
      .select("*", {
        count: "exact",
        head: true
      })
      .eq("status", "delivered");

    const {
      count: storesCount
    } = await supabaseClient
      .from("stores")
      .select("*", {
        count: "exact",
        head: true
      });

    const statOrders =
      document.getElementById("statOrders");

    const statPending =
      document.getElementById("statPending");

    const statDelivered =
      document.getElementById("statDelivered");

    const statStores =
      document.getElementById("statStores");

    if (statOrders)
      statOrders.textContent =
        ordersCount || 0;

    if (statPending)
      statPending.textContent =
        pendingCount || 0;

    if (statDelivered)
      statDelivered.textContent =
        deliveredCount || 0;

    if (statStores)
      statStores.textContent =
        storesCount || 0;

  } catch (error) {

    console.error(
      "Erreur statistiques :",
      error
    );

  }

}


// ======================================================
// COMMANDES
// ======================================================

async function loadOrders() {

  const container =
    document.getElementById("ordersList");

  if (!container) return;

  container.innerHTML =
    "⏳ Chargement des commandes...";

  const {
    data,
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
        driver_name,
        driver_phone,
        status,
        current_location,
        estimated_minutes
      )
    `)
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(error);

    container.innerHTML =
      "❌ Impossible de charger les commandes.";

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "Aucune commande pour le moment.";

    return;
  }

  container.innerHTML = "";

  data.forEach(order => {

    const customer =
      order.customers || {};

    const store =
      order.stores || {};

    const delivery = Array.isArray(order.deliveries)
      ? (order.deliveries[0] || {})
      : (order.deliveries || {});

    const card =
      document.createElement("div");

    card.className = "item-row";

    card.innerHTML = `

      <div class="item-head">

        <div class="item-title">
          📦 Commande #${order.order_number}
        </div>

        <div>
          ${formatPrice(order.total)}
        </div>

      </div>

      <div class="item-meta">

        👤 ${escapeHtml(customer.full_name || "-")}<br>

        📱 ${escapeHtml(customer.phone || "-")}<br>

        🏪 ${escapeHtml(store.name || "-")}<br>

        📍 ${escapeHtml(order.delivery_address || "-")}<br>

        💳 ${escapeHtml(order.payment_method || "-")}<br>

        📅 ${formatDate(order.created_at)}

      </div>

      <div class="status-line">

        <strong>Statut :</strong>

        <select
          onchange="
            updateOrderStatus(
              '${order.id}',
              this.value
            )
          "
        >

          ${orderStatusOptions(order.status)}

        </select>

      </div>

      ${
        order.customer_note
          ? `
            <p>
              📝
              ${escapeHtml(order.customer_note)}
            </p>
          `
          : ""
      }

      <hr>
      <h3>🚚 Livraison / livreur</h3>

      <label for="driverName-${order.id}">Nom du livreur</label>
      <input id="driverName-${order.id}" type="text"
        placeholder="Nom du livreur"
        value="${escapeHtml(delivery.driver_name || "")}">

      <label for="driverPhone-${order.id}">Téléphone du livreur</label>
      <input id="driverPhone-${order.id}" type="tel"
        placeholder="Téléphone du livreur"
        value="${escapeHtml(delivery.driver_phone || "")}">

      <label for="deliveryStatus-${order.id}">Statut de livraison</label>
      <select id="deliveryStatus-${order.id}">
        ${deliveryStatusOptions(delivery.status || "pending")}
      </select>

      <label for="deliveryLocation-${order.id}">Position / note de livraison</label>
      <input id="deliveryLocation-${order.id}" type="text"
        placeholder="Ex. en route vers le client"
        value="${escapeHtml(delivery.current_location || "")}">

      <label for="deliveryMinutes-${order.id}">Délai estimé (minutes)</label>
      <input id="deliveryMinutes-${order.id}" type="number" min="0" max="10080"
        placeholder="Ex. 25"
        value="${delivery.estimated_minutes ?? ""}">

      <button type="button" onclick="saveDelivery('${order.id}')">
        Enregistrer la livraison
      </button>

    `;

    container.appendChild(card);

  });

}


// ======================================================
// STATUTS COMMANDES
// ======================================================

function orderStatusOptions(current) {

  const statuses = [

    ["pending", "En attente"],
    ["confirmed", "Confirmée"],
    ["preparing", "En préparation"],
    ["ready", "Prête"],
    ["out_for_delivery", "En livraison"],
    ["delivered", "Livrée"],
    ["cancelled", "Annulée"]

  ];

  return statuses.map(
    ([value, label]) => `

      <option
        value="${value}"
        ${current === value ? "selected" : ""}
      >
        ${label}
      </option>

    `
  ).join("");

}


function deliveryStatusOptions(current) {
  const statuses = [
    ["pending", "À attribuer"],
    ["assigned", "Livreur attribué"],
    ["picked_up", "Commande récupérée"],
    ["in_transit", "En route"],
    ["delivered", "Livrée"],
    ["failed", "Échec de livraison"]
  ];

  return statuses.map(([value, label]) => `
    <option value="${value}" ${current === value ? "selected" : ""}>
      ${label}
    </option>
  `).join("");
}

async function saveDelivery(orderId) {
  const field = (name) => document.getElementById(`${name}-${orderId}`);
  const driverName = field("driverName")?.value.trim() || "";
  const driverPhone = field("driverPhone")?.value.trim() || "";
  const status = field("deliveryStatus")?.value || "pending";
  const currentLocation = field("deliveryLocation")?.value.trim() || "";
  const rawMinutes = field("deliveryMinutes")?.value.trim() || "";
  const estimatedMinutes = rawMinutes === "" ? null : Number(rawMinutes);

  if (estimatedMinutes !== null &&
      (!Number.isInteger(estimatedMinutes) ||
       estimatedMinutes < 0 || estimatedMinutes > 10080)) {
    alert("Le délai doit être un nombre entier entre 0 et 10080 minutes.");
    return;
  }

  const { error } = await supabaseClient.rpc("admin_update_delivery", {
    p_order_id: orderId,
    p_driver_name: driverName || null,
    p_driver_phone: driverPhone || null,
    p_status: status,
    p_current_location: currentLocation || null,
    p_estimated_minutes: estimatedMinutes
  });

  if (error) {
    console.error("Erreur d'enregistrement de la livraison :", error);
    alert("Impossible d'enregistrer la livraison. Vérifie que la fonction SQL admin_update_delivery existe dans Supabase.");
    return;
  }

  alert("Livraison enregistrée avec succès.");
  await loadOrders();
  if (typeof loadStats === "function") {
    await loadStats();
  }
}


async function updateOrderStatus(
  orderId,
  status
) {

  const {
    error
  } = await supabaseClient
    .from("orders")
    .update({
      status
    })
    .eq("id", orderId);

  if (error) {

    console.error(error);

    alert(
      "❌ Impossible de modifier le statut."
    );

    return;
  }

  await loadOrders();
  await loadStats();

}


// ======================================================
// CATÉGORIES
// ======================================================

async function loadCategories() {

  const select =
    document.getElementById("storeCategory");

  if (!select) return;

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

  select.innerHTML =
    `<option value="">
      Choisir une catégorie
    </option>`;

  data.forEach(category => {

    const option =
      document.createElement("option");

    option.value =
      category.id;

    option.textContent =
      category.name;

    select.appendChild(option);

  });

}


// ======================================================
// BOUTIQUES
// ======================================================

async function loadStores() {

  const container =
    document.getElementById("storesList");

  if (!container) return;

  container.innerHTML =
    "⏳ Chargement des boutiques...";

  const {
    data,
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
      logo_url,
      cover_url,
      is_open,
      is_published,
      delivery_available,
      merchant_code,
      category_id,
      store_categories (
        name
      )
    `)
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(error);

    container.innerHTML =
      "❌ Impossible de charger les boutiques.";

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "Aucune boutique.";

    await loadStoreSelectors([]);

    return;
  }

  container.innerHTML = "";

  data.forEach(store => {

    const card =
      document.createElement("div");

    card.className = "item-row";

    card.innerHTML = `

      <div class="item-head">

        <div class="item-title">
          🏪 ${escapeHtml(store.name)}
        </div>

        <div>
          ${
            store.is_published
              ? "🟢 Publiée"
              : "🔴 Non publiée"
          }
        </div>

      </div>

      <div class="item-meta">

        🏷️
        ${escapeHtml(
          store.store_categories?.name || "-"
        )}
        <br>

        📱 ${escapeHtml(store.phone || "-")}
        <br>

        📍 ${escapeHtml(store.address || "-")}
        <br>

        🏙️ ${escapeHtml(store.city || "-")}
        <br>

        🔑 Code marchand :
        <strong>
          ${escapeHtml(
            store.merchant_code || "Non attribué"
          )}
        </strong>

      </div>

      <button
        class="admin-button"
        onclick="editStore('${store.id}')"
      >
        ✏️ Modifier
      </button>

      <button
        class="admin-button gold"
        onclick="resendMerchantCode('${store.id}')"
      >
        📲 Renvoyer le code WhatsApp
      </button>

    `;

    container.appendChild(card);

  });

  await loadStoreSelectors(data);

  await loadStats();

}


// ======================================================
// SÉLECTEURS BOUTIQUES
// ======================================================

async function loadStoreSelectors(stores) {

  const selectors = [

    document.getElementById("mediaStore"),
    document.getElementById("productStore")

  ].filter(Boolean);

  selectors.forEach(select => {

    select.innerHTML =
      `<option value="">
        Sélectionner une boutique
      </option>`;

    stores.forEach(store => {

      const option =
        document.createElement("option");

      option.value =
        store.id;

      option.textContent =
        store.name;

      select.appendChild(option);

    });

  });

}


// ======================================================
// AJOUT / MODIFICATION BOUTIQUE
// ======================================================

async function handleStoreSubmit(event) {

  event.preventDefault();

  const name =
    document.getElementById("storeName")?.value.trim();

  const category =
    document.getElementById("storeCategory")?.value;

  const description =
    document.getElementById("storeDescription")?.value.trim();

  const phone =
    document.getElementById("storePhone")?.value.trim();

  const whatsapp =
    document.getElementById("storeWhatsapp")?.value.trim();

  const address =
    document.getElementById("storeAddress")?.value.trim();

  const logo =
    document.getElementById("storeLogo")?.value.trim();

  const cover =
    document.getElementById("storeCover")?.value.trim();

  const delivery =
    document.getElementById("storeDelivery")?.checked;

  if (!name || !category || !phone) {

    alert(
      "⚠️ Nom, catégorie et téléphone sont obligatoires."
    );

    return;
  }

  const slug =
    createSlug(name);

  const payload = {

    name,
    slug,
    category_id: category,
    description,
    phone,
    whatsapp,
    address,
    city: "Parakou",
    logo_url: logo || null,
    cover_url: cover || null,
    is_open: true,
    is_published: true,
    delivery_available:
      delivery !== false

  };

  let result;

  if (currentStoreId) {

    result =
      await supabaseClient
        .from("stores")
        .update(payload)
        .eq("id", currentStoreId);

  } else {

    result =
      await supabaseClient
        .from("stores")
        .insert(payload);

  }

  if (result.error) {

    console.error(result.error);

    alert(
      "❌ Erreur : " +
      result.error.message
    );

    return;
  }

  alert(
    currentStoreId
      ? "✅ Boutique modifiée avec succès."
      : "✅ Boutique créée avec succès."
  );

  currentStoreId = null;

  document.getElementById(
    "storeForm"
  )?.reset();

  await loadStores();

}


// ======================================================
// MODIFIER BOUTIQUE
// ======================================================

async function editStore(storeId) {

  const {
    data,
    error
  } = await supabaseClient
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();

  if (error) {

    console.error(error);

    alert(
      "❌ Impossible de charger la boutique."
    );

    return;
  }

  currentStoreId = storeId;

  setValue(
    "storeName",
    data.name
  );

  setValue(
    "storeCategory",
    data.category_id
  );

  setValue(
    "storeDescription",
    data.description
  );

  setValue(
    "storePhone",
    data.phone
  );

  setValue(
    "storeWhatsapp",
    data.whatsapp
  );

  setValue(
    "storeAddress",
    data.address
  );

  setValue(
    "storeLogo",
    data.logo_url
  );

  setValue(
    "storeCover",
    data.cover_url
  );

  const delivery =
    document.getElementById(
      "storeDelivery"
    );

  if (delivery) {
    delivery.checked =
      data.delivery_available !== false;
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// ======================================================
// PRODUITS
// ======================================================

async function handleProductSubmit(event) {

  event.preventDefault();

  const storeId =
    document.getElementById(
      "productStore"
    )?.value;

  const name =
    document.getElementById(
      "productName"
    )?.value.trim();

  const description =
    document.getElementById(
      "productDescription"
    )?.value.trim();

  const price =
    Number(
      document.getElementById(
        "productPrice"
      )?.value || 0
    );

  const image =
    document.getElementById(
      "productImage"
    )?.value.trim();

  const available =
    document.getElementById(
      "productAvailable"
    )?.checked;

  if (!storeId || !name || price <= 0) {

    alert(
      "⚠️ Boutique, nom et prix sont obligatoires."
    );

    return;
  }

  const {
    error
  } = await supabaseClient
    .from("products")
    .insert({

      store_id: storeId,

      name,

      slug:
        createSlug(name) +
        "-" +
        Date.now(),

      description,

      price,

      image_url:
        image || null,

      is_available:
        available !== false

    });

  if (error) {

    console.error(error);

    alert(
      "❌ Impossible d'ajouter le produit.\n\n" +
      error.message
    );

    return;
  }

  alert(
    "✅ Produit ajouté avec succès."
  );

  document.getElementById(
    "productForm"
  )?.reset();

  await loadProducts(storeId);

}


// ======================================================
// CHARGER PRODUITS
// ======================================================

async function loadProducts(storeId) {

  const container =
    document.getElementById(
      "productsList"
    );

  if (!container || !storeId) return;

  container.innerHTML =
    "⏳ Chargement...";

  const {
    data,
    error
  } = await supabaseClient
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(error);

    container.innerHTML =
      "❌ Erreur.";

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "Aucun produit.";

    return;
  }

  container.innerHTML = "";

  data.forEach(product => {

    const item =
      document.createElement("div");

    item.className = "item-row";

    item.innerHTML = `

      <div class="item-title">
        ${escapeHtml(product.name)}
      </div>

      <div class="item-meta">

        💰 ${formatPrice(product.price)}
        <br>

        ${
          product.is_available
            ? "🟢 Disponible"
            : "🔴 Indisponible"
        }

      </div>

      ${
        product.image_url
          ? `
            <img
              src="${escapeAttribute(product.image_url)}"
              style="
                width:120px;
                border-radius:12px;
              "
            >
          `
          : ""
      }

    `;

    container.appendChild(item);

  });

}


// ======================================================
// GALERIE
// ======================================================

async function handleMediaUpload(event) {

  event.preventDefault();

  const storeId =
    document.getElementById(
      "mediaStore"
    )?.value;

  const mediaType =
    document.getElementById(
      "mediaType"
    )?.value;

  const title =
    document.getElementById(
      "mediaTitle"
    )?.value.trim();

  const file =
    document.getElementById(
      "mediaFile"
    )?.files?.[0];

  const isCover =
    document.getElementById(
      "mediaCover"
    )?.checked;

  if (!storeId || !file) {

    alert(
      "⚠️ Sélectionne une boutique et un fichier."
    );

    return;
  }

  const button =
    document.getElementById(
      "uploadMediaButton"
    );

  if (button) {
    button.disabled = true;
    button.textContent =
      "⏳ Envoi...";
  }

  try {

    const extension =
      file.name
        .split(".")
        .pop()
        .toLowerCase();

    const filename =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${extension}`;

    const path =
      `${storeId}/${filename}`;

    const {
      error: uploadError
    } = await supabaseClient
      .storage
      .from("store-media")
      .upload(
        path,
        file,
        {
          upsert: false
        }
      );

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: publicData
    } = supabaseClient
      .storage
      .from("store-media")
      .getPublicUrl(path);

    if (isCover) {

      await supabaseClient
        .from("store_media")
        .update({
          is_cover: false
        })
        .eq("store_id", storeId);

    }

    const {
      error: mediaError
    } = await supabaseClient
      .from("store_media")
      .insert({

        store_id: storeId,

        media_type:
          mediaType === "image"
            ? "image"
            : "video",

        media_url:
          publicData.publicUrl,

        title:
          title || null,

        is_cover:
          isCover === true

      });

    if (mediaError) {
      throw mediaError;
    }

    if (isCover) {

      await supabaseClient
        .from("stores")
        .update({
          cover_url:
            publicData.publicUrl
        })
        .eq("id", storeId);

    }

    alert(
      "✅ Média ajouté avec succès."
    );

    document.getElementById(
      "mediaForm"
    )?.reset();

    await loadGallery(storeId);

  } catch (error) {

    console.error(error);

    alert(
      "❌ Erreur lors de l'envoi :\n\n" +
      error.message
    );

  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        "📤 Envoyer le média";

    }

  }

}


// ======================================================
// CHARGER GALERIE
// ======================================================

async function loadGallery(storeId) {

  const container =
    document.getElementById(
      "mediaList"
    );

  if (!container || !storeId) return;

  container.innerHTML =
    "⏳ Chargement...";

  const {
    data,
    error
  } = await supabaseClient
    .from("store_media")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(error);

    container.innerHTML =
      "❌ Erreur.";

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "Aucun média.";

    return;
  }

  container.innerHTML = "";

  data.forEach(media => {

    const item =
      document.createElement("div");

    item.className =
      "media-item";

    if (media.media_type === "image") {

      item.innerHTML = `

        <img
          src="${escapeAttribute(media.media_url)}"
          alt=""
        >

        <div class="media-info">

          ${escapeHtml(
            media.title || "Sans titre"
          )}

          ${
            media.is_cover
              ? `
                <div class="media-cover">
                  ⭐ Couverture
                </div>
              `
              : ""
          }

        </div>

      `;

    } else {

      item.innerHTML = `

        <video
          src="${escapeAttribute(media.media_url)}"
          controls
        ></video>

        <div class="media-info">

          ${escapeHtml(
            media.title || "Vidéo"
          )}

        </div>

      `;

    }

    container.appendChild(item);

  });

}


// ======================================================
// ANNONCEURS
// ======================================================

async function loadAdvertiserApplications() {

  const container =
    document.getElementById(
      "advertisersList"
    );

  if (!container) return;

  container.innerHTML =
    "⏳ Chargement des demandes...";

  const {
    data,
    error
  } = await supabaseClient
    .from("advertiser_applications")
    .select(`
      id,
      full_name,
      business_name,
      category,
      phone,
      whatsapp,
      city,
      address,
      description,
      goal,
      status,
      created_at,
      store_id,
      merchant_code
    `)
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(error);

    container.innerHTML =
      "❌ Impossible de charger les demandes.";

    return;
  }

  if (!data || data.length === 0) {

    container.innerHTML =
      "Aucune demande pour le moment.";

    return;
  }

  container.innerHTML = "";

  data.forEach(application => {

    const card =
      document.createElement("div");

    card.className =
      "item-row";

    card.innerHTML = `

      <div class="item-head">

        <div class="item-title">

          📣
          ${escapeHtml(
            application.business_name
          )}

        </div>

        <div>

          ${advertiserStatusLabel(
            application.status
          )}

        </div>

      </div>

      <div class="item-meta">

        👤
        ${escapeHtml(
          application.full_name
        )}
        <br>

        📱
        ${escapeHtml(
          application.phone
        )}
        <br>

        🏷️
        ${escapeHtml(
          application.category
        )}
        <br>

        🏙️
        ${escapeHtml(
          application.city
        )}

      </div>

      ${
        application.description
          ? `
            <p>
              ${escapeHtml(
                application.description
              )}
            </p>
          `
          : ""
      }

      ${
        application.merchant_code
          ? `
            <p>
              🔑
              <strong>
                Code marchand :
                ${escapeHtml(
                  application.merchant_code
                )}
              </strong>
            </p>
          `
          : ""
      }

      <div class="status-line">

        <select
          onchange="
            updateAdvertiserStatus(
              '${application.id}',
              this.value
            )
          "
        >

          ${advertiserStatusOptions(
            application.status
          )}

        </select>

        ${
          application.status === "pending"
            ? `
              <button
                class="admin-button gold"
                onclick="
                  approveAdvertiser(
                    '${application.id}'
                  )
                "
              >
                ✅ Approuver
              </button>
            `
            : ""
        }

      </div>

    `;

    container.appendChild(card);

  });

}


// ======================================================
// STATUT ANNONCEUR
// ======================================================

function advertiserStatusOptions(current) {

  const statuses = [

    ["pending", "En attente"],
    ["contacted", "Contacté"],
    ["approved", "Approuvé"],
    ["rejected", "Refusé"]

  ];

  return statuses.map(
    ([value, label]) => `

      <option
        value="${value}"
        ${current === value ? "selected" : ""}
      >
        ${label}
      </option>

    `
  ).join("");

}


function advertiserStatusLabel(status) {

  const labels = {

    pending: "🟡 En attente",
    contacted: "🔵 Contacté",
    approved: "🟢 Approuvé",
    rejected: "🔴 Refusé"

  };

  return labels[status] || status;

}


async function updateAdvertiserStatus(
  applicationId,
  status
) {

  const {
    error
  } = await supabaseClient
    .from("advertiser_applications")
    .update({

      status,

      updated_at:
        new Date().toISOString()

    })
    .eq("id", applicationId);

  if (error) {

    console.error(error);

    alert(
      "❌ Impossible de modifier le statut."
    );

    return;
  }

  await loadAdvertiserApplications();

}


// ======================================================
// APPROUVER ANNONCEUR
// ======================================================


// ======================================================
// RÉCUPÉRER ANNONCEUR
// ======================================================

async function approveAdvertiser(applicationId) {
  const application = await getApplication(applicationId);

  if (!application) {
    alert("❌ Demande introuvable.");
    return;
  }

  const confirmed = confirm(
    `Créer et publier la boutique "${application.business_name}" ?`
  );

  if (!confirmed) return;

  // Ouvrir une fenêtre immédiatement pour éviter le blocage du navigateur
  const whatsappWindow = window.open("about:blank", "_blank");

  // 1. Créer et approuver la boutique
  const { data: storeId, error } = await supabaseClient.rpc(
    "approve_advertiser_application",
    {
      p_application_id: applicationId
    }
  );

  if (error || !storeId) {
    if (whatsappWindow) whatsappWindow.close();

    console.error(error);
    alert(
      "❌ Impossible de créer la boutique.\n\n" +
      (error?.message || "Aucun identifiant de boutique reçu.")
    );
    return;
  }

  // 2. Récupérer le code marchand
  const { data: storeData, error: storeError } =
    await supabaseClient
      .from("stores")
      .select("merchant_code")
      .eq("id", storeId)
      .single();

  await loadAdvertiserApplications();
  await loadStores();

  if (storeError || !storeData?.merchant_code) {
    if (whatsappWindow) whatsappWindow.close();

    console.error(storeError);
    alert(
      `✅ Boutique "${application.business_name}" créée.\n\n` +
      "⚠️ Impossible de récupérer le code marchand."
    );
    return;
  }

  const merchantCode = storeData.merchant_code;

  // 3. Préparer le message destiné au commerçant
  const rawPhone = String(
    application.whatsapp || application.phone || ""
  );

  let phone = rawPhone.replace(/\D/g, "");

  // Ajouter l'indicatif du Bénin si nécessaire
  if (phone && !phone.startsWith("229")) {
    phone = "229" + phone;
  }

  const message =
    `Bonjour ${application.business_name} ! 👋\n\n` +
    `Bonne nouvelle : votre boutique a été approuvée et publiée sur PK ChapShop. 🎉\n\n` +
    `🏪 Boutique : ${application.business_name}\n` +
    `🔑 Votre code marchand : ${merchantCode}\n\n` +
    `Conservez ce code précieusement. Il pourra vous être demandé pour vos démarches liées à votre boutique.\n\n` +
    `Merci de votre confiance !\n` +
    `L'équipe PK ChapShop`;

  // 4. Ouvrir WhatsApp avec le message prérempli
  if (phone) {
    const whatsappUrl =
      "https://wa.me/" + phone +
      "?text=" + encodeURIComponent(message);

    if (whatsappWindow) {
      whatsappWindow.location.href = whatsappUrl;
    } else {
      window.open(whatsappUrl, "_blank");
    }

    alert(
      `✅ BOUTIQUE CRÉÉE !\n\n` +
      `🏪 ${application.business_name}\n\n` +
      `🔑 CODE MARCHAND : ${merchantCode}\n\n` +
      `WhatsApp va s'ouvrir avec le message préparé.\n` +
      `Vérifie le destinataire puis appuie sur ENVOYER.`
    );
  } else {
    if (whatsappWindow) whatsappWindow.close();

    alert(
      `✅ BOUTIQUE CRÉÉE !\n\n` +
      `🏪 ${application.business_name}\n\n` +
      `🔑 CODE MARCHAND : ${merchantCode}\n\n` +
      `⚠️ Aucun numéro WhatsApp trouvé pour ce commerçant.\n` +
      `Contacte-le manuellement pour lui transmettre son code.`
    );
  }
}


// ======================================================
// RENVOYER LE CODE MARCHAND PAR WHATSAPP
// ======================================================

async function resendMerchantCode(storeId) {

  const { data: store, error } = await supabaseClient
    .from("stores")
    .select("name, phone, whatsapp, merchant_code")
    .eq("id", storeId)
    .single();

  if (error || !store) {
    console.error(error);
    alert("❌ Impossible de récupérer les informations de la boutique.");
    return;
  }

  if (!store.merchant_code) {
    alert("⚠️ Aucun code marchand n'est attribué à cette boutique.");
    return;
  }

  const rawPhone = String(
    store.whatsapp || store.phone || ""
  );

  let phone = rawPhone.replace(/\D/g, "");

  // Ajouter l'indicatif du Bénin si nécessaire
  if (phone && !phone.startsWith("229")) {
    phone = "229" + phone;
  }

  if (!phone) {
    alert(
      "⚠️ Aucun numéro de téléphone disponible pour cette boutique."
    );
    return;
  }

  const confirmed = confirm(
    `Renvoyer le code marchand de "${store.name}" sur WhatsApp ?`
  );

  if (!confirmed) return;

  const message =
    `Bonjour ${store.name} ! 👋\n\n` +
    `Voici un rappel de votre code marchand PK ChapShop.\n\n` +
    `🏪 Boutique : ${store.name}\n` +
    `🔑 Code marchand : ${store.merchant_code}\n\n` +
    `Conservez ce code précieusement.\n\n` +
    `Merci de votre confiance !\n` +
    `L'équipe PK ChapShop`;

  const whatsappUrl =
    "https://wa.me/" +
    phone +
    "?text=" +
    encodeURIComponent(message);

  window.open(whatsappUrl, "_blank");

}


async function getApplication(
  applicationId
) {

  const {
    data,
    error
  } = await supabaseClient
    .from("advertiser_applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (error) {

    console.error(error);

    return null;
  }

  return data;

}


// ======================================================
// UTILITAIRES
// ======================================================

function formatPrice(price) {

  return (
    Number(price || 0)
      .toLocaleString("fr-FR") +
    " FCFA"
  );

}


function formatDate(date) {

  if (!date) return "-";

  return new Date(date)
    .toLocaleString(
      "fr-FR",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );

}


function createSlug(text) {

  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      "");

}


function setValue(id, value) {

  const element =
    document.getElementById(id);

  if (element) {
    element.value =
      value || "";
  }

}


function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}


function escapeAttribute(value) {

  return escapeHtml(value);

}


// ======================================================
// FONCTIONS ACCESSIBLES DEPUIS HTML
// ======================================================

window.logout =
  logout;

window.updateOrderStatus =
  updateOrderStatus;

window.saveDelivery =
  saveDelivery;

window.editStore =
  editStore;

window.saveStore =
  handleStoreSubmit;

window.loadProducts =
  loadProducts;

window.loadGallery =
  loadGallery;

window.updateAdvertiserStatus =
  updateAdvertiserStatus;

window.approveAdvertiser =
  approveAdvertiser;

window.resendMerchantCode =
  resendMerchantCode;

window.loadAdvertiserApplications =
  loadAdvertiserApplications;

window.loadStores =
  loadStores;
