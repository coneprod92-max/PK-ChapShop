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
const refreshOrders = document.getElementById("refreshOrders");

const ordersList = document.getElementById("ordersList");
const ordersMessage = document.getElementById("ordersMessage");

const statOrders = document.getElementById("statOrders");
const statPending = document.getElementById("statPending");
const statDelivered = document.getElementById("statDelivered");


// ===============================
// MESSAGE
// ===============================

function showLoginMessage(message, success = false) {

  loginMessage.innerHTML = `
    <div class="${success ? "admin-success" : "admin-error"}">
      ${message}
    </div>
  `;

}


// ===============================
// VERIFIER ADMIN
// ===============================

async function checkAdmin() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {

    showLogin();

    return false;
  }


  const { data, error } =
    await supabaseClient.rpc("is_admin");


  if (error || data !== true) {

    await supabaseClient.auth.signOut();

    showLoginMessage(
      "⛔ Ce compte n'a pas accès à l'administration."
    );

    showLogin();

    return false;
  }


  showDashboard();

  await loadOrders();

  return true;
}


// ===============================
// AFFICHAGE LOGIN
// ===============================

function showLogin() {

  loginSection.classList.remove("admin-hidden");

  dashboard.classList.add("admin-hidden");

}


// ===============================
// AFFICHAGE DASHBOARD
// ===============================

function showDashboard() {

  loginSection.classList.add("admin-hidden");

  dashboard.classList.remove("admin-hidden");

}


// ===============================
// CONNEXION
// ===============================

loginForm.addEventListener("submit", async function(event) {

  event.preventDefault();


  const email =
    document.getElementById("adminEmail").value.trim();

  const password =
    document.getElementById("adminPassword").value;


  loginMessage.innerHTML = "";


  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });


  if (error) {

    showLoginMessage(
      "❌ Email ou mot de passe incorrect."
    );

    return;
  }


  const adminOK = await checkAdmin();


  if (adminOK) {

    loginMessage.innerHTML = "";
  }

});


// ===============================
// DECONNEXION
// ===============================

logoutButton.addEventListener("click", async function() {

  await supabaseClient.auth.signOut();

  ordersList.innerHTML = "";

  showLogin();

  showLoginMessage(
    "Vous êtes maintenant déconnecté.",
    true
  );

});


// ===============================
// CHARGER LES COMMANDES
// ===============================

async function loadOrders() {

  ordersMessage.innerHTML =
    "<p>Chargement des commandes...</p>";

  ordersList.innerHTML = "";


  const { data: orders, error } =
    await supabaseClient
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
        ❌ Impossible de charger les commandes.<br>
        ${error.message}
      </div>
    `;

    return;
  }


  ordersMessage.innerHTML = "";


  updateStats(orders);


  if (!orders || orders.length === 0) {

    ordersList.innerHTML = `
      <p>
        Aucune commande pour le moment.
      </p>
    `;

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
    orders.filter(order =>
      order.status === "pending"
    ).length;


  statDelivered.textContent =
    orders.filter(order =>
      order.status === "delivered"
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

  const delivery =
    Array.isArray(order.deliveries)
      ? order.deliveries[0] || {}
      : order.deliveries || {};


  const card =
    document.createElement("div");

  card.className = "order-row";


  const date =
    new Date(order.created_at)
      .toLocaleString("fr-FR");


  card.innerHTML = `

    <div class="order-head">

      <div class="order-number">
        📦 Commande #${order.order_number}
      </div>

      <strong>
        ${Number(order.total).toLocaleString("fr-FR")} FCFA
      </strong>

    </div>


    <div class="order-meta">

      👤 <strong>${escapeHTML(customer.full_name || "Client")}</strong><br>

      📞 ${escapeHTML(customer.phone || "Non renseigné")}<br>

      🏪 ${escapeHTML(store.name || "Boutique")}<br>

      📍 ${escapeHTML(order.delivery_address || "Adresse non renseignée")}<br>

      💳 ${escapeHTML(order.payment_method || "Non renseigné")}<br>

      🕒 ${date}

    </div>


    <div class="status-line">

      <select class="order-status">

        ${statusOption("pending", "En attente", order.status)}
        ${statusOption("confirmed", "Confirmée", order.status)}
        ${statusOption("preparing", "En préparation", order.status)}
        ${statusOption("ready", "Prête", order.status)}
        ${statusOption("out_for_delivery", "En livraison", order.status)}
        ${statusOption("delivered", "Livrée", order.status)}
        ${statusOption("cancelled", "Annulée", order.status)}

      </select>


      <button
        class="admin-button update-order"
      >
        💾 Mettre à jour
      </button>

    </div>

  `;


  const select =
    card.querySelector(".order-status");

  const button =
    card.querySelector(".update-order");


  button.addEventListener("click", async function() {

    await updateOrderStatus(
      order.id,
      select.value,
      button
    );

  });


  return card;

}


// ===============================
// OPTION STATUT
// ===============================

function statusOption(value, label, current) {

  return `
    <option
      value="${value}"
      ${value === current ? "selected" : ""}
    >
      ${label}
    </option>
  `;

}


// ===============================
// MODIFIER STATUT
// ===============================

async function updateOrderStatus(
  orderId,
  newStatus,
  button
) {

  button.disabled = true;

  button.textContent =
    "Enregistrement...";


  const { error } =
    await supabaseClient
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


  setTimeout(() => {

    button.disabled = false;

    button.textContent =
      "💾 Mettre à jour";

  }, 1500);


  await loadOrders();

}


// ===============================
// ACTUALISER
// ===============================

refreshOrders.addEventListener(
  "click",
  loadOrders
);


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
// DEMARRAGE
// ===============================

checkAdmin();
