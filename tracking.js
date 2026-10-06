const SUPABASE_URL =
  "https://ljzonxmlpygfryfmohhd.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

const form =
  document.getElementById("trackingForm");

const result =
  document.getElementById("trackingResult");

const button =
  document.getElementById("trackingButton");

const cartCount =
  document.getElementById("cartCount");


function updateCartCount() {

  const cart = JSON.parse(
    localStorage.getItem("pk_cart") || "[]"
  );

  const count = cart.reduce(
    (total, item) =>
      total + Number(item.quantity || 0),
    0
  );

  cartCount.textContent = count;
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


function renderTracking(order) {

  const current =
    statuses[order.order_status] ||
    statuses.pending;

  const steps = [

    {
      key: "pending",
      title: "Commande reçue",
      icon: "🕐"
    },

    {
      key: "confirmed",
      title: "Confirmée",
      icon: "✅"
    },

    {
      key: "preparing",
      title: "Préparation",
      icon: "👨‍🍳"
    },

    {
      key: "ready",
      title: "Prête",
      icon: "📦"
    },

    {
      key: "out_for_delivery",
      title: "En livraison",
      icon: "🚚"
    },

    {
      key: "delivered",
      title: "Livrée",
      icon: "🎉"
    }

  ];


  const html = steps.map(
    (step, index) => {

      const stepNumber = index + 1;

      let className = "";

      if (
        current.step >= stepNumber &&
        order.order_status !== "cancelled"
      ) {

        className = "completed";

      }

      if (
        current.step === stepNumber &&
        order.order_status !== "cancelled"
      ) {

        className += " active";

      }

      return `

        <div class="tracking-step ${className}">

          <div class="tracking-icon">
            ${step.icon}
          </div>

          <div class="tracking-step-text">
            ${esc(step.title)}
          </div>

        </div>

      `;

    }
  ).join("");


  const deliveryInfo =
    order.estimated_minutes
      ? `
        <div class="delivery-estimate">
          🚚 Livraison estimée dans environ
          <strong>
            ${esc(order.estimated_minutes)}
            minutes
          </strong>
        </div>
      `
      : "";


  result.innerHTML = `

    <section class="tracking-result">

      <div class="tracking-order-header">

        <div>

          <small>
            COMMANDE
          </small>

          <h2>
            #${esc(order.order_number)}
          </h2>

        </div>

        <div class="tracking-current-status">

          <span>
            ${current.icon}
          </span>

          <strong>
            ${esc(current.title)}
          </strong>

        </div>

      </div>


      <div class="tracking-store">

        🏪

        <strong>
          ${esc(order.store_name)}
        </strong>

      </div>


      ${
        order.order_status === "cancelled"
          ? `
            <div class="cancelled-order">
              ❌ Cette commande a été annulée.
            </div>
          `
          : `
            <div class="tracking-timeline">

              ${html}

            </div>
          `
      }


      ${deliveryInfo}


      <div class="tracking-total">

        <span>
          Total
        </span>

        <strong>
          ${Number(order.total).toLocaleString("fr-FR")}
          FCFA
        </strong>

      </div>


      <p class="tracking-refresh">
        Le statut peut évoluer lorsque le commerce
        traite votre commande.
      </p>


      <button
        class="checkout-button"
        onclick="trackOrder()"
      >
        🔄 Actualiser le statut
      </button>

    </section>

  `;
}


async function trackOrder() {

  const orderNumber =
    document.getElementById(
      "orderNumber"
    ).value.trim();

  const phone =
    document.getElementById(
      "phone"
    ).value.trim();


  if (!orderNumber || !phone) {

    alert(
      "Veuillez renseigner le numéro de commande et votre téléphone."
    );

    return;
  }


  button.disabled = true;

  button.textContent =
    "⏳ Recherche...";


  result.innerHTML = "";


  try {

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/track_order`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({

          p_order_number:
            Number(orderNumber),

          p_phone:
            phone

        })
      }
    );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.message ||
        "Impossible de rechercher la commande."
      );

    }


    if (!data || !data.length) {

      result.innerHTML = `

        <div class="empty tracking-error">

          <div style="font-size:45px;">
            🔍
          </div>

          <h3>
            Commande introuvable
          </h3>

          <p>
            Vérifiez le numéro de commande
            et le numéro de téléphone utilisés
            lors de la commande.
          </p>

        </div>

      `;

      return;
    }


    renderTracking(data[0]);


  } catch (error) {

    console.error(error);

    result.innerHTML = `

      <div class="empty tracking-error">

        <div style="font-size:45px;">
          ⚠️
        </div>

        <h3>
          Une erreur est survenue
        </h3>

        <p>
          ${esc(error.message)}
        </p>

      </div>

    `;

  } finally {

    button.disabled = false;

    button.textContent =
      "🔎 Suivre ma commande";

  }

}


form.addEventListener(
  "submit",
  function(event) {

    event.preventDefault();

    trackOrder();

  }
);


const params =
  new URLSearchParams(
    window.location.search
  );

const orderFromUrl =
  params.get("order");

if (orderFromUrl) {

  document.getElementById(
    "orderNumber"
  ).value = orderFromUrl;

}


updateCartCount();
