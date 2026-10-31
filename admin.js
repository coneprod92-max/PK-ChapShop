const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentStoreId = null;
let currentStoreCity = null;
let editingProductId = null;
let currentCommissionRate = 10;
let cachedStores = [];
let logoPreviewUrl = null;
let coverPreviewUrl = null;

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  $("loginForm")?.addEventListener("submit", handleLogin);
  $("logoutButton")?.addEventListener("click", logout);

  $("refreshOrders")?.addEventListener("click", loadOrders);
  $("refreshAdvertisers")?.addEventListener("click", loadAdvertiserApplications);
  $("refreshStores")?.addEventListener("click", loadStores);
  $("refreshFinance")?.addEventListener("click", loadFinance);
  $("refreshFeatured")?.addEventListener("click", loadFeatured);
  $("commissionSettingsForm")?.addEventListener("submit", saveCommissionRate);

  $("orderFilter")?.addEventListener("change", loadOrders);
  $("storeForm")?.addEventListener("submit", handleStoreSubmit);
  $("productForm")?.addEventListener("submit", handleProductSubmit);
  $("mediaForm")?.addEventListener("submit", handleMediaUpload);

  $("mediaStore")?.addEventListener("change", e => loadGallery(e.target.value));
  $("productStore")?.addEventListener("change", e => loadProducts(e.target.value));
  $("featuredProductStore")?.addEventListener("change", loadFeaturedProducts);

  $("cancelStoreEdit")?.addEventListener("click", resetStoreForm);
  $("cancelProductEdit")?.addEventListener("click", resetProductForm);

  ensureStoreBrandingControls();

  $("storesList")?.addEventListener("click", async event => {
    const button = event.target.closest("button[data-store-action]");
    if (!button) return;

    event.preventDefault();
    const id = button.dataset.storeId;
    if (!id) return alert("Identifiant de boutique introuvable.");

    if (button.dataset.storeAction === "edit") await editStore(id);
    if (button.dataset.storeAction === "whatsapp") await resendMerchantCode(id);
    if (button.dataset.storeAction === "delete") {
      await deleteStore(id, button.dataset.storeName || "cette boutique");
    }
  });

  $("featuredStoresList")?.addEventListener("click", async event => {
    const button = event.target.closest("[data-feature-store]");
    if (!button) return;
    await toggleFeatured("stores", button.dataset.featureStore, button.dataset.featureValue === "true");
  });

  $("featuredProductsList")?.addEventListener("click", async event => {
    const button = event.target.closest("[data-feature-product]");
    if (!button) return;
    await toggleFeatured("products", button.dataset.featureProduct, button.dataset.featureValue === "true");
  });

  showLogin();

  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;

    if (data?.session) {
      currentUser = data.session.user;
      await openAdmin();
    }
  } catch (error) {
    console.error(error);
    showLogin("Erreur d'initialisation : " + error.message);
  }
});

/* =========================
   CONNEXION ET AUTORISATIONS
========================= */

function showLogin(message = "") {
  $("loginSection")?.classList.remove("admin-hidden");
  $("dashboard")?.classList.add("admin-hidden");
  if ($("loginMessage")) {
    $("loginMessage").innerHTML = message
      ? `<div class="admin-error">${esc(message)}</div>`
      : "";
  }
}

function showDashboard() {
  $("loginSection")?.classList.add("admin-hidden");
  $("dashboard")?.classList.remove("admin-hidden");
}

async function handleLogin(event) {
  event.preventDefault();

  const button = document.querySelector('#loginForm button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.textContent = "Connexion...";
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: $("adminEmail").value.trim(),
      password: $("adminPassword").value
    });

    if (error) throw error;
    currentUser = data.user;
    await openAdmin();
  } catch (error) {
    showLogin("Échec de connexion : " + error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "🔐 Se connecter";
    }
  }
}

async function checkAdmin() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  if (!data?.session) return false;

  currentUser = data.session.user;

  const result = await supabaseClient.rpc("is_admin");
  if (result.error) throw result.error;
  return result.data === true;
}

async function openAdmin() {
  try {
    if (!await checkAdmin()) {
      await supabaseClient.auth.signOut();
      return showLogin("Ce compte n'a pas les droits administrateur.");
    }

    showDashboard();

    await Promise.allSettled([
      loadStats(),
      loadOrders(),
      loadCategories(),
      loadStores(),
      loadAdvertiserApplications(),
      loadCommissionSettings(),
      loadFinance(),
      loadFeatured()
    ]);
  } catch (error) {
    console.error(error);
    showLogin(error.message || "Impossible d'ouvrir le tableau de bord.");
  }
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) return alert(error.message);

  currentUser = null;
  showLogin("Vous êtes déconnecté.");
}

/* =========================
   STATISTIQUES
========================= */

async function loadStats() {
  try {
    const [all, pending, delivered, stores] = await Promise.all([
      supabaseClient.from("orders").select("id", { count: "exact", head: true }),
      supabaseClient.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseClient.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered"),
      supabaseClient.from("stores").select("id", { count: "exact", head: true })
    ]);

    [all, pending, delivered, stores].forEach(result => {
      if (result.error) throw result.error;
    });

    [["statOrders", all.count], ["statPending", pending.count],
      ["statDelivered", delivered.count], ["statStores", stores.count]]
      .forEach(([id, count]) => {
        if ($(id)) $(id).textContent = count || 0;
      });
  } catch (error) {
    console.error("Statistiques :", error);
  }
}

/* =========================
   COMMANDES ET LIVRAISONS
========================= */

async function loadOrders() {
  const box = $("ordersList");
  if (!box) return;

  box.textContent = "Chargement des commandes...";

  try {
    let query = supabaseClient.from("orders")
      .select("id,order_number,status,payment_method,payment_status,payment_confirmed_at,subtotal,delivery_fee,total,commission_rate_applied,delivery_address,customer_note,created_at,archived_at,customers(full_name,phone),stores(name),deliveries(driver_name,driver_phone,status,current_location,estimated_minutes)")
      .order("created_at", { ascending: false });

    const filter = $("orderFilter")?.value || "active";

    if (filter === "active") query = query.is("archived_at", null);
    else if (filter === "archived") query = query.not("archived_at", "is", null);
    else if (filter !== "all") query = query.eq("status", filter).is("archived_at", null);

    const { data, error } = await query;
    if (error) throw error;

    box.innerHTML = "";

    if (!data?.length) {
      box.textContent = "Aucune commande dans cette catégorie.";
      return;
    }

    data.forEach(order => {
      const customer = order.customers || {};
      const store = order.stores || {};
      const delivery = Array.isArray(order.deliveries)
        ? (order.deliveries[0] || {})
        : (order.deliveries || {});
      const archived = Boolean(order.archived_at);

      const paid = order.payment_status === "paid";
      const paymentLabel = paid ? "Paiement confirmé" :
        order.payment_status === "refunded" ? "Remboursé" : "Paiement en attente";

      const card = document.createElement("article");
      card.className = "item-row";

      card.innerHTML = `
        <div class="item-head">
          <strong>Commande #${esc(order.order_number || order.id)}</strong>
          <strong>${price(order.total)}</strong>
        </div>

        ${archived ? '<p class="admin-success">Commande archivée</p>' : ""}

        <div class="item-meta">
          Client : ${esc(customer.full_name || "-")}<br>
          Téléphone : ${esc(customer.phone || "-")}<br>
          Boutique : ${esc(store.name || "-")}<br>
          Adresse : ${esc(order.delivery_address || "-")}<br>
          Mode de paiement : ${esc(order.payment_method || "-")}<br>
          Statut du paiement :
          <strong>${esc(paymentLabel)}</strong><br>
          Sous-total produits : ${price(order.subtotal)}<br>
          Livraison : ${price(order.delivery_fee)}<br>
          Date : ${date(order.created_at)}
        </div>

        ${archived ? `Statut de commande : ${esc(order.status)}` : `
          <label>Statut de la commande</label>
          <select onchange="updateOrderStatus('${order.id}',this.value)">
            ${orderStatusOptions(order.status)}
          </select>

          <label>Confirmation du paiement</label>
          <select onchange="updatePaymentStatus('${order.id}',this.value)">
            <option value="pending" ${order.payment_status === "pending" ? "selected" : ""}>En attente / non reçu</option>
            <option value="paid" ${order.payment_status === "paid" ? "selected" : ""}>Paiement confirmé / reçu</option>
            <option value="refunded" ${order.payment_status === "refunded" ? "selected" : ""}>Remboursé</option>
          </select>

          <hr>
          <label>Nom du livreur</label>
          <input id="driverName-${order.id}" value="${attr(delivery.driver_name || "")}">

          <label>Téléphone du livreur</label>
          <input id="driverPhone-${order.id}" value="${attr(delivery.driver_phone || "")}">

          <label>Statut de livraison</label>
          <select id="deliveryStatus-${order.id}">
            ${deliveryStatusOptions(delivery.status || "pending")}
          </select>

          <label>Position ou note</label>
          <input id="deliveryLocation-${order.id}" value="${attr(delivery.current_location || "")}">

          <label>Délai estimé (minutes)</label>
          <input id="deliveryMinutes-${order.id}" type="number" min="0" max="10080" value="${delivery.estimated_minutes ?? ""}">

          <button type="button" onclick="saveDelivery('${order.id}')">Enregistrer la livraison</button>
        `}

        ${order.customer_note ? `<p>Note du client : ${esc(order.customer_note)}</p>` : ""}

        <div class="status-line" style="margin-top:12px">
          ${archived
            ? `<button class="gold" onclick="restoreOrder('${order.id}')">Restaurer</button>
               <button class="danger" onclick="deleteArchivedOrder('${order.id}','${attr(order.order_number || order.id)}')">Supprimer définitivement</button>`
            : order.status === "delivered"
              ? `<button class="gold" onclick="archiveOrder('${order.id}')">Archiver</button>`
              : ""}
        </div>
      `;

      box.appendChild(card);
    });
  } catch (error) {
    console.error(error);
    box.textContent = "Erreur de chargement : " + error.message;
  }
}

function orderStatusOptions(value) {
  return [
    ["pending", "En attente"],
    ["confirmed", "Confirmée"],
    ["preparing", "En préparation"],
    ["ready", "Prête"],
    ["out_for_delivery", "En livraison"],
    ["delivered", "Livrée"],
    ["cancelled", "Annulée"]
  ].map(([key, label]) =>
    `<option value="${key}" ${value === key ? "selected" : ""}>${label}</option>`
  ).join("");
}

function deliveryStatusOptions(value) {
  return [
    ["pending", "À attribuer"],
    ["assigned", "Livreur attribué"],
    ["picked_up", "Commande récupérée"],
    ["in_transit", "En route"],
    ["delivered", "Livrée"],
    ["failed", "Échec de livraison"]
  ].map(([key, label]) =>
    `<option value="${key}" ${value === key ? "selected" : ""}>${label}</option>`
  ).join("");
}

async function updateOrderStatus(id, status) {
  const { error } = await supabaseClient.from("orders").update({
    status,
    updated_at: new Date().toISOString()
  }).eq("id", id);

  if (error) return alert("Modification impossible : " + error.message);
  await Promise.all([loadOrders(), loadStats(), loadFinance()]);
}

async function updatePaymentStatus(id, status) {
  if (!["pending", "paid", "refunded"].includes(status)) {
    return alert("Statut de paiement invalide.");
  }

  const payload = {
    payment_status: status,
    payment_confirmed_at: status === "paid" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient.from("orders").update(payload).eq("id", id);
  if (error) return alert("Impossible de mettre à jour le paiement : " + error.message);

  alert(status === "paid"
    ? "Paiement marqué comme confirmé. Vérifie que l'argent a bien été reçu."
    : status === "refunded"
      ? "Commande marquée comme remboursée."
      : "Paiement marqué comme en attente.");

  await Promise.all([loadOrders(), loadFinance()]);
}

async function archiveOrder(id) {
  if (!confirm("Archiver cette commande livrée ?")) return;

  const { error } = await supabaseClient.from("orders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id).eq("status", "delivered").is("archived_at", null);

  if (error) return alert("Archivage impossible : " + error.message);
  await Promise.all([loadOrders(), loadStats()]);
}

async function restoreOrder(id) {
  if (!confirm("Restaurer cette commande ?")) return;

  const { error } = await supabaseClient.from("orders")
    .update({ archived_at: null }).eq("id", id).not("archived_at", "is", null);

  if (error) return alert("Restauration impossible : " + error.message);
  await Promise.all([loadOrders(), loadStats()]);
}

async function deleteArchivedOrder(id, number) {
  if (!confirm(`Supprimer définitivement la commande ${number} ? Cette action est irréversible.`)) return;
  if (prompt("Écris SUPPRIMER pour confirmer.") !== "SUPPRIMER") return;

  const { data, error } = await supabaseClient.from("orders")
    .delete().eq("id", id).not("archived_at", "is", null).select("id");

  if (error) return alert("Suppression impossible : " + error.message);
  if (!data?.length) return alert("Aucune commande supprimée. Vérifie les droits.");
  await Promise.all([loadOrders(), loadStats(), loadFinance()]);
}

async function saveDelivery(id) {
  const field = name => $(`${name}-${id}`);
  const raw = field("deliveryMinutes")?.value.trim() || "";
  const minutes = raw === "" ? null : Number(raw);

  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080)) {
    return alert("Le délai doit être un entier entre 0 et 10080 minutes.");
  }

  const { error } = await supabaseClient.rpc("admin_update_delivery", {
    p_order_id: id,
    p_driver_name: field("driverName")?.value.trim() || null,
    p_driver_phone: field("driverPhone")?.value.trim() || null,
    p_status: field("deliveryStatus")?.value || "pending",
    p_current_location: field("deliveryLocation")?.value.trim() || null,
    p_estimated_minutes: minutes
  });

  if (error) return alert("Impossible d'enregistrer la livraison : " + error.message);
  alert("Livraison enregistrée.");
  await loadOrders();
}

/* =========================
   REVENUS ET COMMISSIONS
========================= */

async function loadCommissionSettings() {
  const message = $("commissionSettingsMessage");

  try {
    const { data, error } = await supabaseClient
      .from("commission_settings")
      .select("commission_rate")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    currentCommissionRate = Number(data?.commission_rate ?? 10);
    if ($("commissionRate")) $("commissionRate").value = currentCommissionRate;
    if (message) message.innerHTML = "";
  } catch (error) {
    console.error("Paramètres de commission :", error);
    if (message) {
      message.innerHTML = `<div class="admin-error">Impossible de lire le taux : ${esc(error.message)}</div>`;
    }
  }
}

async function saveCommissionRate(event) {
  event.preventDefault();

  const input = $("commissionRate");
  const message = $("commissionSettingsMessage");
  const rate = Number(input?.value);

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    if (message) message.innerHTML = '<div class="admin-error">Le taux doit être compris entre 0 et 100 %.</div>';
    return;
  }

  try {
    const payload = {
      id: 1,
      commission_rate: rate,
      updated_at: new Date().toISOString(),
      updated_by: currentUser?.id || null
    };

    const { error } = await supabaseClient.from("commission_settings")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;

    currentCommissionRate = rate;
    if (message) {
      message.innerHTML = `<div class="admin-success">Taux enregistré : ${rate} %. Les commissions du tableau sont recalculées avec ce taux.</div>`;
    }

    await loadFinance();
  } catch (error) {
    console.error(error);
    if (message) {
      message.innerHTML = `<div class="admin-error">Enregistrement impossible : ${esc(error.message)}</div>`;
    }
  }
}

async function loadFinance() {
  const list = $("financeList");
  const message = $("financeMessage");
  if (!list) return;

  list.textContent = "Chargement des données financières...";
  if (message) message.innerHTML = "";

  try {
    await loadCommissionSettings();

    const { data: orders, error } = await supabaseClient
      .from("orders")
      .select("id,order_number,status,payment_status,subtotal,delivery_fee,total,commission_rate_applied,created_at,stores(name)")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (error) throw error;

    let salesTotal = 0;
    let commissionTotal = 0;
    let commissionPaid = 0;
    let commissionPending = 0;
    let deliveryExcluded = 0;
    let saleCount = 0;

    const rows = [];

    (orders || []).forEach(order => {
      const subtotal = Number(order.subtotal || 0);
      const delivery = Number(order.delivery_fee || 0);
      const rate = Number(order.commission_rate_applied ?? currentCommissionRate);
      const commission = subtotal * rate / 100;
      const paid = order.payment_status === "paid";
      const refunded = order.payment_status === "refunded";
      const completed = ["delivered"].includes(order.status);

      if (completed && !refunded) {
        salesTotal += subtotal;
        commissionTotal += commission;
        saleCount += 1;

        if (paid) commissionPaid += commission;
        else commissionPending += commission;

        deliveryExcluded += delivery;
      }

      rows.push({
        number: order.order_number || order.id,
        store: order.stores?.name || "Boutique",
        status: order.status,
        payment: order.payment_status || "pending",
        subtotal,
        delivery,
        rate,
        commission,
        created: order.created_at,
        completed,
        refunded
      });
    });

    if ($("financeSalesTotal")) $("financeSalesTotal").textContent = price(salesTotal);
    if ($("financeCommissionTotal")) $("financeCommissionTotal").textContent = price(commissionTotal);
    if ($("financeCommissionPaid")) $("financeCommissionPaid").textContent = price(commissionPaid);
    if ($("financeCommissionPending")) $("financeCommissionPending").textContent = price(commissionPending);
    if ($("financeSalesCount")) $("financeSalesCount").textContent = String(saleCount);
    if ($("financeDeliveryExcluded")) $("financeDeliveryExcluded").textContent = price(deliveryExcluded);

    if (!rows.length) {
      list.textContent = "Aucune commande enregistrée.";
      return;
    }

    list.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Commande / date</th>
            <th>Boutique</th>
            <th>Statut</th>
            <th>Produits</th>
            <th>Commission</th>
            <th>Paiement</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>#${esc(row.number)}<br>${date(row.created)}</td>
              <td>${esc(row.store)}</td>
              <td>${esc(statusLabelOrder(row.status))}</td>
              <td>${price(row.subtotal)}<br><small>Livraison exclue : ${price(row.delivery)}</small></td>
              <td>${price(row.commission)}<br><small>Taux : ${row.rate}%</small></td>
              <td>
                <span class="status-pill ${row.payment === "paid" ? "paid" : "pending"}">
                  ${row.payment === "paid" ? "Confirmé" : row.payment === "refunded" ? "Remboursé" : "En attente"}
                </span>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p><small>Les totaux de commissions ci-dessus concernent les commandes livrées et non remboursées. Le statut « paiement confirmé » correspond au suivi manuel effectué dans l'administration.</small></p>
    `;
  } catch (error) {
    console.error("Calcul des commissions :", error);
    list.textContent = "Erreur de chargement des données financières : " + error.message;
    if (message) {
      message.innerHTML = '<div class="admin-error">Vérifie les autorisations de lecture de la table orders et de la table commission_settings dans Supabase.</div>';
    }
  }
}

function statusLabelOrder(status) {
  return ({
    pending: "En attente",
    confirmed: "Confirmée",
    preparing: "En préparation",
    ready: "Prête",
    out_for_delivery: "En livraison",
    delivered: "Livrée",
    cancelled: "Annulée"
  })[status] || status || "-";
}

/* =========================
   MISE EN AVANT
========================= */

async function loadFeatured() {
  const storesBox = $("featuredStoresList");
  if (storesBox) storesBox.textContent = "Chargement des boutiques...";

  try {
    const { data, error } = await supabaseClient.from("stores")
      .select("id,name,city,is_published,is_featured,featured_until")
      .order("name", { ascending: true });

    if (error) throw error;

    if (storesBox) {
      storesBox.innerHTML = "";

      if (!data?.length) {
        storesBox.textContent = "Aucune boutique.";
      } else {
        data.forEach(store => {
          const expired = store.featured_until && new Date(store.featured_until) < new Date();
          const active = store.is_featured && !expired;

          const card = document.createElement("article");
          card.className = "item-row";
          card.innerHTML = `
            <strong>${esc(store.name)}</strong>
            <div class="item-meta">
              ${esc(store.city || "-")}<br>
              Publication : ${store.is_published ? "Publiée" : "Non publiée"}<br>
              Mise en avant : ${active ? "Active" : "Inactive"}
              ${expired ? "<br>La date de mise en avant est dépassée." : ""}
            </div>
            <button type="button"
              data-feature-store="${attr(store.id)}"
              data-feature-value="${active ? "true" : "false"}"
              ${!store.is_published ? "disabled" : ""}>
              ${active ? "Retirer de la une" : "⭐ Mettre à la une"}
            </button>
          `;
          storesBox.appendChild(card);
        });
      }
    }

    cachedStores = data || [];
    fillFeaturedStoreSelector(cachedStores);
    await loadFeaturedProducts();
  } catch (error) {
    console.error("Mise en avant :", error);
    if (storesBox) {
      storesBox.innerHTML = `<div class="admin-error">Impossible de charger les boutiques : ${esc(error.message)}</div>`;
    }
  }
}

function fillFeaturedStoreSelector(stores) {
  const select = $("featuredProductStore");
  if (!select) return;

  const previous = select.value;
  select.innerHTML = '<option value="">Toutes les boutiques</option>';

  stores.forEach(store => {
    const option = document.createElement("option");
    option.value = store.id;
    option.textContent = store.name;
    select.appendChild(option);
  });

  if (stores.some(store => store.id === previous)) select.value = previous;
}

async function loadFeaturedProducts() {
  const box = $("featuredProductsList");
  if (!box) return;

  box.textContent = "Chargement des produits...";

  try {
    let query = supabaseClient.from("products")
      .select("id,store_id,name,price,is_available,is_featured,featured_until,stores(name)")
      .order("name", { ascending: true });

    const storeId = $("featuredProductStore")?.value;
    if (storeId) query = query.eq("store_id", storeId);

    const { data, error } = await query;
    if (error) throw error;

    box.innerHTML = "";

    if (!data?.length) {
      box.textContent = "Aucun produit trouvé.";
      return;
    }

    data.forEach(product => {
      const expired = product.featured_until && new Date(product.featured_until) < new Date();
      const active = product.is_featured && !expired;
      const card = document.createElement("article");
      card.className = "item-row";

      card.innerHTML = `
        <strong>${esc(product.name)}</strong>
        <div class="item-meta">
          Boutique : ${esc(product.stores?.name || "-")}<br>
          Prix : ${price(product.price)}<br>
          Disponibilité : ${product.is_available ? "Disponible" : "Indisponible"}<br>
          Mise en avant : ${active ? "Active" : "Inactive"}
        </div>
        <button type="button"
          data-feature-product="${attr(product.id)}"
          data-feature-value="${active ? "true" : "false"}"
          ${!product.is_available ? "disabled" : ""}>
          ${active ? "Retirer de la une" : "⭐ Mettre à la une"}
        </button>
      `;

      box.appendChild(card);
    });
  } catch (error) {
    console.error("Produits à la une :", error);
    box.innerHTML = `<div class="admin-error">Impossible de charger les produits : ${esc(error.message)}</div>`;
  }
}

async function toggleFeatured(table, id, currentlyActive) {
  if (!["stores", "products"].includes(table)) return;

  const enable = !currentlyActive;
  const message = enable
    ? "Mettre cet élément à la une sur le site public ?"
    : "Retirer cet élément de la une ?";

  if (!confirm(message)) return;

  const { data, error } = await supabaseClient.from(table)
    .update({
      is_featured: enable,
      featured_until: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(error);
    return alert("Impossible de modifier la mise en avant : " + error.message);
  }

  if (!data) {
    return alert("Aucune modification enregistrée. Vérifie les droits administrateur dans Supabase.");
  }

  if ($("featuredMessage")) {
    $("featuredMessage").innerHTML = `<div class="admin-success">${enable ? "Élément mis à la une." : "Élément retiré de la une."}</div>`;
  }

  await loadFeatured();
  await loadStores();
}

/* =========================
   LOGO ET COUVERTURE
========================= */

function ensureStoreBrandingControls() {
  const form = $("storeForm");
  if (!form || $("storeBrandingControls")) return;

  const logoUrlField = $("storeLogo");
  const coverUrlField = $("storeCover");

  if (logoUrlField) logoUrlField.type = "hidden";
  if (coverUrlField) coverUrlField.type = "hidden";

  form.querySelector('label[for="storeLogo"]')?.classList.add("admin-hidden");
  form.querySelector('label[for="storeCover"]')?.classList.add("admin-hidden");

  const panel = document.createElement("section");
  panel.id = "storeBrandingControls";
  panel.className = "item-row";
  panel.style.marginTop = "16px";

  panel.innerHTML = `
    <h3>Logo et couverture de la boutique</h3>
    <p>Choisis les images directement depuis la galerie de ton téléphone. Formats image acceptés, 12 Mo maximum par fichier.</p>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px">
      <div>
        <label for="storeLogoFile">Logo de la boutique</label>
        <input id="storeLogoFile" type="file" accept="image/*">
        <img id="storeLogoPreview" alt="Aperçu du logo" hidden
          style="display:none;width:140px;height:140px;object-fit:contain;margin-top:10px;border-radius:10px;background:#f3f3f3">
      </div>

      <div>
        <label for="storeCoverFile">Photo de couverture</label>
        <input id="storeCoverFile" type="file" accept="image/*">
        <img id="storeCoverPreview" alt="Aperçu de la couverture" hidden
          style="display:none;width:100%;max-width:320px;height:160px;object-fit:cover;margin-top:10px;border-radius:10px;background:#f3f3f3">
      </div>
    </div>
    <p id="storeBrandingStatus" role="status"></p>
  `;

  const submit = form.querySelector('button[type="submit"]');
const actions = submit?.closest(".status-line");

if (actions && actions.parentElement === form) {
  form.insertBefore(panel, actions);
} else {
  form.appendChild(panel);
}
  $("storeLogoFile")?.addEventListener("change", () => {
    previewBrandingFile("logo");
  });

  $("storeCoverFile")?.addEventListener("change", () => {
    previewBrandingFile("cover");
  });
}

function previewBrandingFile(type) {
  const input = $(type === "logo" ? "storeLogoFile" : "storeCoverFile");
  const preview = $(type === "logo" ? "storeLogoPreview" : "storeCoverPreview");
  const file = input?.files?.[0];

  if (!preview) return;

  if (type === "logo") {
    revokePreviewUrl(logoPreviewUrl);
    logoPreviewUrl = null;
  } else {
    revokePreviewUrl(coverPreviewUrl);
    coverPreviewUrl = null;
  }

  if (!file) {
    const existingUrl = $(type === "logo" ? "storeLogo" : "storeCover")?.value;
    setPreviewImage(preview, existingUrl || "");
    return;
  }

  if (!file.type.startsWith("image/")) {
    input.value = "";
    setPreviewImage(preview, "");
    return alert("Choisis un fichier image.");
  }

  if (file.size > 12 * 1024 * 1024) {
    input.value = "";
    setPreviewImage(preview, "");
    return alert("L'image dépasse la limite de 12 Mo.");
  }

  const url = URL.createObjectURL(file);

  if (type === "logo") logoPreviewUrl = url;
  else coverPreviewUrl = url;

  setPreviewImage(preview, url);
}

function setPreviewImage(preview, url) {
  if (!preview) return;

  if (!url) {
    preview.removeAttribute("src");
    preview.hidden = true;
    preview.style.display = "none";
    return;
  }

  preview.src = url;
  preview.hidden = false;
  preview.style.display = "block";
}

function revokePreviewUrl(url) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

function clearBrandingPreviews() {
  revokePreviewUrl(logoPreviewUrl);
  revokePreviewUrl(coverPreviewUrl);
  logoPreviewUrl = null;
  coverPreviewUrl = null;

  setPreviewImage($("storeLogoPreview"), "");
  setPreviewImage($("storeCoverPreview"), "");

  if ($("storeLogoFile")) $("storeLogoFile").value = "";
  if ($("storeCoverFile")) $("storeCoverFile").value = "";
  if ($("storeBrandingStatus")) $("storeBrandingStatus").textContent = "";
}

function validateBrandingFiles() {
  const files = [
    { input: $("storeLogoFile"), label: "logo" },
    { input: $("storeCoverFile"), label: "couverture" }
  ];

  for (const item of files) {
    const file = item.input?.files?.[0];
    if (!file) continue;

    if (!file.type.startsWith("image/")) {
      alert(`Le fichier choisi pour le ${item.label} n'est pas une image.`);
      return false;
    }

    if (file.size > 12 * 1024 * 1024) {
      alert(`Le fichier du ${item.label} dépasse la limite de 12 Mo.`);
      return false;
    }
  }

  return true;
}

async function uploadStoreBranding(storeId) {
  const logoFile = $("storeLogoFile")?.files?.[0] || null;
  const coverFile = $("storeCoverFile")?.files?.[0] || null;

  const updates = {};

  if (logoFile) {
    updates.logo_url = await uploadBrandingFile(storeId, logoFile, "logo");
  }

  if (coverFile) {
    updates.cover_url = await uploadBrandingFile(storeId, coverFile, "cover");
  }

  if (Object.keys(updates).length) {
    const { error } = await supabaseClient.from("stores")
      .update(updates)
      .eq("id", storeId);

    if (error) throw error;

    if (updates.logo_url) set("storeLogo", updates.logo_url);
    if (updates.cover_url) set("storeCover", updates.cover_url);
  }

  return updates;
}

async function uploadBrandingFile(storeId, file, type) {
  const ext = (file.name.split(".").pop() || "jpg")
    .toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";

  const path = `${storeId}/branding/${type}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabaseClient.storage.from("store-media")
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600"
    });

  if (error) throw error;

  const { data } = supabaseClient.storage.from("store-media").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error(`Impossible de récupérer l'URL du ${type}.`);

  return data.publicUrl;
}

/* =========================
   GALERIE MÉDIAS DE L'ÉDITION BOUTIQUE
========================= */

function initStoreMediaEditor() {
  const form = $("storeForm");
  if (!form || $("storeMediaEditor")) return;

  const panel = document.createElement("section");
  panel.id = "storeMediaEditor";
  panel.className = "item-row";
  panel.hidden = true;
  panel.style.marginTop = "16px";

  panel.innerHTML = `
    <h3>Photos et vidéos de cette boutique</h3>
    <p>Enregistre d'abord les informations de la boutique, puis ajoute ici ses photos ou vidéos.</p>
    <label for="storeMediaFiles">Choisir des photos ou vidéos</label>
    <input id="storeMediaFiles" type="file" accept="image/*,video/*" multiple>
    <label for="storeMediaTitle">Titre (facultatif)</label>
    <input id="storeMediaTitle" type="text" maxlength="120" placeholder="Ex. Notre boutique, nos produits…">
    <label style="display:flex;gap:8px;align-items:center;margin:10px 0">
      <input id="storeMediaCover" type="checkbox" style="width:auto">
      Utiliser la première photo comme couverture de la boutique
    </label>
    <button type="button" id="storeMediaUploadButton">📤 Ajouter les fichiers sélectionnés</button>
    <div id="storeMediaEditorStatus" role="status" style="margin-top:10px"></div>
    <div id="storeMediaEditorGallery" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-top:12px"></div>
  `;

  form.insertAdjacentElement("afterend", panel);
  $("storeMediaUploadButton")?.addEventListener("click", uploadEditedStoreMedia);
}

async function loadEditedStoreMedia(storeId) {
  const gallery = $("storeMediaEditorGallery");
  const status = $("storeMediaEditorStatus");
  if (!gallery || !storeId) return;

  gallery.textContent = "Chargement des médias...";

  try {
    const { data, error } = await supabaseClient.from("store_media")
      .select("id,media_type,media_url,title,is_cover,created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    gallery.innerHTML = "";

    if (!data?.length) {
      gallery.textContent = "Aucune photo ou vidéo enregistrée pour cette boutique.";
      return;
    }

    data.forEach(media => {
      const card = document.createElement("div");
      card.className = "media-item";

      const element = media.media_type === "video"
        ? document.createElement("video")
        : document.createElement("img");

      element.src = media.media_url;

      if (media.media_type === "video") {
        element.controls = true;
        element.preload = "metadata";
      } else {
        element.loading = "lazy";
        element.alt = media.title || "Photo de la boutique";
      }

      element.style.width = "100%";
      element.style.maxHeight = "150px";
      element.style.objectFit = "cover";
      element.style.borderRadius = "8px";

      const caption = document.createElement("div");
      caption.className = "media-info";
      caption.textContent =
        (media.title || (media.media_type === "video" ? "Vidéo" : "Photo")) +
        (media.is_cover ? " — Couverture" : "");

      card.append(element, caption);
      gallery.appendChild(card);
    });

    if (status) status.textContent = `${data.length} média(s) dans la galerie.`;
  } catch (error) {
    console.error(error);
    gallery.textContent = "Impossible de charger les médias : " + error.message;
  }
}

async function uploadEditedStoreMedia() {
  const storeId = currentStoreId;
  const files = Array.from($("storeMediaFiles")?.files || []);
  const button = $("storeMediaUploadButton");
  const status = $("storeMediaEditorStatus");

  if (!storeId) return alert("Clique d'abord sur Modifier pour charger une boutique existante.");
  if (!files.length) return alert("Choisis au moins une photo ou une vidéo.");

  for (const file of files) {
    if (file.type.startsWith("image/") && file.size > 12 * 1024 * 1024) {
      return alert(`La photo « ${file.name} » dépasse la limite de 12 Mo.`);
    }
    if (file.type.startsWith("video/") && file.size > 100 * 1024 * 1024) {
      return alert(`La vidéo « ${file.name} » dépasse la limite de 100 Mo.`);
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return alert(`Format non accepté : ${file.name}`);
    }
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Envoi en cours...";
  }

  if (status) status.textContent = "Envoi des fichiers... Ne ferme pas cette page.";

  let uploaded = 0;

  try {
    const title = $("storeMediaTitle")?.value.trim() || "";
    let coverPending = Boolean($("storeMediaCover")?.checked);

    for (const file of files) {
      const type = file.type.startsWith("video/") ? "video" : "image";
      const ext = (file.name.split(".").pop() || "bin")
        .toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabaseClient.storage.from("store-media")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseClient.storage.from("store-media").getPublicUrl(path);
      const makeCover = coverPending && type === "image";

      if (makeCover) {
        const { error } = await supabaseClient.from("store_media")
          .update({ is_cover: false }).eq("store_id", storeId);
        if (error) throw error;
      }

      const { error: insertError } = await supabaseClient.from("store_media").insert({
        store_id: storeId,
        media_type: type,
        media_url: publicData.publicUrl,
        title: title || file.name,
        is_cover: makeCover
      });

      if (insertError) throw insertError;

      if (makeCover) {
        const { error } = await supabaseClient.from("stores")
          .update({ cover_url: publicData.publicUrl }).eq("id", storeId);
        if (error) throw error;

        set("storeCover", publicData.publicUrl);
        coverPending = false;
      }

      uploaded++;
    }

    if ($("storeMediaFiles")) $("storeMediaFiles").value = "";
    if (status) status.textContent = `${uploaded} fichier(s) ajouté(s) avec succès.`;

    await loadEditedStoreMedia(storeId);
    await loadStores();
    alert(`${uploaded} fichier(s) ajouté(s) à la galerie de la boutique.`);
  } catch (error) {
    console.error(error);
    if (status) status.textContent = "Erreur : " + error.message;
    alert("Impossible d'ajouter les médias : " + error.message);
    if (uploaded) await loadEditedStoreMedia(storeId);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "📤 Ajouter les fichiers sélectionnés";
    }
  }
}

/* =========================
   CATÉGORIES ET BOUTIQUES
========================= */

async function loadCategories() {
  const select = $("storeCategory");
  if (!select) return;

  const { data, error } = await supabaseClient.from("store_categories")
    .select("id,name").order("name");

  if (error) {
    select.innerHTML = '<option value="">Erreur de chargement</option>';
    console.error(error);
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

async function loadStores() {
  const box = $("storesList");
  if (!box) return;

  box.textContent = "Chargement des boutiques...";

  try {
    const { data, error } = await supabaseClient.from("stores")
      .select("id,name,slug,description,phone,whatsapp,address,city,logo_url,cover_url,is_open,is_published,delivery_available,merchant_code,category_id,is_featured,featured_until,store_categories(name)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    cachedStores = data || [];
    box.innerHTML = "";

    if (!data?.length) box.textContent = "Aucune boutique enregistrée.";

    (data || []).forEach(store => {
      const card = document.createElement("article");
      card.className = "item-row";

      const title = document.createElement("strong");
      title.textContent = store.name || "Boutique sans nom";

      const details = document.createElement("div");
      details.className = "item-meta";
      details.innerHTML = `
        Catégorie : ${esc(store.store_categories?.name || "-")}<br>
        Téléphone : ${esc(store.phone || "-")}<br>
        Adresse : ${esc(store.address || "-")}<br>
        Ville : ${esc(store.city || "-")}<br>
        Code marchand : ${esc(store.merchant_code || "Non attribué")}<br>
        Publication : ${store.is_published ? "Publiée" : "Non publiée"}<br>
        Mise en avant : ${store.is_featured ? "Oui" : "Non"}
      `;

      const actions = document.createElement("div");
      actions.className = "status-line";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.dataset.storeAction = "edit";
      edit.dataset.storeId = store.id;
      edit.textContent = "Modifier";

      const whatsapp = document.createElement("button");
      whatsapp.type = "button";
      whatsapp.dataset.storeAction = "whatsapp";
      whatsapp.dataset.storeId = store.id;
      whatsapp.textContent = "Envoyer le code par WhatsApp";

      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.dataset.storeAction = "delete";
      del.dataset.storeId = store.id;
      del.dataset.storeName = store.name || "cette boutique";
      del.textContent = "Supprimer";

      actions.append(edit, whatsapp, del);
      card.append(title, details, actions);
      box.appendChild(card);
    });

    await loadStoreSelectors(data || []);
    await loadStats();
  } catch (error) {
    console.error("Chargement des boutiques :", error);
    box.textContent = "Erreur de chargement : " + error.message;
  }
}

async function loadStoreSelectors(stores) {
  ["mediaStore", "productStore"].forEach(id => {
    const select = $(id);
    if (!select) return;

    const previous = select.value;
    select.innerHTML = '<option value="">Choisir une boutique</option>';

    stores.forEach(store => {
      const option = document.createElement("option");
      option.value = store.id;
      option.textContent = store.name;
      select.appendChild(option);
    });

    if (stores.some(store => store.id === previous)) select.value = previous;
  });

  fillFeaturedStoreSelector(stores);
}

async function handleStoreSubmit(event) {
  event.preventDefault();

  const form = $("storeForm");
  const button = form?.querySelector('button[type="submit"]');
  const name = $("storeName")?.value.trim() || "";
  const category = $("storeCategory")?.value || "";
  const phone = $("storePhone")?.value.trim() || "";

  if (!name || !category || !phone) {
    return alert("Le nom, la catégorie et le téléphone sont obligatoires.");
  }

  if (!validateBrandingFiles()) return;

  const editing = Boolean(currentStoreId);

  const payload = {
    name,
    slug: createSlug(name),
    category_id: category,
    description: $("storeDescription")?.value.trim() || null,
    phone,
    whatsapp: $("storeWhatsapp")?.value.trim() || null,
    address: $("storeAddress")?.value.trim() || null,
    logo_url: $("storeLogo")?.value.trim() || null,
    cover_url: $("storeCover")?.value.trim() || null,
    city: editing ? (currentStoreCity || "Parakou") : "Parakou",
    is_open: true,
    is_published: true,
    delivery_available: Boolean($("storeDelivery")?.checked)
  };

  if (button) {
    button.disabled = true;
    button.textContent = editing ? "Enregistrement des modifications..." : "Création de la boutique...";
  }

  const status = $("storeBrandingStatus");
  if (status) status.textContent = "";

  try {
    let storeId = currentStoreId;

    if (editing) {
      const result = await supabaseClient.from("stores")
        .update(payload)
        .eq("id", currentStoreId)
        .select("id")
        .maybeSingle();

      if (result.error) throw result.error;
      if (!result.data) {
        throw new Error("Aucune boutique modifiée. Vérifie les droits administrateur dans Supabase.");
      }
    } else {
      const result = await supabaseClient.from("stores")
        .insert(payload)
        .select("id")
        .single();

      if (result.error) throw result.error;
      storeId = result.data.id;
      currentStoreId = storeId;
      currentStoreCity = payload.city;
    }

    try {
      const uploaded = await uploadStoreBranding(storeId);

      if (Object.keys(uploaded).length) {
        if (status) status.textContent = "Images envoyées avec succès.";
      }

      alert(editing
        ? "Boutique et informations enregistrées avec succès."
        : "Boutique créée avec succès.");

      resetStoreForm();
      await Promise.all([loadStores(), loadFeatured()]);
    } catch (uploadError) {
      console.error(uploadError);

      if (!editing) {
        if (status) {
          status.textContent = "La boutique a été créée, mais l'envoi des images a échoué. Tu peux réessayer sans créer une nouvelle boutique.";
        }

        const submit = form?.querySelector('button[type="submit"]');
        if (submit) submit.textContent = "💾 Réessayer l'enregistrement";
      }

      alert(
        (editing
          ? "Les informations de la boutique ont été enregistrées, mais l'envoi des images a échoué : "
          : "La boutique a été créée, mais l'envoi des images a échoué : ") +
        uploadError.message
      );

      await Promise.all([loadStores(), loadFeatured()]);
    }
  } catch (error) {
    console.error(error);
    alert("Enregistrement impossible : " + error.message);
  } finally {
    if (button) {
      button.disabled = false;
      if (currentStoreId) {
        button.textContent = "💾 Enregistrer les modifications";
      } else {
        button.textContent = "💾 Enregistrer la boutique";
      }
    }
  }
}

async function editStore(id) {
  try {
    const { data, error } = await supabaseClient.from("stores").select("*").eq("id", id).single();
    if (error) throw error;
    if (!data) throw new Error("Boutique introuvable.");

    currentStoreId = data.id;
    currentStoreCity = data.city || null;

    set("storeName", data.name);
    set("storeCategory", data.category_id);
    set("storeDescription", data.description);
    set("storePhone", data.phone);
    set("storeWhatsapp", data.whatsapp);
    set("storeAddress", data.address);
    set("storeLogo", data.logo_url);
    set("storeCover", data.cover_url);

    if ($("storeDelivery")) $("storeDelivery").checked = data.delivery_available !== false;

    clearBrandingPreviews();
    setPreviewImage($("storeLogoPreview"), data.logo_url || "");
    setPreviewImage($("storeCoverPreview"), data.cover_url || "");

    initStoreMediaEditor();

    const panel = $("storeMediaEditor");
    if (panel) {
      panel.hidden = false;
      await loadEditedStoreMedia(id);
    }

    const submit = $("storeForm")?.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "💾 Enregistrer les modifications";

    $("storeForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    alert("Boutique chargée. Tu peux choisir un nouveau logo ou une nouvelle couverture, puis enregistrer.");
  } catch (error) {
    console.error(error);
    alert("Impossible de charger la boutique : " + error.message);
  }
}

function resetStoreForm() {
  $("storeForm")?.reset();
  currentStoreId = null;
  currentStoreCity = null;

  if ($("storeDelivery")) $("storeDelivery").checked = true;

  clearBrandingPreviews();

  const submit = $("storeForm")?.querySelector('button[type="submit"]');
  if (submit) {
    submit.disabled = false;
    submit.textContent = "💾 Enregistrer la boutique";
  }

  const panel = $("storeMediaEditor");
  if (panel) {
    panel.hidden = true;
    if ($("storeMediaFiles")) $("storeMediaFiles").value = "";
    if ($("storeMediaEditorGallery")) $("storeMediaEditorGallery").innerHTML = "";
    if ($("storeMediaEditorStatus")) $("storeMediaEditorStatus").textContent = "";
  }
}

/* =========================
   PRODUITS
========================= */

async function handleProductSubmit(event) {
  event.preventDefault();

  const storeId = $("productStore").value;
  const name = $("productName").value.trim();
  const priceValue = Number($("productPrice").value || 0);

  if (!storeId || !name || priceValue <= 0) {
    return alert("La boutique, le nom et un prix positif sont obligatoires.");
  }

  const payload = {
    store_id: storeId,
    name,
    slug: createSlug(name) + "-" + Date.now(),
    description: $("productDescription").value.trim() || null,
    price: priceValue,
    image_url: $("productImage").value.trim() || null,
    is_available: $("productAvailable").checked
  };

  const result = editingProductId
    ? await supabaseClient.from("products").update(payload).eq("id", editingProductId)
    : await supabaseClient.from("products").insert(payload);

  if (result.error) return alert("Enregistrement impossible : " + result.error.message);

  alert(editingProductId ? "Produit modifié." : "Produit ajouté.");
  resetProductForm(false);
  $("productStore").value = storeId;
  await Promise.all([loadProducts(storeId), loadFeaturedProducts()]);
}

function resetProductForm(clearStore = true) {
  editingProductId = null;
  $("productForm")?.reset();

  if (clearStore && $("productStore")) $("productStore").value = "";
  if ($("productAvailable")) $("productAvailable").checked = true;

  const button = document.querySelector('#productForm button[type="submit"]');
  if (button) button.textContent = "📦 Enregistrer le produit";

  if (clearStore && $("productsList")) $("productsList").textContent = "Sélectionnez une boutique.";
}

async function loadProducts(id) {
  const box = $("productsList");
  if (!box) return;
  if (!id) {
    box.textContent = "Sélectionnez une boutique.";
    return;
  }

  box.textContent = "Chargement...";

  const { data, error } = await supabaseClient.from("products")
    .select("*").eq("store_id", id).order("created_at", { ascending: false });

  if (error) {
    box.textContent = "Erreur : " + error.message;
    return;
  }

  box.innerHTML = "";

  if (!data?.length) {
    box.textContent = "Aucun produit pour cette boutique.";
    return;
  }

  data.forEach(product => {
    const card = document.createElement("article");
    card.className = "item-row";

    card.innerHTML = `
      <strong>${esc(product.name)}</strong>
      <div class="item-meta">
        ${price(product.price)} — ${product.is_available ? "Disponible" : "Indisponible"}<br>
        Mise en avant : ${product.is_featured ? "Oui" : "Non"}
      </div>
      ${product.image_url ? `<img src="${attr(product.image_url)}" alt="" loading="lazy" style="width:120px;border-radius:10px">` : ""}
      <div class="status-line">
        <button type="button" onclick="editAdminProduct('${product.id}')">Modifier</button>
        <button type="button" class="danger" onclick="deleteAdminProduct('${product.id}','${attr(product.name)}')">Supprimer</button>
      </div>
    `;

    box.appendChild(card);
  });
}

async function editAdminProduct(id) {
  const { data, error } = await supabaseClient.from("products").select("*").eq("id", id).single();
  if (error || !data) return alert("Impossible de charger le produit.");

  set("productStore", data.store_id);
  set("productName", data.name);
  set("productDescription", data.description);
  set("productPrice", data.price);
  set("productImage", data.image_url);

  $("productAvailable").checked = data.is_available !== false;
  editingProductId = id;

  const button = document.querySelector('#productForm button[type="submit"]');
  if (button) button.textContent = "💾 Enregistrer les modifications";

  $("productForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteAdminProduct(id, name) {
  if (!confirm(`Supprimer définitivement le produit "${name}" ?`)) return;

  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) return alert("Suppression impossible : " + error.message);

  await Promise.all([
    loadProducts($("productStore").value),
    loadFeaturedProducts()
  ]);
}

/* =========================
   GALERIE MÉDIAS
========================= */

async function handleMediaUpload(event) {
  event.preventDefault();

  const storeId = $("mediaStore").value;
  const type = $("mediaType").value;
  const file = $("mediaFile").files?.[0];
  const title = $("mediaTitle").value.trim();
  const cover = $("mediaCover").checked;
  const button = $("uploadMediaButton");

  if (!storeId || !file) return alert("Choisis une boutique et un fichier.");

  const max = type === "video" ? 100 * 1024 * 1024 : 12 * 1024 * 1024;
  if (file.size > max) return alert("Fichier trop volumineux (vidéo 100 Mo max, image 12 Mo max).");

  if ((type === "image" && !file.type.startsWith("image/")) ||
      (type === "video" && !file.type.startsWith("video/"))) {
    return alert("Le type du fichier ne correspond pas au média choisi.");
  }

  button.disabled = true;
  button.textContent = "Envoi en cours...";

  try {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabaseClient.storage.from("store-media")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data } = supabaseClient.storage.from("store-media").getPublicUrl(path);

    if (cover) {
      const { error } = await supabaseClient.from("store_media")
        .update({ is_cover: false }).eq("store_id", storeId);
      if (error) throw error;
    }

    const { error: insertError } = await supabaseClient.from("store_media").insert({
      store_id: storeId,
      media_type: type,
      media_url: data.publicUrl,
      title: title || null,
      is_cover: cover
    });

    if (insertError) throw insertError;

    if (cover) {
      const { error } = await supabaseClient.from("stores")
        .update({ cover_url: data.publicUrl }).eq("id", storeId);
      if (error) throw error;
    }

    alert("Média ajouté.");
    $("mediaForm").reset();
    await loadGallery(storeId);
  } catch (error) {
    console.error(error);
    alert("Erreur lors de l'envoi : " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = "📤 Envoyer le média";
  }
}

async function loadGallery(id) {
  const box = $("mediaList");
  if (!box) return;
  if (!id) {
    box.textContent = "Choisis une boutique.";
    return;
  }

  box.textContent = "Chargement...";

  const { data, error } = await supabaseClient.from("store_media")
    .select("*").eq("store_id", id).order("created_at", { ascending: false });

  if (error) {
    box.textContent = "Erreur : " + error.message;
    return;
  }

  box.innerHTML = "";

  if (!data?.length) {
    box.textContent = "Aucun média pour cette boutique.";
    return;
  }

  data.forEach(media => {
    const card = document.createElement("div");
    card.className = "media-item";

    card.innerHTML = media.media_type === "image"
      ? `<img src="${attr(media.media_url)}" alt="" loading="lazy"><div class="media-info">${esc(media.title || "Sans titre")}${media.is_cover ? "<strong> — Couverture</strong>" : ""}</div>`
      : `<video src="${attr(media.media_url)}" controls preload="metadata"></video><div class="media-info">${esc(media.title || "Vidéo")}</div>`;

    box.appendChild(card);
  });
}

/* =========================
   DEMANDES ANNONCEURS
========================= */

async function loadAdvertiserApplications() {
  const box = $("advertisersList");
  if (!box) return;

  box.textContent = "Chargement des demandes...";

  const { data, error } = await supabaseClient.from("advertiser_applications")
    .select("id,full_name,business_name,category,phone,whatsapp,city,address,description,goal,status,created_at,store_id,merchant_code")
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = "Erreur de chargement : " + error.message;
    return;
  }

  box.innerHTML = "";

  if (!data?.length) {
    box.textContent = "Aucune demande pour le moment.";
    return;
  }

  data.forEach(application => {
    const card = document.createElement("article");
    card.className = "item-row";

    card.innerHTML = `
      <div class="item-head">
        <strong>${esc(application.business_name || "Entreprise sans nom")}</strong>
        <span>${esc(statusLabel(application.status))}</span>
      </div>

      <div class="item-meta">
        Nom : ${esc(application.full_name || "-")}<br>
        Téléphone : ${esc(application.phone || "-")}<br>
        WhatsApp : ${esc(application.whatsapp || "-")}<br>
        Catégorie : ${esc(application.category || "-")}<br>
        Ville : ${esc(application.city || "-")}<br>
        Adresse : ${esc(application.address || "-")}<br>
        Reçue le : ${date(application.created_at)}
      </div>

      ${application.description ? `<p>${esc(application.description)}</p>` : ""}
      ${application.merchant_code ? `<p><strong>Code marchand :</strong> ${esc(application.merchant_code)}</p>` : ""}

      <label>Statut</label>
      <select onchange="updateAdvertiserStatus('${application.id}',this.value)">
        ${advertiserOptions(application.status)}
      </select>

      <div class="status-line">
        ${application.status === "pending"
          ? `<button class="gold" onclick="approveAdvertiser('${application.id}')">Approuver et créer la boutique</button>`
          : application.status === "approved" && application.store_id
            ? `<button onclick="approveAdvertiser('${application.id}')">Renvoyer le code par e-mail</button>`
            : ""}
      </div>
    `;

    box.appendChild(card);
  });
}

function advertiserOptions(value) {
  return [
    ["pending", "En attente"],
    ["contacted", "Contacté"],
    ["approved", "Approuvé"],
    ["rejected", "Refusé"]
  ].map(([key, label]) =>
    `<option value="${key}" ${value === key ? "selected" : ""}>${label}</option>`
  ).join("");
}

function statusLabel(status) {
  return ({
    pending: "En attente",
    contacted: "Contacté",
    approved: "Approuvé",
    rejected: "Refusé"
  })[status] || status || "-";
}

async function updateAdvertiserStatus(id, status) {
  const { error } = await supabaseClient.from("advertiser_applications")
    .update({ status, updated_at: new Date().toISOString() }).eq("id", id);

  if (error) return alert("Modification impossible : " + error.message);
  await loadAdvertiserApplications();
}

async function getApplication(id) {
  const { data, error } = await supabaseClient.from("advertiser_applications")
    .select("*").eq("id", id).single();

  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

async function approveAdvertiser(id) {
  const application = await getApplication(id);
  if (!application) return alert("Demande introuvable.");

  if (application.status === "approved" && application.store_id) {
    if (!confirm("Cette demande est déjà approuvée. Renvoyer le code marchand par e-mail ?")) return;

    const { data, error } = await supabaseClient.functions.invoke("send-merchant-code-email", {
      body: { applicationId: id }
    });

    if (error || !data?.success) {
      return alert("Échec de l'envoi : " + (data?.error || error?.message || "Erreur inconnue"));
    }

    return alert("E-mail envoyé.");
  }

  if (!confirm(`Approuver la demande et créer la boutique "${application.business_name}" ?`)) return;

  const { data: storeId, error } = await supabaseClient.rpc("approve_advertiser_application", {
    p_application_id: id
  });

  if (error || !storeId) {
    return alert("Approbation impossible : " + (error?.message || "Identifiant boutique absent"));
  }

  await Promise.all([loadAdvertiserApplications(), loadStores()]);

  const { data, error: mailError } = await supabaseClient.functions.invoke("send-merchant-code-email", {
    body: { applicationId: id }
  });

  if (mailError || !data?.success) {
    return alert("Boutique créée, mais e-mail non envoyé : " +
      (data?.error || mailError?.message || "Erreur inconnue") +
      ". Tu peux aussi envoyer le code par WhatsApp depuis la rubrique Boutiques.");
  }

  alert("Demande approuvée, boutique créée et code envoyé par e-mail.");
}

/* =========================
   WHATSAPP ET SUPPRESSION BOUTIQUE
========================= */

async function resendMerchantCode(id) {
  const { data: store, error } = await supabaseClient.from("stores")
    .select("name,phone,whatsapp,merchant_code").eq("id", id).single();

  if (error || !store) return alert("Impossible de récupérer les informations de la boutique.");
  if (!store.merchant_code) return alert("Aucun code marchand attribué.");

  let phone = String(store.whatsapp || store.phone || "").replace(/\D/g, "");
  if (phone && !phone.startsWith("229")) phone = "229" + phone;
  if (!phone) return alert("Aucun numéro de téléphone disponible.");

  if (!confirm(`Ouvrir WhatsApp pour envoyer le code marchand de "${store.name}" ?`)) return;

  const message = `Bonjour ${store.name} !\n\nVotre code marchand PK ChapShop : ${store.merchant_code}\n\nMerci de votre confiance !`;
  window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(message), "_blank", "noopener");
}

async function deleteStore(id, name) {
  if (!confirm(`Supprimer la boutique "${name}" ?`)) return;

  const productsCheck = await supabaseClient.from("products")
    .select("id").eq("store_id", id).limit(1);

  if (productsCheck.error) return alert(productsCheck.error.message);
  if (productsCheck.data?.length) {
    return alert("Cette boutique contient encore des produits. Supprime-les d'abord.");
  }

  const ordersCheck = await supabaseClient.from("orders")
    .select("id").eq("store_id", id).limit(1);

  if (ordersCheck.error) return alert(ordersCheck.error.message);
  if (ordersCheck.data?.length) {
    return alert("Suppression bloquée : cette boutique possède des commandes.");
  }

  const { error } = await supabaseClient.from("stores").delete().eq("id", id);
  if (error) return alert("Suppression impossible : " + error.message);

  alert("Boutique supprimée.");
  await Promise.all([loadStores(), loadFeatured()]);
}

/* =========================
   UTILITAIRES
========================= */

function price(value) {
  return Number(value || 0).toLocaleString("fr-FR") + " FCFA";
}

function date(value) {
  return value
    ? new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
    : "-";
}

function createSlug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function set(id, value) {
  if ($(id)) $(id).value = value ?? "";
}

function esc(value) {
  return value == null ? "" : String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function attr(value) {
  return esc(value);
}

window.logout = logout;
window.archiveOrder = archiveOrder;
window.restoreOrder = restoreOrder;
window.deleteArchivedOrder = deleteArchivedOrder;
window.updateOrderStatus = updateOrderStatus;
window.updatePaymentStatus = updatePaymentStatus;
window.saveDelivery = saveDelivery;
window.editStore = editStore;
window.deleteStore = deleteStore;
window.loadProducts = loadProducts;
window.loadGallery = loadGallery;
window.updateAdvertiserStatus = updateAdvertiserStatus;
window.approveAdvertiser = approveAdvertiser;
window.resendMerchantCode = resendMerchantCode;
window.editAdminProduct = editAdminProduct;
window.deleteAdminProduct = deleteAdminProduct;
