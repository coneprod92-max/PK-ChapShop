const cartItemsEl = document.getElementById("cartItems");
const cartSummaryEl = document.getElementById("cartSummary");
const cartCountEl = document.getElementById("cartCount");

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
    (total, item) => total + Number(item.quantity || 0),
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

  if (!cart.length) {

    cartItemsEl.innerHTML = `
      <div class="empty">
        <div style="font-size:45px;margin-bottom:10px;">🛒</div>

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
              ? `<img src="${esc(item.image_url)}" alt="${esc(item.name)}">`
              : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:30px;">🛍️</div>`
          }

        </div>

        <div class="cart-item-info">

          <h3>${esc(item.name)}</h3>

          <div class="cart-item-price">
            ${Number(item.price).toLocaleString("fr-FR")} FCFA / unité
          </div>

          <div class="quantity">

            <button onclick="changeQuantity('${esc(item.id)}', -1)">
              −
            </button>

            <strong>${item.quantity}</strong>

            <button onclick="changeQuantity('${esc(item.id)}', 1)">
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
      <span>Calculée à la commande</span>
    </div>

    <div class="summary-total">
      <span>Total</span>
      <span>
        ${subtotal.toLocaleString("fr-FR")} FCFA
      </span>
    </div>

    <button
      class="checkout-button"
      onclick="checkout()"
    >
      Continuer la commande →
    </button>

  `;
}

function checkout() {

  alert(
    "La prochaine étape sera le formulaire de commande, le paiement et le suivi de livraison. 🚀"
  );
}

renderCart();
