const SUPABASE_URL =
  "https://ljzonxmlpygfryfmohhd.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

const form = document.getElementById("trackingForm");
const result = document.getElementById("trackingResult");
const button = document.getElementById("trackingButton");
const cartCount = document.getElementById("cartCount");

function updateCartCount() {
  try {
    const cart = JSON.parse(localStorage.getItem("pk_cart") || "[]");
    cartCount.textContent = cart.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
  } catch {
    cartCount.textContent = "0";
  }
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const statuses = {
  pending: {
    title: "En attente de confirmation",
    icon: "🕐",
    step: 1
  },
  confirmed: {
    title: "Commande confirmée",
    icon: "✅",
    step: 2
  },
  preparing: {
    title: "Commande en préparation",
    icon: "👨‍🍳",
    step: 3
  },
  ready: {
    title: "Commande prête",
    icon: "📦",
    step: 4
  },
  out_for_delivery: {
    title: "Commande en livraison",
    icon: "🚚",
    step: 5
  },
  delivered: {
    title: "Commande livrée",
    icon: "🎉",
    step: 6
  },
  cancelled: {
    title: "Commande annulée",
    icon: "❌",
    step: 0
  }
};

const deliveryStatuses = {
  pending: "En attente d'un livreur",
  assigned: "Livreur attribué",
  picked_up: "Commande récupérée",
  in_transit: "En route vers le client",
  delivered: "Livraison effectuée",
  failed: "Livraison non effectuée"
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function renderTracking(order, delivery = {}) {
  const current =
    statuses[order.order_status] || statuses.pending;

  const steps = [
    { key: "pending", title: "Commande reçue", icon: "🕐" },
    { key: "confirmed", title: "Confirmée", icon: "✅" },
    { key: "preparing", title: "Préparation", icon: "👨‍🍳" },
    { key: "ready", title: "Prête", icon: "📦" },
    { key: "out_for_delivery", title: "En livraison", icon: "🚚" },
    { key: "delivered", title: "Livrée", icon: "🎉" }
  ];

  const timeline = steps.map((step, index) => {
    const number = index + 1;
    let className = "";

    if (
      current.step >= number &&
      order.order_status !== "cancelled"
    ) {
      className = "completed";
    }

    if (
      current.step === number &&
      order.order_status !== "cancelled"
    ) {
      className += " active";
    }

    return `
      <div class="tracking-step ${className}">
        <div class="tracking-icon">${step.icon}</div>
        <div class="tracking-step-text">${esc(step.title)}</div>
      </div>
    `;
  }).join("");

  const minutes =
    delivery.estimated_minutes ?? order.estimated_minutes;

  const estimate = minutes !== null &&
    minutes !== undefined &&
    minutes !== "" &&
    Number(minutes) >= 0
    ? `
      <div class="delivery-estimate">
        🚚 Délai estimé :
        <strong>${esc(minutes)} minutes</strong>
      </div>
    `
    : "";

  const driverPhone = String(delivery.driver_phone || "");
  const safePhone = driverPhone.replace(/[^\d+]/g, "");

  const driverCard = (
    delivery.driver_name ||
    delivery.driver_phone ||
    delivery.current_location ||
    delivery.delivery_status ||
    delivery.picked_up_at ||
    delivery.delivered_at
  ) ? `
    <section class="tracking-driver-card">
      <h3>🚚 Informations de livraison</h3>

      ${delivery.delivery_status ? `
        <p>
          <strong>État de la livraison :</strong>
          ${esc(deliveryStatuses[delivery.delivery_status] ||
            delivery.delivery_status)}
        </p>
      ` : ""}

      ${delivery.driver_name ? `
        <p>
          <strong>Votre livreur :</strong>
          ${esc(delivery.driver_name)}
        </p>
      ` : ""}

      ${safePhone ? `
        <p>
          <strong>Téléphone :</strong>
          <a href="tel:${esc(safePhone)}">
            ${esc(driverPhone)}
          </a>
        </p>
      ` : ""}

      ${delivery.current_location ? `
        <p>
          <strong>Position communiquée :</strong>
          ${esc(delivery.current_location)}
        </p>
      ` : ""}

      ${delivery.picked_up_at ? `
        <p>
          <strong>Commande récupérée :</strong>
          ${esc(formatDate(delivery.picked_up_at))}
        </p>
      ` : ""}

      ${delivery.delivered_at ? `
        <p>
          <strong>Livrée le :</strong>
          ${esc(formatDate(delivery.delivered_at))}
        </p>
      ` : ""}
    </section>
  ` : "";

  result.innerHTML = `
    <section class="tracking-result">
      <div class="tracking-order-header">
        <div>
          <small>COMMANDE</small>
          <h2>#${esc(order.order_number)}</h2>
        </div>

        <div class="tracking-current-status">
          <span>${current.icon}</span>
          <strong>${esc(current.title)}</strong>
        </div>
      </div>

      <div class="tracking-store">
        🏪 <strong>${esc(order.store_name)}</strong>
      </div>

      ${
        order.order_status === "cancelled"
          ? `
            <div class="cancelled-order">
              ❌ Cette commande a été annulée.
            </div>
          `
          : `<div class="tracking-timeline">${timeline}</div>`
      }

      ${estimate}
      ${driverCard}

      <div class="tracking-total">
        <span>Total</span>
        <strong>
          ${Number(order.total || 0).toLocaleString("fr-FR")}
          FCFA
        </strong>
      </div>

      <p class="tracking-refresh">
        Les informations évoluent lorsque le commerce
        et le service de livraison mettent à jour la commande.
      </p>

      <button
        class="checkout-button"
        onclick="trackOrder()"
        type="button"
      >
        🔄 Actualiser le statut
      </button>
    </section>
  `;
}

async function callRpc(name, payload) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || "Impossible de rechercher la commande."
    );
  }

  return data;
}

async function trackOrder() {
  const orderNumber = document
    .getElementById("orderNumber").value.trim();

  const phone = document
    .getElementById("phone").value.trim();

  if (!orderNumber || !phone) {
    alert(
      "Veuillez renseigner le numéro de commande et votre téléphone."
    );
    return;
  }

  if (!/^\d+$/.test(orderNumber)) {
    alert("Le numéro de commande doit contenir uniquement des chiffres.");
    return;
  }

  button.disabled = true;
  button.textContent = "⏳ Recherche...";
  result.innerHTML = "";

  try {
    const orderData = await callRpc("track_order", {
      p_order_number: Number(orderNumber),
      p_phone: phone
    });

    if (!orderData || !orderData.length) {
      result.innerHTML = `
        <div class="empty tracking-error">
          <div style="font-size:45px;">🔍</div>
          <h3>Commande introuvable</h3>
          <p>
            Vérifiez le numéro de commande et le téléphone
            utilisés lors de la commande.
          </p>
        </div>
      `;
      return;
    }

    let delivery = {};

    try {
      const deliveryData = await callRpc("track_order_delivery", {
        p_order_number: Number(orderNumber),
        p_phone: phone
      });

      if (deliveryData && deliveryData.length) {
        delivery = deliveryData[0];
      }
    } catch (deliveryError) {
      // Le suivi principal reste disponible si les détails
      // du livreur ne sont pas encore accessibles.
      console.warn(
        "Informations de livraison indisponibles :",
        deliveryError
      );
    }

    renderTracking(orderData[0], delivery);

  } catch (error) {
    console.error(error);

    result.innerHTML = `
      <div class="empty tracking-error">
        <div style="font-size:45px;">⚠️</div>
        <h3>Une erreur est survenue</h3>
        <p>
          Impossible de charger le suivi pour le moment.
          Réessayez dans quelques instants.
        </p>
      </div>
    `;
  } finally {
    button.disabled = false;
    button.textContent = "🔎 Suivre ma commande";
  }
}

form.addEventListener("submit", function(event) {
  event.preventDefault();
  trackOrder();
});

const params = new URLSearchParams(window.location.search);
const orderFromUrl = params.get("order");

if (orderFromUrl) {
  document.getElementById("orderNumber").value = orderFromUrl;
}

updateCartCount();
