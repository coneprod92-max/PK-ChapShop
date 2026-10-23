
const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;
let currentStoreId = null;

// INITIALISATION
document.addEventListener("DOMContentLoaded", async () => {
  setupEvents();
  showLogin();

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data?.session) {
      currentUser = data.session.user;
      await openAdmin();
    }
  } catch (error) {
    console.error("Initialisation :", error);
    showLogin("Erreur d'initialisation : " + error.message);
  }
});

// ÉVÉNEMENTS
function setupEvents() {
  document.getElementById("loginForm")
    ?.addEventListener("submit", handleLogin);

  document.getElementById("logoutButton")
    ?.addEventListener("click", logout);

  document.getElementById("refreshOrders")
    ?.addEventListener("click", loadOrders);

  document.getElementById("refreshAdvertisers")
    ?.addEventListener("click", loadAdvertiserApplications);

  document.getElementById("storeForm")
    ?.addEventListener("submit", handleStoreSubmit);

  document.getElementById("productForm")
    ?.addEventListener("submit", handleProductSubmit);

  document.getElementById("mediaForm")
    ?.addEventListener("submit", handleMediaUpload);

  document.getElementById("mediaStore")
    ?.addEventListener("change", event => loadGallery(event.target.value));

  document.getElementById("productStore")
    ?.addEventListener("change", event => loadProducts(event.target.value));
}

// AFFICHAGE
function showLogin(message = "") {
  document.getElementById("loginSection")?.classList.remove("admin-hidden");
  document.getElementById("dashboard")?.classList.add("admin-hidden");

  const box = document.getElementById("loginMessage");
  if (box) {
    box.innerHTML = message
      ? `<div class="admin-error">${escapeHtml(message)}</div>`
      : "";
  }
}

function showDashboard() {
  document.getElementById("loginSection")?.classList.add("admin-hidden");
  document.getElementById("dashboard")?.classList.remove("admin-hidden");
}

// CONNEXION
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("adminEmail")?.value.trim();
  const password = document.getElementById("adminPassword")?.value;
  const message = document.getElementById("loginMessage");
  const button = document.querySelector("#loginForm button[type='submit']");

  if (!email || !password) {
    showLogin("Saisis ton adresse e-mail et ton mot de passe.");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Connexion en cours...";
  }

  if (message) {
    message.innerHTML = '<div class="admin-success">Connexion en cours...</div>';
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    if (!data?.user) throw new Error("Supabase n'a pas confirmé la connexion.");

    currentUser = data.user;
    await openAdmin();
  } catch (error) {
    console.error("Connexion :", error);
    showLogin("Échec de connexion : " + (error.message || "Erreur inconnue"));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "🔐 Se connecter";
    }
  }
}

// DROITS ADMINISTRATEUR
async function checkAdmin() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;

  if (!data?.session) return false;
  currentUser = data.session.user;

  const { data: allowed, error: adminError } =
    await supabaseClient.rpc("is_admin");

  if (adminError) {
    throw new Error(
      "Impossible de vérifier les droits administrateur : " +
      adminError.message
    );
  }

  return allowed === true;
}

async function openAdmin() {
  try {
    const allowed = await checkAdmin();

    if (!allowed) {
      await supabaseClient.auth.signOut();
      currentUser = null;
      showLogin("Ce compte n'a pas les droits administrateur.");
      return;
    }

    showDashboard();

    await Promise.allSettled([
      loadStats(),
      loadOrders(),
      loadCategories(),
      loadStores(),
      loadAdvertiserApplications()
    ]);
  } catch (error) {
    console.error("Ouverture admin :", error);
    showLogin(error.message || "Impossible d'ouvrir le tableau de bord.");
  }
}

// DÉCONNEXION
async function logout() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert("Erreur de déconnexion : " + error.message);
    return;
  }

  currentUser = null;
  showLogin("Vous êtes déconnecté.");
}

// STATISTIQUES
async function loadStats() {
  try {
    const [orders, pending, delivered, stores] = await Promise.all([
      supabaseClient.from("orders").select("*", { count: "exact", head: true }),
      supabaseClient.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabaseClient.from("orders").select("*", { count: "exact", head: true }).eq("status", "delivered"),
      supabaseClient.from("stores").select("*", { count: "exact", head: true })
    ]);

    if (orders.error) throw orders.error;
    if (pending.error) throw pending.error;
    if (delivered.error) throw delivered.error;
    if (stores.error) throw stores.error;

    const values = {
      statOrders: orders.count || 0,
      statPending: pending.count || 0,
      statDelivered: delivered.count || 0,
      statStores: stores.count || 0
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  } catch (error) {
    console.error("Statistiques :", error);
  }
}

// COMMANDES
async function loadOrders() {
  const container = document.getElementById("ordersList");
  if (!container) return;

  container.textContent = "Chargement des commandes...";

  const { data, error } = await supabaseClient
    .from("orders")
    .select(`
      id, order_number, status, payment_method, total,
      delivery_address, customer_note, created_at,
      customers(full_name, phone),
      stores(name),
      deliveries(driver_name, driver_phone, status, current_location, estimated_minutes)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "Erreur de chargement : " + error.message;
    console.error(error);
    return;
  }

  if (!data?.length) {
    container.textContent = "Aucune commande pour le moment.";
    return;
  }

  container.innerHTML = "";

  data.forEach(order => {
    const customer = order.customers || {};
    const store = order.stores || {};
    const delivery = Array.isArray(order.deliveries)
      ? order.deliveries[0] || {}
      : order.deliveries || {};

    const card = document.createElement("div");
    card.className = "item-row";

    card.innerHTML = `
      <div class="item-head">
        <strong>Commande #${escapeHtml(order.order_number || order.id)}</strong>
        <strong>${formatPrice(order.total)}</strong>
      </div>
      <div class="item-meta">
        Client : ${escapeHtml(customer.full_name || "-")}<br>
        Téléphone : ${escapeHtml(customer.phone || "-")}<br>
        Boutique : ${escapeHtml(store.name || "-")}<br>
        Adresse : ${escapeHtml(order.delivery_address || "-")}<br>
        Paiement : ${escapeHtml(order.payment_method || "-")}<br>
        Date : ${formatDate(order.created_at)}
      </div>
      <label>Statut de la commande</label>
      <select onchange="updateOrderStatus('${order.id}', this.value)">
        ${orderStatusOptions(order.status)}
      </select>
      ${order.customer_note ? `<p>Note : ${escapeHtml(order.customer_note)}</p>` : ""}
      <hr>
      <label for="driverName-${order.id}">Nom du livreur</label>
      <input id="driverName-${order.id}" value="${escapeAttribute(delivery.driver_name || "")}">
      <label for="driverPhone-${order.id}">Téléphone du livreur</label>
      <input id="driverPhone-${order.id}" value="${escapeAttribute(delivery.driver_phone || "")}">
      <label for="deliveryStatus-${order.id}">Statut de livraison</label>
      <select id="deliveryStatus-${order.id}">
        ${deliveryStatusOptions(delivery.status || "pending")}
      </select>
      <label for="deliveryLocation-${order.id}">Position ou note</label>
      <input id="deliveryLocation-${order.id}" value="${escapeAttribute(delivery.current_location || "")}">
      <label for="deliveryMinutes-${order.id}">Délai estimé en minutes</label>
      <input id="deliveryMinutes-${order.id}" type="number" min="0" max="10080" value="${delivery.estimated_minutes ?? ""}">
      <button type="button" onclick="saveDelivery('${order.id}')">Enregistrer la livraison</button>
    `;

    container.appendChild(card);
  });
}

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

  return statuses.map(([value, label]) =>
    `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`
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

  return statuses.map(([value, label]) =>
    `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`
  ).join("");
}

async function saveDelivery(orderId) {
  const field = name => document.getElementById(`${name}-${orderId}`);
  const rawMinutes = field("deliveryMinutes")?.value.trim() || "";
  const minutes = rawMinutes === "" ? null : Number(rawMinutes);

  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080)) {
    alert("Le délai doit être un nombre entier entre 0 et 10080 minutes.");
    return;
  }

  const { error } = await supabaseClient.rpc("admin_update_delivery", {
    p_order_id: orderId,
    p_driver_name: field("driverName")?.value.trim() || null,
    p_driver_phone: field("driverPhone")?.value.trim() || null,
    p_status: field("deliveryStatus")?.value || "pending",
    p_current_location: field("deliveryLocation")?.value.trim() || null,
    p_estimated_minutes: minutes
  });

  if (error) {
    alert("Impossible d'enregistrer la livraison : " + error.message);
    return;
  }

  alert("Livraison enregistrée.");
  await loadOrders();
}

async function updateOrderStatus(orderId, status) {
  const { error } = await supabaseClient
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    alert("Impossible de modifier le statut : " + error.message);
    return;
  }

  await loadOrders();
  await loadStats();
}

// CATÉGORIES
async function loadCategories() {
  const select = document.getElementById("storeCategory");
  if (!select) return;

  const { data, error } = await supabaseClient
    .from("store_categories")
    .select("id,name")
    .order("name");

  if (error) {
    console.error(error);
    select.innerHTML = '<option value="">Erreur de chargement</option>';
    return;
  }

  select.innerHTML = '<option value="">Choisir une catégorie</option>';

  (data || []).forEach(category => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.appendChild(option);
  });
}

// BOUTIQUES
async function loadStores() {
  const container = document.getElementById("storesList");
  if (!container) return;

  container.textContent = "Chargement des boutiques...";

  const { data, error } = await supabaseClient
    .from("stores")
    .select("id,name,slug,description,phone,whatsapp,address,city,logo_url,cover_url,is_open,is_published,delivery_available,merchant_code,category_id,store_categories(name)")
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "Erreur de chargement : " + error.message;
    return;
  }

  container.innerHTML = "";

  (data || []).forEach(store => {
    const card = document.createElement("div");
    card.className = "item-row";
    card.innerHTML = `
      <strong>${escapeHtml(store.name)}</strong>
      <div class="item-meta">
        Catégorie : ${escapeHtml(store.store_categories?.name || "-")}<br>
        Téléphone : ${escapeHtml(store.phone || "-")}<br>
        Adresse : ${escapeHtml(store.address || "-")}<br>
        Ville : ${escapeHtml(store.city || "-")}<br>
        Code marchand : ${escapeHtml(store.merchant_code || "Non attribué")}
      </div>
      <button onclick="editStore('${store.id}')">Modifier</button>
      <button onclick="resendMerchantCode('${store.id}')">Renvoyer le code WhatsApp</button>
      <button onclick="deleteStore('${store.id}', '${escapeAttribute(store.name)}')">Supprimer</button>
    `;
    container.appendChild(card);
  });

  await loadStoreSelectors(data || []);
  await loadStats();
}

async function loadStoreSelectors(stores) {
  ["mediaStore", "productStore"].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    const oldValue = select.value;
    select.innerHTML = '<option value="">Sélectionner une boutique</option>';

    stores.forEach(store => {
      const option = document.createElement("option");
      option.value = store.id;
      option.textContent = store.name;
      select.appendChild(option);
    });

    if (stores.some(store => store.id === oldValue)) select.value = oldValue;
  });
}

async function handleStoreSubmit(event) {
  event.preventDefault();

  const name = document.getElementById("storeName")?.value.trim();
  const category = document.getElementById("storeCategory")?.value;
  const phone = document.getElementById("storePhone")?.value.trim();

  if (!name || !category || !phone) {
    alert("Le nom, la catégorie et le téléphone sont obligatoires.");
    return;
  }

  const payload = {
    name,
    slug: createSlug(name),
    category_id: category,
    description: document.getElementById("storeDescription")?.value.trim(),
    phone,
    whatsapp: document.getElementById("storeWhatsapp")?.value.trim(),
    address: document.getElementById("storeAddress")?.value.trim(),
    logo_url: document.getElementById("storeLogo")?.value.trim() || null,
    cover_url: document.getElementById("storeCover")?.value.trim() || null,
    city: "Parakou",
    is_open: true,
    is_published: true,
    delivery_available: document.getElementById("storeDelivery")?.checked !== false
  };

  const result = currentStoreId
    ? await supabaseClient.from("stores").update(payload).eq("id", currentStoreId)
    : await supabaseClient.from("stores").insert(payload);

  if (result.error) {
    alert("Erreur : " + result.error.message);
    return;
  }

  alert("Boutique enregistrée.");
  currentStoreId = null;
  document.getElementById("storeForm")?.reset();
  await loadStores();
}

async function editStore(storeId) {
  const { data, error } = await supabaseClient
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();

  if (error) {
    alert("Impossible de charger la boutique : " + error.message);
    return;
  }

  currentStoreId = storeId;
  setValue("storeName", data.name);
  setValue("storeCategory", data.category_id);
  setValue("storeDescription", data.description);
  setValue("storePhone", data.phone);
  setValue("storeWhatsapp", data.whatsapp);
  setValue("storeAddress", data.address);
  setValue("storeLogo", data.logo_url);
  setValue("storeCover", data.cover_url);

  const delivery = document.getElementById("storeDelivery");
  if (delivery) delivery.checked = data.delivery_available !== false;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// PRODUITS
async function handleProductSubmit(event) {
  event.preventDefault();

  const storeId = document.getElementById("productStore")?.value;
  const name = document.getElementById("productName")?.value.trim();
  const price = Number(document.getElementById("productPrice")?.value || 0);

  if (!storeId || !name || price <= 0) {
    alert("La boutique, le nom et le prix sont obligatoires.");
    return;
  }

  const payload = {
    store_id: storeId,
    name,
    slug: createSlug(name) + "-" + Date.now(),
    description: document.getElementById("productDescription")?.value.trim(),
    price,
    image_url: document.getElementById("productImage")?.value.trim() || null,
    is_available: document.getElementById("productAvailable")?.checked !== false
  };

  const editingId = window.adminEditingProductId;
  const result = editingId
    ? await supabaseClient.from("products").update(payload).eq("id", editingId)
    : await supabaseClient.from("products").insert(payload);

  if (result.error) {
    alert("Impossible d'enregistrer le produit : " + result.error.message);
    return;
  }

  alert(editingId ? "Produit modifié." : "Produit ajouté.");
  window.adminEditingProductId = null;
  document.getElementById("productForm")?.reset();
  const button = document.querySelector("#productForm button[type='submit']");
  if (button) button.textContent = "Ajouter le produit";
  await loadProducts(storeId);
}

async function loadProducts(storeId) {
  const container = document.getElementById("productsList");
  if (!container || !storeId) return;

  container.textContent = "Chargement des produits...";

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "Erreur : " + error.message;
    return;
  }

  if (!data?.length) {
    container.textContent = "Aucun produit.";
    return;
  }

  container.innerHTML = "";

  data.forEach(product => {
    const item = document.createElement("div");
    item.className = "item-row";
    item.innerHTML = `
      <strong>${escapeHtml(product.name)}</strong>
      <div>${formatPrice(product.price)} — ${product.is_available ? "Disponible" : "Indisponible"}</div>
      ${product.image_url ? `<img src="${escapeAttribute(product.image_url)}" alt="" style="width:120px;border-radius:12px">` : ""}
      <div class="status-line">
        <button type="button" onclick="editAdminProduct('${product.id}')">Modifier</button>
        <button type="button" onclick="deleteAdminProduct('${product.id}', '${escapeAttribute(product.name)}')">Supprimer</button>
      </div>
    `;
    container.appendChild(item);
  });
}

// GALERIE
async function handleMediaUpload(event) {
  event.preventDefault();

  const storeId = document.getElementById("mediaStore")?.value;
  const mediaType = document.getElementById("mediaType")?.value;
  const title = document.getElementById("mediaTitle")?.value.trim();
  const file = document.getElementById("mediaFile")?.files?.[0];
  const isCover = document.getElementById("mediaCover")?.checked;
  const button = document.getElementById("uploadMediaButton");

  if (!storeId || !file) {
    alert("Sélectionne une boutique et un fichier.");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Envoi en cours...";
  }

  try {
    const extension = file.name.split(".").pop().toLowerCase();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const path = `${storeId}/${filename}`;

    const { error: uploadError } = await supabaseClient
      .storage.from("store-media")
      .upload(path, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabaseClient.storage.from("store-media").getPublicUrl(path);

    if (isCover) {
      const { error } = await supabaseClient
        .from("store_media")
        .update({ is_cover: false })
        .eq("store_id", storeId);
      if (error) throw error;
    }

    const { error: insertError } = await supabaseClient
      .from("store_media")
      .insert({
        store_id: storeId,
        media_type: mediaType === "image" ? "image" : "video",
        media_url: data.publicUrl,
        title: title || null,
        is_cover: isCover === true
      });

    if (insertError) throw insertError;

    if (isCover) {
      const { error } = await supabaseClient
        .from("stores")
        .update({ cover_url: data.publicUrl })
        .eq("id", storeId);
      if (error) throw error;
    }

    alert("Média ajouté avec succès.");
    document.getElementById("mediaForm")?.reset();
    await loadGallery(storeId);
  } catch (error) {
    console.error(error);
    alert("Erreur lors de l'envoi : " + error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "📤 Envoyer le média";
    }
  }
}

async function loadGallery(storeId) {
  const container = document.getElementById("mediaList");
  if (!container || !storeId) return;

  container.textContent = "Chargement...";

  const { data, error } = await supabaseClient
    .from("store_media")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "Erreur : " + error.message;
    return;
  }

  if (!data?.length) {
    container.textContent = "Aucun média.";
    return;
  }

  container.innerHTML = "";

  data.forEach(media => {
    const item = document.createElement("div");
    item.className = "media-item";

    item.innerHTML = media.media_type === "image"
      ? `<img src="${escapeAttribute(media.media_url)}" alt=""><div class="media-info">${escapeHtml(media.title || "Sans titre")}${media.is_cover ? "<div class='media-cover'>Couverture</div>" : ""}</div>`
      : `<video src="${escapeAttribute(media.media_url)}" controls></video><div class="media-info">${escapeHtml(media.title || "Vidéo")}</div>`;

    container.appendChild(item);
  });
}

// DEMANDES ANNONCEURS
async function loadAdvertiserApplications() {
  const container = document.getElementById("advertisersList");
  if (!container) return;

  container.textContent = "Chargement des demandes...";

  const { data, error } = await supabaseClient
    .from("advertiser_applications")
    .select("id,full_name,business_name,category,phone,whatsapp,city,address,description,goal,status,created_at,store_id,merchant_code")
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "Erreur : " + error.message;
    return;
  }

  if (!data?.length) {
    container.textContent = "Aucune demande pour le moment.";
    return;
  }

  container.innerHTML = "";

  data.forEach(application => {
    const card = document.createElement("div");
    card.className = "item-row";
    card.innerHTML = `
      <strong>${escapeHtml(application.business_name || "Entreprise sans nom")}</strong>
      <div class="item-meta">
        Nom : ${escapeHtml(application.full_name || "-")}<br>
        Téléphone : ${escapeHtml(application.phone || "-")}<br>
        Catégorie : ${escapeHtml(application.category || "-")}<br>
        Ville : ${escapeHtml(application.city || "-")}
      </div>
      ${application.description ? `<p>${escapeHtml(application.description)}</p>` : ""}
      ${application.merchant_code ? `<p>Code marchand : ${escapeHtml(application.merchant_code)}</p>` : ""}
      <select onchange="updateAdvertiserStatus('${application.id}', this.value)">
        ${advertiserStatusOptions(application.status)}
      </select>
      ${application.status === "pending" ? `<button onclick="approveAdvertiser('${application.id}')">Approuver</button>` : ""}
    `;
    container.appendChild(card);
  });
}

function advertiserStatusOptions(current) {
  const statuses = [
    ["pending", "En attente"],
    ["contacted", "Contacté"],
    ["approved", "Approuvé"],
    ["rejected", "Refusé"]
  ];

  return statuses.map(([value, label]) =>
    `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`
  ).join("");
}

function advertiserStatusLabel(status) {
  const labels = {
    pending: "En attente",
    contacted: "Contacté",
    approved: "Approuvé",
    rejected: "Refusé"
  };
  return labels[status] || status || "-";
}

async function updateAdvertiserStatus(applicationId, status) {
  const { error } = await supabaseClient
    .from("advertiser_applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (error) {
    alert("Impossible de modifier le statut : " + error.message);
    return;
  }

  await loadAdvertiserApplications();
}

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

async function approveAdvertiser(applicationId) {
  const application = await getApplication(applicationId);

  if (!application) {
    alert("Demande introuvable.");
    return;
  }

  if (!confirm(`Créer et publier la boutique "${application.business_name}" ?`)) return;

  const whatsappWindow = window.open("about:blank", "_blank");

  const { data: storeId, error } = await supabaseClient.rpc(
    "approve_advertiser_application",
    { p_application_id: applicationId }
  );

  if (error || !storeId) {
    if (whatsappWindow) whatsappWindow.close();
    alert("Impossible de créer la boutique : " + (error?.message || "Identifiant absent"));
    return;
  }

  const { data: store, error: storeError } = await supabaseClient
    .from("stores")
    .select("merchant_code")
    .eq("id", storeId)
    .single();

  await loadAdvertiserApplications();
  await loadStores();

  if (storeError || !store?.merchant_code) {
    if (whatsappWindow) whatsappWindow.close();
    alert("Boutique créée, mais impossible de récupérer le code marchand.");
    return;
  }

  let phone = String(application.whatsapp || application.phone || "").replace(/\D/g, "");
  if (phone && !phone.startsWith("229")) phone = "229" + phone;

  const message =
    `Bonjour ${application.business_name} ! 👋\n\n` +
    `Votre boutique a été approuvée et publiée sur PK ChapShop.\n\n` +
    `Code marchand : ${store.merchant_code}\n\n` +
    `Merci de votre confiance !\nL'équipe PK ChapShop`;

  if (phone) {
    const url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
    if (whatsappWindow) whatsappWindow.location.href = url;
    else window.open(url, "_blank");

    alert("Boutique créée. Vérifie le message WhatsApp puis appuie sur Envoyer.");
  } else {
    if (whatsappWindow) whatsappWindow.close();
    alert("Boutique créée. Aucun numéro WhatsApp disponible.");
  }
}

async function resendMerchantCode(storeId) {
  const { data: store, error } = await supabaseClient
    .from("stores")
    .select("name,phone,whatsapp,merchant_code")
    .eq("id", storeId)
    .single();

  if (error || !store) {
    alert("Impossible de récupérer les informations de la boutique.");
    return;
  }

  if (!store.merchant_code) {
    alert("Aucun code marchand attribué.");
    return;
  }

  let phone = String(store.whatsapp || store.phone || "").replace(/\D/g, "");
  if (phone && !phone.startsWith("229")) phone = "229" + phone;
  if (!phone) {
    alert("Aucun numéro de téléphone disponible.");
    return;
  }

  if (!confirm(`Renvoyer le code marchand de "${store.name}" sur WhatsApp ?`)) return;

  const message =
    `Bonjour ${store.name} !\n\n` +
    `Votre code marchand PK ChapShop : ${store.merchant_code}\n\n` +
    `Merci de votre confiance !`;

  window.open(
    "https://wa.me/" + phone + "?text=" + encodeURIComponent(message),
    "_blank"
  );
}

// SUPPRESSION / MODIFICATION
window.deleteStore = async function(storeId, storeName) {
  if (!confirm(`Supprimer la boutique "${storeName}" ?`)) return;

  const { data: products, error: productError } = await supabaseClient
    .from("products").select("id").eq("store_id", storeId).limit(1);

  if (productError) {
    alert(productError.message);
    return;
  }

  if (products?.length) {
    alert("Cette boutique contient encore des produits. Supprime-les d'abord.");
    return;
  }

  const { data: orders, error: orderError } = await supabaseClient
    .from("orders").select("id").eq("store_id", storeId).limit(1);

  if (orderError) {
    alert(orderError.message);
    return;
  }

  if (orders?.length) {
    alert("Cette boutique possède des commandes. Pour protéger l'historique, la suppression est bloquée.");
    return;
  }

  const { error } = await supabaseClient.from("stores").delete().eq("id", storeId);

  if (error) {
    alert("Suppression impossible : " + error.message);
    return;
  }

  alert("Boutique supprimée.");
  await loadStores();
};

window.editAdminProduct = async function(productId) {
  const { data, error } = await supabaseClient
    .from("products").select("*").eq("id", productId).single();

  if (error || !data) {
    alert("Impossible de charger le produit.");
    return;
  }

  setValue("productStore", data.store_id);
  setValue("productName", data.name);
  setValue("productDescription", data.description);
  setValue("productPrice", data.price);
  setValue("productImage", data.image_url);

  const available = document.getElementById("productAvailable");
  if (available) available.checked = data.is_available !== false;

  window.adminEditingProductId = data.id;

  const button = document.querySelector("#productForm button[type='submit']");
  if (button) button.textContent = "Enregistrer les modifications";

  document.getElementById("productForm")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
};

window.deleteAdminProduct = async function(productId, productName) {
  if (!confirm(`Supprimer définitivement le produit "${productName}" ?`)) return;

  const { error } = await supabaseClient
    .from("products").delete().eq("id", productId);

  if (error) {
    alert("Suppression impossible : " + error.message);
    return;
  }

  alert("Produit supprimé.");
  const storeId = document.getElementById("productStore")?.value;
  if (storeId) await loadProducts(storeId);
};

// UTILITAIRES
function formatPrice(price) {
  return Number(price || 0).toLocaleString("fr-FR") + " FCFA";
}

function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function createSlug(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value || "";
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
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

// FONCTIONS UTILISÉES PAR LE HTML
window.logout = logout;
window.updateOrderStatus = updateOrderStatus;
window.saveDelivery = saveDelivery;
window.editStore = editStore;
window.saveStore = handleStoreSubmit;
window.loadProducts = loadProducts;
window.loadGallery = loadGallery;
window.updateAdvertiserStatus = updateAdvertiserStatus;
window.approveAdvertiser = approveAdvertiser;
window.resendMerchantCode = resendMerchantCode;
window.loadAdvertiserApplications = loadAdvertiserApplications;
window.loadStores = loadStores;
