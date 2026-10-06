const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

const cartItemsEl = document.getElementById("cartItems");
const cartSummaryEl = document.getElementById("cartSummary");
const cartCountEl = document.getElementById("cartCount");
const orderResultEl = document.getElementById("orderResult");

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCart() {
  return JSON.parse(
    localStorage.getItem("pk_cart") || "[]"
  );
}

function saveCart(cart) {
  localStorage.setItem(
    "pk_cart",
    JSON.stringify(cart)
  );
}

function updateCartCount() {

  const cart = getCart();

  const count = cart.reduce(
    (total, item) =>
      total + Number(item.quantity || 0),
    0
  );

  cartCountEl.textContent = count;
}

function changeQuantity(id, change) {

  const cart = getCart();

  const item = cart.find(
    product => product.id === id
  );

  if (!item) return;

  item.quantity += change;

  if (item.quantity <= 0) {

    const index = cart.indexOf(item);

    cart.splice(index, 1);
  }

  saveCart(cart);

  renderCart();
}

function removeItem(id) {

  let cart = getCart();

  cart = cart.filter(
    item => item.id !== id
  );

  saveCart(cart);

  renderCart();
}

function renderCart() {

  const cart = getCart();

  updateCartCount();

  orderResultEl.innerHTML = "";

  if (!cart.length) {

    cartItemsEl.innerHTML = `
      <div class="empty">

        <div style="font-size:45px;margin-bottom:10px;">
          🛒
        </div>

        <h3>Votre panier est vide</h3>

        <p style="margin-top:8px;">
          Ajoutez des produits pour commencer votre commande.
        </p>

      </div>
    `;

    cartSummaryEl.innerHTML = "";

    return;
  }

  cartItemsEl.innerHTML = cart.map(item => {

    const total =
      Number(item.price || 0) *
      Number(item.quantity || 0);

    return `
      <div class="cart-item">

        <div class="cart-item-image">

          ${
            item.image_url
              ? `
                <img
                  src="${esc(item.image_url)}"
                  alt="${esc(item.name)}"
                >
              `
              : `
                <div style="
                  height:100%;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  font-size:30px;
                ">
                  🛍️
                </div>
              `
          }

        </div>

        <div class="cart-item-info">

          <h3>${esc(item.name)}</h3>

          <div class="cart-item-price">
            ${Number(item.price).toLocaleString("fr-FR")}
            FCFA / unité
          </div>

          <div class="quantity">

            <button
              onclick="changeQuantity('${esc(item.id)}', -1)"
            >
              −
            </button>

            <strong>
              ${item.quantity}
            </strong>

            <button
              onclick="changeQuantity('${esc(item.id)}', 1)"
            >
              +
            </button>

          </div>

        </div>

        <div>

          <strong>
            ${total.toLocaleString("fr-FR")} FCFA
          </strong>

          <br>

          <button
            class="remove-button"
            onclick="removeItem('${esc(item.id)}')"
            title="Supprimer"
          >
            🗑️
          </button>

        </div>

      </div>
    `;

  }).join("");

  const subtotal = cart.reduce(
    (total, item) =>
      total +
      Number(item.price || 0) *
      Number(item.quantity || 0),
    0
  );

  cartSummaryEl.innerHTML = `

    <div class="summary-line">
      <span>Sous-total</span>

      <strong>
        ${subtotal.toLocaleString("fr-FR")} FCFA
      </strong>
    </div>

    <div class="summary-line">
      <span>Livraison</span>

      <span>
        Calculée selon la zone
      </span>
    </div>

    <div class="summary-total">

      <span>Total</span>

      <span>
        ${subtotal.toLocaleString("fr-FR")} FCFA
      </span>

    </div>

    <button
      class="checkout-button"
      onclick="showOrderForm()"
    >
      🛍️ Passer la commande
    </button>

  `;
}

function showOrderForm() {

  const cart = getCart();

  if (!cart.length) return;

  cartSummaryEl.innerHTML = `

    <h2 style="margin-bottom:8px;">
      Finaliser ma commande
    </h2>

    <p style="
      color:#b8c2cf;
      margin-bottom:22px;
      line-height:1.5;
    ">
      Entrez vos informations pour que le commerce puisse
      traiter votre commande et organiser la livraison.
    </p>

    <form id="orderForm">

      <label>Nom complet</label>

      <input
        id="customerName"
        type="text"
        placeholder="Ex : Chadli Da Silva"
        required
      >

      <label>Numéro de téléphone</label>

      <input
        id="customerPhone"
        type="tel"
        placeholder="+229 01 60 88 53 50"
        required
      >

      <label>WhatsApp</label>

      <input
        id="customerWhatsapp"
        type="tel"
        placeholder="Numéro WhatsApp"
      >

      <label>Adresse de livraison</label>

      <textarea
        id="deliveryAddress"
        placeholder="Quartier, rue, maison, repère..."
        required
      ></textarea>

      <label>Ville</label>

      <input
        id="customerCity"
        type="text"
        value="Parakou"
        required
      >

      <label>Mode de paiement</label>

      <select
        id="paymentMethod"
        required
      >

        <option value="cash">
          💵 Paiement à la livraison
        </option>

        <option value="mobile_money">
          📱 Mobile Money
        </option>

      </select>

      <label>Note pour le commerce</label>

      <textarea
        id="customerNote"
        placeholder="Précision concernant votre commande..."
      ></textarea>

      <button
        id="submitOrderButton"
        type="submit"
        class="checkout-button"
      >
        ✅ Confirmer ma commande
      </button>

    </form>

  `;

  const form = document.getElementById("orderForm");

  form.addEventListener(
    "submit",
    submitOrder
  );

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function submitOrder(event) {

  event.preventDefault();

  const cart = getCart();

  if (!cart.length) {

    alert("Votre panier est vide.");

    return;
  }

  const button =
    document.getElementById(
      "submitOrderButton"
    );

  button.disabled = true;

  button.textContent =
    "⏳ Enregistrement de la commande...";

  const customerName =
    document.getElementById(
      "customerName"
    ).value.trim();

  const customerPhone =
    document.getElementById(
      "customerPhone"
    ).value.trim();

  const customerWhatsapp =
    document.getElementById(
      "customerWhatsapp"
    ).value.trim();

  const deliveryAddress =
    document.getElementById(
      "deliveryAddress"
    ).value.trim();

  const customerCity =
    document.getElementById(
      "customerCity"
    ).value.trim();

  const paymentMethod =
    document.getElementById(
      "paymentMethod"
    ).value;

  const customerNote =
    document.getElementById(
      "customerNote"
    ).value.trim();

  const items = cart.map(item => ({
    product_id: item.id,
    quantity: Number(item.quantity)
  }));

  try {

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/submit_order`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({

          p_store_id: cart[0].store_id,

          p_customer_name:
            customerName,

          p_customer_phone:
            customerPhone,

          p_customer_whatsapp:
            customerWhatsapp,

          p_delivery_address:
            deliveryAddress,

          p_city:
            customerCity,

          p_payment_method:
            paymentMethod,

          p_note:
            customerNote,

          p_items:
            items

        })
      }
    );

    const result =
      await response.json();

    if (!response.ok) {

      console.error(result);

      throw new Error(
        result.message ||
        result.hint ||
        "Impossible d'enregistrer la commande."
      );
    }

    const order =
      Array.isArray(result)
        ? result[0]
        : result;

    localStorage.removeItem(
      "pk_cart"
    );

    updateCartCount();

    cartItemsEl.innerHTML = "";

    cartSummaryEl.innerHTML = "";

    orderResultEl.innerHTML = `

      <div class="empty" style="
        border:2px solid #22c55e;
        margin-top:20px;
      ">

        <div style="
          font-size:55px;
          margin-bottom:10px;
        ">
          🎉
        </div>

        <h2 style="color:#16a34a;">
          Commande enregistrée !
        </h2>

        <p style="
          margin-top:12px;
          line-height:1.6;
        ">
          Votre commande a bien été reçue.
        </p>

        <div style="
          margin:20px 0;
          padding:15px;
          background:#f1f5f9;
          border-radius:12px;
        ">

          <strong>
            Numéro de commande
          </strong>

          <div style="
            font-size:25px;
            font-weight:900;
            margin-top:6px;
          ">
            #${esc(order.order_number)}
          </div>

        </div>

        <p>
          Statut :
          <strong>
            ⏳ En attente de confirmation
          </strong>
        </p>

        <a
          href="index.html"
          class="view-button"
          style="margin-top:20px;"
        >
          Retour à l'accueil
        </a>

      </div>

    `;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {

    console.error(error);

    alert(
      "Impossible d'enregistrer la commande : " +
      error.message
    );

    button.disabled = false;

    button.textContent =
      "✅ Confirmer ma commande";
  }
}

renderCart();
