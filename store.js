const SUPABASE_URL =
  "https://ljzonxmlpygfryfmohhd.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`
};


const storeInfoEl =
  document.getElementById("storeInfo");

const galleryEl =
  document.getElementById("storeGallery");

const productsEl =
  document.getElementById("products");

const cartCountEl =
  document.getElementById("cartCount");

const toastEl =
  document.getElementById("toast");


const params =
  new URLSearchParams(
    window.location.search
  );

const storeId =
  params.get("id");


// =====================================================
// SECURITE HTML
// =====================================================

function esc(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// =====================================================
// PANIER
// =====================================================

function updateCartCount() {

  const cart =
    JSON.parse(
      localStorage.getItem("pk_cart") || "[]"
    );


  const count =
    cart.reduce(
      (total, item) =>
        total + Number(
          item.quantity || 0
        ),
      0
    );


  cartCountEl.textContent =
    count;

}


// =====================================================
// MESSAGE
// =====================================================

function showToast(message) {

  toastEl.textContent =
    message;

  toastEl.classList.add("show");


  setTimeout(() => {

    toastEl.classList.remove("show");

  }, 2200);

}


// =====================================================
// BOUTIQUE
// =====================================================

async function loadStore() {

  if (!storeId) {

    storeInfoEl.innerHTML = `
      <div class="empty error">
        Commerce introuvable.
      </div>
    `;

    return;

  }


  try {

    const response =
      await fetch(

        `${SUPABASE_URL}/rest/v1/stores?` +
        `select=id,name,description,phone,whatsapp,` +
        `address,city,logo_url,cover_url,is_open,` +
        `delivery_available` +
        `&id=eq.${encodeURIComponent(storeId)}` +
        `&is_published=eq.true`,

        {
          headers
        }

      );


    const stores =
      await response.json();


    if (!stores.length) {

      storeInfoEl.innerHTML = `
        <div class="empty error">
          Commerce introuvable ou non publié.
        </div>
      `;

      return;

    }


    const store =
      stores[0];


    const cover =
      store.cover_url ||
      store.logo_url;


    storeInfoEl.innerHTML = `

      <div
        class="store-cover-large"
        ${
          cover
            ? `style="background-image:url('${esc(cover)}');"`
            : ""
        }
      ></div>


      <div class="store-details">

        <h1>
          ${esc(store.name)}
        </h1>


        <p>
          ${
            esc(
              store.description ||
              "Bienvenue dans notre commerce."
            )
          }
        </p>


        <div class="store-location">

          📍 ${
            esc(
              store.address ||
              store.city ||
              "Parakou"
            )
          }

        </div>


        <div class="store-location">

          ${
            store.is_open
              ? "🟢 Commerce ouvert"
              : "🔴 Commerce fermé"
          }

        </div>


        ${
          store.delivery_available
            ? `
              <div class="store-location">
                🚚 Livraison disponible
              </div>
            `
            : ""
        }

      </div>

    `;


    await loadGallery();

    await loadProducts();


  } catch (error) {

    console.error(error);


    storeInfoEl.innerHTML = `
      <div class="empty error">
        Une erreur est survenue.
      </div>
    `;

  }

}


// =====================================================
// GALERIE PHOTOS / VIDEOS
// =====================================================

async function loadGallery() {

  galleryEl.innerHTML = `
    <div class="loading">
      Chargement de la galerie...
    </div>
  `;


  try {

    const response =
      await fetch(

        `${SUPABASE_URL}/rest/v1/store_media?` +
        `select=id,media_type,media_url,title,is_cover,created_at` +
        `&store_id=eq.${encodeURIComponent(storeId)}` +
        `&order=is_cover.desc,created_at.desc`,

        {
          headers
        }

      );


    const media =
      await response.json();


    if (
      !Array.isArray(media) ||
      media.length === 0
    ) {

      galleryEl.innerHTML = `
        <div class="gallery-empty">
          📸 Aucune photo ou vidéo pour le moment.
        </div>
      `;

      return;

    }


    galleryEl.innerHTML =
      media.map(item => {

        const title =
          esc(
            item.title ||
            "Galerie de la boutique"
          );


        // ==========================
        // VIDEO
        // ==========================

        if (
          item.media_type === "video"
        ) {

          return `

            <div class="gallery-item gallery-video">

              <video
                src="${esc(item.media_url)}"
                controls
                playsinline
                preload="metadata"
              ></video>


              <div class="gallery-caption">

                🎥 ${title}

              </div>

            </div>

          `;

        }


        // ==========================
        // PHOTO
        // ==========================

        return `

          <div class="gallery-item">

            <img
              src="${esc(item.media_url)}"
              alt="${title}"
              loading="lazy"
            >


            <div class="gallery-caption">

              📸 ${title}

            </div>

          </div>

        `;

      }).join("");


  } catch (error) {

    console.error(
      "Erreur galerie :",
      error
    );


    galleryEl.innerHTML = `
      <div class="gallery-empty">
        Impossible de charger la galerie.
      </div>
    `;

  }

}


// =====================================================
// PRODUITS
// =====================================================

async function loadProducts() {

  productsEl.innerHTML = `
    <div class="loading">
      Chargement des produits...
    </div>
  `;


  try {

    const response =
      await fetch(

        `${SUPABASE_URL}/rest/v1/products?` +
        `select=id,name,slug,description,price,image_url,is_available` +
        `&store_id=eq.${encodeURIComponent(storeId)}` +
        `&is_available=eq.true` +
        `&order=created_at.desc`,

        {
          headers
        }

      );


    const products =
      await response.json();


    if (!products.length) {

      productsEl.innerHTML = `
        <div class="empty">
          Aucun produit disponible pour le moment.
        </div>
      `;

      return;

    }


    productsEl.innerHTML =
      products.map(product => {

        return `

          <article class="product-card">

            <div class="product-image">

              ${
                product.image_url

                  ? `

                    <img
                      src="${esc(product.image_url)}"
                      alt="${esc(product.name)}"
                    >

                  `

                  : `

                    <div class="product-placeholder">
                      🛍️
                    </div>

                  `
              }

            </div>


            <div class="product-content">

              <h3>
                ${esc(product.name)}
              </h3>


              <p>
                ${
                  esc(
                    product.description ||
                    "Produit disponible."
                  )
                }
              </p>


              <div class="price">

                ${
                  Number(
                    product.price || 0
                  ).toLocaleString("fr-FR")
                }

                FCFA

              </div>


              <button
                class="add-button"
                onclick='addToCart(${
                  JSON.stringify({

                    id: product.id,

                    name:
                      product.name,

                    price:
                      Number(
                        product.price || 0
                      ),

                    image_url:
                      product.image_url ||
                      "",

                    store_id:
                      storeId

                  }).replaceAll(
                    "'",
                    "&#039;"
                  )
                })'
              >

                Ajouter au panier

              </button>

            </div>

          </article>

        `;

      }).join("");


  } catch (error) {

    console.error(error);


    productsEl.innerHTML = `
      <div class="empty error">
        Impossible de charger les produits.
      </div>
    `;

  }

}


// =====================================================
// AJOUT PANIER
// =====================================================

function addToCart(product) {

  let cart =
    JSON.parse(
      localStorage.getItem("pk_cart") || "[]"
    );


  if (
    cart.length &&
    cart[0].store_id !== product.store_id
  ) {

    const replace =
      confirm(
        "Votre panier contient déjà des produits d'un autre commerce. Voulez-vous le remplacer ?"
      );


    if (!replace) {

      return;

    }


    cart = [];

  }


  const existing =
    cart.find(
      item =>
        item.id === product.id
    );


  if (existing) {

    existing.quantity += 1;

  } else {

    cart.push({

      ...product,

      quantity: 1

    });

  }


  localStorage.setItem(
    "pk_cart",
    JSON.stringify(cart)
  );


  updateCartCount();

  showToast(
    "Produit ajouté au panier ✅"
  );

}


// =====================================================
// DEMARRAGE
// =====================================================

updateCartCount();

loadStore();
