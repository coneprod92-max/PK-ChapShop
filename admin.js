const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;
let currentStoreId = null;


// ======================================================
// AUTHENTIFICATION
// ======================================================

async function checkAdmin() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return false;
  }

  currentUser = session.user;

  const { data: isAdmin, error } =
    await supabaseClient.rpc("is_admin");

  if (error || !isAdmin) {
    alert("⛔ Accès administrateur refusé.");
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
    return false;
  }

  return true;
}


// ======================================================
// DÉCONNEXION
// ======================================================

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}


// ======================================================
// COMMANDES
// ======================================================

async function loadOrders() {
  const container = document.getElementById("ordersList");

  if (!container) return;

  container.innerHTML = "⏳ Chargement des commandes...";

  const { data, error } = await supabaseClient
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
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = "❌ Impossible de charger les commandes.";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "Aucune commande pour le moment.";
    return;
  }

  container.innerHTML = "";

  data.forEach((order) => {
    const customer = order.customers || {};
    const store = order.stores || {};

    const card = document.createElement("div");
    card.className = "admin-card";

    card.innerHTML = `
      <h3>📦 Commande #${order.order_number}</h3>

      <p>
        <strong>Client :</strong>
        ${escapeHtml(customer.full_name || "-")}
      </p>

      <p>
        <strong>Téléphone :</strong>
        ${escapeHtml(customer.phone || "-")}
      </p>

      <p>
        <strong>Boutique :</strong>
        ${escapeHtml(store.name || "-")}
      </p>

      <p>
        <strong>Adresse :</strong>
        ${escapeHtml(order.delivery_address || "-")}
      </p>

      <p>
        <strong>Paiement :</strong>
        ${escapeHtml(order.payment_method || "-")}
      </p>

      <p>
        <strong>Total :</strong>
        ${formatPrice(order.total)}
      </p>

      <p>
        <strong>Date :</strong>
        ${formatDate(order.created_at)}
      </p>

      <label>
        <strong>Statut :</strong>
        <select onchange="updateOrderStatus('${order.id}', this.value)">
          ${orderStatusOptions(order.status)}
        </select>
      </label>

      ${
        order.customer_note
          ? `
            <p>
              <strong>Note :</strong>
              ${escapeHtml(order.customer_note)}
            </p>
          `
          : ""
      }
    `;

    container.appendChild(card);
  });
}


// ======================================================
// STATUT COMMANDE
// ======================================================

function orderStatusOptions(current) {
  const statuses = [
    ["pending", "En attente"],
    ["confirmed", "Confirmée"],
    ["preparing", "En préparation"],
    ["ready", "Prête"],
    ["out_for_delivery", "En livraison"],
    ["delivered", "Livrée"],
    ["cancelled", "Annulée"],
  ];

  return statuses
    .map(
      ([value, label]) => `
        <option value="${value}" ${
          current === value ? "selected" : ""
        }>
          ${label}
        </option>
      `
    )
    .join("");
}


async function updateOrderStatus(orderId, status) {
  const { error } = await supabaseClient
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    console.error(error);
    alert("❌ Impossible de modifier le statut.");
    return;
  }

  await loadOrders();
}


// ======================================================
// BOUTIQUES
// ======================================================

async function loadStores() {
  const container = document.getElementById("storesList");

  if (!container) return;

  container.innerHTML = "⏳ Chargement des boutiques...";

  const { data, error } = await supabaseClient
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
      merchant_code,
      category_id,
      store_categories (
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = "❌ Impossible de charger les boutiques.";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "Aucune boutique.";
    return;
  }

  container.innerHTML = "";

  data.forEach((store) => {
    const card = document.createElement("div");
    card.className = "admin-card";

    card.innerHTML = `
      <h3>🏪 ${escapeHtml(store.name)}</h3>

      <p>
        <strong>Catégorie :</strong>
        ${escapeHtml(store.store_categories?.name || "-")}
      </p>

      <p>
        <strong>Téléphone :</strong>
        ${escapeHtml(store.phone || "-")}
      </p>

      <p>
        <strong>Ville :</strong>
        ${escapeHtml(store.city || "-")}
      </p>

      <p>
        <strong>Adresse :</strong>
        ${escapeHtml(store.address || "-")}
      </p>

      <p>
        <strong>Code marchand :</strong>
        ${
          store.merchant_code
            ? `<strong>${escapeHtml(store.merchant_code)}</strong>`
            : "Non attribué"
        }
      </p>

      <p>
        <strong>Publication :</strong>
        ${store.is_published ? "🟢 Publiée" : "🔴 Non publiée"}
      </p>

      <p>
        <strong>Ouverture :</strong>
        ${store.is_open ? "🟢 Ouverte" : "🔴 Fermée"}
      </p>

      <p>
        <strong>Livraison :</strong>
        ${store.delivery_available ? "✅ Oui" : "❌ Non"}
      </p>

      <button
        class="admin-button"
        onclick="editStore('${store.id}')"
      >
        ✏️ Modifier
      </button>
    `;

    container.appendChild(card);
  });

  await loadStoreSelectors(data);
}


// ======================================================
// SÉLECTEURS DE BOUTIQUES
// ======================================================

async function loadStoreSelectors(stores) {
  const selectors = [
    document.getElementById("mediaStore"),
    document.getElementById("galleryStore"),
    document.getElementById("storeSelector"),
  ].filter(Boolean);

  selectors.forEach((select) => {
    select.innerHTML = `
      <option value="">Sélectionner une boutique</option>
    `;

    stores.forEach((store) => {
      const option = document.createElement("option");

      option.value = store.id;
      option.textContent = store.name;

      select.appendChild(option);
    });
  });
}


// ======================================================
// MODIFIER UNE BOUTIQUE
// ======================================================

async function editStore(storeId) {
  const { data, error } = await supabaseClient
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();

  if (error) {
    console.error(error);
    alert("❌ Impossible de charger la boutique.");
    return;
  }

  currentStoreId = storeId;

  const nameInput = document.getElementById("storeName");
  const descriptionInput = document.getElementById("storeDescription");
  const phoneInput = document.getElementById("storePhone");

  if (nameInput) nameInput.value = data.name || "";
  if (descriptionInput)
    descriptionInput.value = data.description || "";
  if (phoneInput) phoneInput.value = data.phone || "";

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}


// ======================================================
// ENREGISTRER UNE BOUTIQUE
// ======================================================

async function saveStore() {
  const name = document.getElementById("storeName")?.value.trim();
  const description =
    document.getElementById("storeDescription")?.value.trim();
  const phone = document.getElementById("storePhone")?.value.trim();

  if (!name) {
    alert("⚠️ Le nom de la boutique est obligatoire.");
    return;
  }

  if (!currentStoreId) {
    alert("⚠️ Sélectionne d'abord une boutique.");
    return;
  }

  const { error } = await supabaseClient
    .from("stores")
    .update({
      name,
      description,
      phone,
    })
    .eq("id", currentStoreId);

  if (error) {
    console.error(error);
    alert("❌ Erreur lors de la modification.");
    return;
  }

  alert("✅ Boutique modifiée avec succès.");

  await loadStores();
}


// ======================================================
// PRODUITS
// ======================================================

async function loadProducts(storeId) {
  if (!storeId) return;

  const container = document.getElementById("productsList");

  if (!container) return;

  container.innerHTML = "⏳ Chargement des produits...";

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = "❌ Erreur.";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "Aucun produit.";
    return;
  }

  container.innerHTML = "";

  data.forEach((product) => {
    const card = document.createElement("div");

    card.className = "admin-card";

    card.innerHTML = `
      <h3>${escapeHtml(product.name)}</h3>

      <p>
        💰 ${formatPrice(product.price)}
      </p>

      <p>
        ${product.is_available ? "🟢 Disponible" : "🔴 Indisponible"}
      </p>

      ${
        product.image_url
          ? `
            <img
              src="${escapeAttribute(product.image_url)}"
              alt=""
              style="max-width:150px;border-radius:12px;"
            >
          `
          : ""
      }
    `;

    container.appendChild(card);
  });
}


// ======================================================
// GALERIE / MÉDIAS
// ======================================================

async function loadGallery(storeId) {
  const container = document.getElementById("galleryList");

  if (!container || !storeId) return;

  container.innerHTML = "⏳ Chargement...";

  const { data, error } = await supabaseClient
    .from("store_media")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = "❌ Erreur.";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "Aucun média.";
    return;
  }

  container.innerHTML = "";

  data.forEach((media) => {
    const card = document.createElement("div");

    card.className = "admin-card";

    card.innerHTML = `
      <h3>${escapeHtml(media.title || "Sans titre")}</h3>

      <p>
        Type : ${escapeHtml(media.media_type)}
      </p>

      ${
        media.media_type === "photo"
          ? `
            <img
              src="${escapeAttribute(media.media_url)}"
              alt=""
              style="max-width:200px;border-radius:12px;"
            >
          `
          : `
            <a
              href="${escapeAttribute(media.media_url)}"
              target="_blank"
            >
              🎥 Voir la vidéo
            </a>
          `
      }

      ${
        media.is_cover
          ? "<p>⭐ Couverture</p>"
          : ""
      }
    `;

    container.appendChild(card);
  });
}


// ======================================================
// DEMANDES ANNONCEURS
// ======================================================

async function loadAdvertiserApplications() {
  const container = document.getElementById(
    "advertiserApplications"
  );

  if (!container) return;

  container.innerHTML =
    "⏳ Chargement des demandes...";

  const { data, error } = await supabaseClient
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
      ascending: false,
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

  data.forEach((application) => {
    const card = document.createElement("div");

    card.className = "admin-card";

    card.innerHTML = `
      <h3>
        📣 ${escapeHtml(application.business_name)}
      </h3>

      <p>
        <strong>Responsable :</strong>
        ${escapeHtml(application.full_name)}
      </p>

      <p>
        <strong>Catégorie :</strong>
        ${escapeHtml(application.category)}
      </p>

      <p>
        <strong>Téléphone :</strong>
        ${escapeHtml(application.phone)}
      </p>

      ${
        application.whatsapp
          ? `
            <p>
              <strong>WhatsApp :</strong>
              ${escapeHtml(application.whatsapp)}
            </p>
          `
          : ""
      }

      <p>
        <strong>Ville :</strong>
        ${escapeHtml(application.city)}
      </p>

      ${
        application.address
          ? `
            <p>
              <strong>Adresse :</strong>
              ${escapeHtml(application.address)}
            </p>
          `
          : ""
      }

      ${
        application.description
          ? `
            <p>
              <strong>Description :</strong><br>
              ${escapeHtml(application.description)}
            </p>
          `
          : ""
      }

      ${
        application.goal
          ? `
            <p>
              <strong>Objectif :</strong><br>
              ${escapeHtml(application.goal)}
            </p>
          `
          : ""
      }

      ${
        application.merchant_code
          ? `
            <p>
              🔑 <strong>Code marchand :</strong>
              ${escapeHtml(application.merchant_code)}
            </p>
          `
          : ""
      }

      <p>
        <strong>Statut :</strong>

        <select
          onchange="updateAdvertiserStatus(
            '${application.id}',
            this.value
          )"
        >
          ${advertiserStatusOptions(application.status)}
        </select>
      </p>

      ${
        application.status === "pending"
          ? `
            <button
              class="admin-button"
              onclick="approveAdvertiser(
                '${application.id}'
              )"
            >
              ✅ Approuver & créer la boutique
            </button>
          `
          : ""
      }

      ${
        application.status === "approved"
          ? `
            <p>
              🟢 <strong>Boutique créée et publiée.</strong>
            </p>
          `
          : ""
      }
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
    ["rejected", "Refusé"],
  ];

  return statuses
    .map(
      ([value, label]) => `
        <option value="${value}" ${
          current === value ? "selected" : ""
        }>
          ${label}
        </option>
      `
    )
    .join("");
}


async function updateAdvertiserStatus(
  applicationId,
  status
) {
  const { error } = await supabaseClient
    .from("advertiser_applications")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) {
    console.error(error);
    alert("❌ Impossible de modifier le statut.");
    return;
  }

  await loadAdvertiserApplications();
}


// ======================================================
// APPROUVER UN ANNONCEUR
// ======================================================

async function approveAdvertiser(applicationId) {
  const application = await getApplication(
    applicationId
  );

  if (!application) {
    alert("❌ Demande introuvable.");
    return;
  }

  const confirmed = confirm(
    `Créer et publier la boutique "${application.business_name}" ?`
  );

  if (!confirmed) return;

  const {
    data: storeId,
    error,
  } = await supabaseClient
    .rpc(
      "approve_advertiser_application",
      {
        p_application_id: applicationId,
      }
    );

  if (error) {
    console.error(error);

    alert(
      "❌ Impossible de créer la boutique.\n\n" +
      error.message
    );

    return;
  }

  if (!storeId) {
    alert(
      "❌ La boutique n'a pas pu être créée."
    );
    return;
  }

  // Récupération du code marchand
  const {
    data: storeData,
    error: storeError,
  } = await supabaseClient
    .from("stores")
    .select("merchant_code")
    .eq("id", storeId)
    .single();

  if (
    storeError ||
    !storeData?.merchant_code
  ) {
    alert(
      `✅ Boutique "${application.business_name}" créée.\n\n` +
      `⚠️ La boutique est créée, mais le code marchand n'a pas pu être récupéré.`
    );

    await loadAdvertiserApplications();
    await loadStores();

    return;
  }

  const merchantCode =
    storeData.merchant_code;

  await loadAdvertiserApplications();
  await loadStores();

  alert(
    `✅ BOUTIQUE CRÉÉE AVEC SUCCÈS !\n\n` +
    `🏪 ${application.business_name}\n\n` +
    `🔑 CODE MARCHAND : ${merchantCode}\n\n` +
    `📱 Donne ce code au commerçant.\n\n` +
    `Il pourra ensuite créer son compte et rattacher sa boutique.`
  );
}


// ======================================================
// RÉCUPÉRER UNE DEMANDE
// ======================================================

async function getApplication(applicationId) {
  const { data, error } = await supabaseClient
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
// INITIALISATION
// ======================================================

async function initAdmin() {
  const allowed = await checkAdmin();

  if (!allowed) return;

  await loadOrders();
  await loadStores();
  await loadAdvertiserApplications();
}


// ======================================================
// UTILITAIRES
// ======================================================

function formatPrice(price) {
  return (
    Number(price || 0).toLocaleString(
      "fr-FR"
    ) + " FCFA"
  );
}


function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleString(
    "fr-FR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}


function escapeHtml(value) {
  if (value === null || value === undefined)
    return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {
  return escapeHtml(value);
}


// ======================================================
// LANCEMENT
// ======================================================

document.addEventListener(
  "DOMContentLoaded",
  initAdmin
);


// Exposition des fonctions utilisées par le HTML
window.logout = logout;
window.updateOrderStatus = updateOrderStatus;
window.editStore = editStore;
window.saveStore = saveStore;
window.loadProducts = loadProducts;
window.loadGallery = loadGallery;
window.updateAdvertiserStatus =
  updateAdvertiserStatus;
window.approveAdvertiser =
  approveAdvertiser;
window.loadAdvertiserApplications =
  loadAdvertiserApplications;
window.loadStores = loadStores;
