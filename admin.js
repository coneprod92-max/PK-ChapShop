const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// =====================================================
// ELEMENTS
// =====================================================

const loginSection = document.getElementById("loginSection");
const dashboard = document.getElementById("dashboard");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

const logoutButton = document.getElementById("logoutButton");

const ordersList = document.getElementById("ordersList");
const ordersMessage = document.getElementById("ordersMessage");
const refreshOrders = document.getElementById("refreshOrders");

const statOrders = document.getElementById("statOrders");
const statPending = document.getElementById("statPending");
const statDelivered = document.getElementById("statDelivered");
const statStores = document.getElementById("statStores");

const storeForm = document.getElementById("storeForm");
const storeMessage = document.getElementById("storeMessage");
const storesList = document.getElementById("storesList");
const storeCategory = document.getElementById("storeCategory");

const productForm = document.getElementById("productForm");
const productMessage = document.getElementById("productMessage");
const productsList = document.getElementById("productsList");
const productStore = document.getElementById("productStore");

const mediaForm = document.getElementById("mediaForm");
const mediaMessage = document.getElementById("mediaMessage");
const mediaList = document.getElementById("mediaList");
const mediaStore = document.getElementById("mediaStore");


// =====================================================
// MESSAGES
// =====================================================

function showLoginMessage(message, success = false) {

  loginMessage.innerHTML = `
    <div class="${success ? "admin-success" : "admin-error"}">
      ${message}
    </div>
  `;

}


function showStoreMessage(message, success = false) {

  storeMessage.innerHTML = `
    <div class="${success ? "admin-success" : "admin-error"}">
      ${message}
    </div>
  `;

}


function showProductMessage(message, success = false) {

  productMessage.innerHTML = `
    <div class="${success ? "admin-success" : "admin-error"}">
      ${message}
    </div>
  `;

}


function showMediaMessage(message, success = false) {

  mediaMessage.innerHTML = `
    <div class="${success ? "admin-success" : "admin-error"}">
      ${message}
    </div>
  `;

}


// =====================================================
// AFFICHAGE
// =====================================================

function showLogin() {

  loginSection.classList.remove("admin-hidden");

  dashboard.classList.add("admin-hidden");

}


function showDashboard() {

  loginSection.classList.add("admin-hidden");

  dashboard.classList.remove("admin-hidden");

}


// =====================================================
// VERIFICATION ADMIN
// =====================================================

async function checkAdmin() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();


  if (!session) {

    showLogin();

    return false;

  }


  const {
    data,
    error
  } = await supabaseClient.rpc("is_admin");


  if (error || data !== true) {

    await supabaseClient.auth.signOut();

    showLoginMessage(
      "⛔ Ce compte n'a pas accès à l'administration."
    );

    showLogin();

    return false;

  }


  showDashboard();

  await loadEverything();

  return true;

}


// =====================================================
// CONNEXION
// =====================================================

loginForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();


    const email =
      document.getElementById("adminEmail")
        .value.trim();

    const password =
      document.getElementById("adminPassword")
        .value;


    loginMessage.innerHTML = "";


    const {
      error
    } = await supabaseClient.auth.signInWithPassword({

      email,
      password

    });


    if (error) {

      showLoginMessage(
        "❌ Email ou mot de passe incorrect."
      );

      return;

    }


    await checkAdmin();

  }
);


// =====================================================
// DECONNEXION
// =====================================================

logoutButton.addEventListener(
  "click",
  async function() {

    await supabaseClient.auth.signOut();

    showLogin();

    showLoginMessage(
      "Vous êtes maintenant déconnecté.",
      true
    );

  }
);


// =====================================================
// CHARGEMENT GLOBAL
// =====================================================

async function loadEverything() {

  await loadOrders();

  await loadCategories();

  await loadStores();

  await loadProducts();

}


// =====================================================
// COMMANDES
// =====================================================

async function loadOrders() {

  ordersMessage.innerHTML =
    "<p>Chargement des commandes...</p>";

  ordersList.innerHTML = "";


  const {
    data: orders,
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
        ❌ ${escapeHTML(error.message)}
      </div>
    `;

    return;

  }


  ordersMessage.innerHTML = "";

  updateStats(orders || []);


  if (!orders || orders.length === 0) {

    ordersList.innerHTML =
      "<p>Aucune commande pour le moment.</p>";

    return;

  }


  orders.forEach(order => {

    ordersList.appendChild(
      createOrderCard(order)
    );

  });

}


// =====================================================
// STATISTIQUES
// =====================================================

function updateStats(orders) {

  statOrders.textContent =
    orders.length;


  statPending.textContent =
    orders.filter(
      order => order.status === "pending"
    ).length;


  statDelivered.textContent =
    orders.filter(
      order => order.status === "delivered"
    ).length;

}


// =====================================================
// CARTE COMMANDE
// =====================================================

function createOrderCard(order) {

  const customer =
    order.customers || {};

  const store =
    order.stores || {};


  const card =
    document.createElement("div");

  card.className = "item-row";


  const date =
    new Date(order.created_at)
      .toLocaleString("fr-FR");


  card.innerHTML = `

    <div class="item-head">

      <div class="item-title">
        📦 Commande #${order.order_number}
      </div>

      <strong>
        ${Number(order.total)
          .toLocaleString("fr-FR")} FCFA
      </strong>

    </div>


    <div class="item-meta">

      👤 ${escapeHTML(
        customer.full_name || "Client"
      )}

      <br>

      📞 ${escapeHTML(
        customer.phone || "Non renseigné"
      )}

      <br>

      🏪 ${escapeHTML(
        store.name || "Boutique"
      )}

      <br>

      📍 ${escapeHTML(
        order.delivery_address ||
        "Adresse non renseignée"
      )}

      <br>

      💳 ${escapeHTML(
        order.payment_method ||
        "Non renseigné"
      )}

      <br>

      🕒 ${date}

    </div>


    <div class="status-line">

      <select class="order-status">

        ${statusOption(
          "pending",
          "En attente",
          order.status
        )}

        ${statusOption(
          "confirmed",
          "Confirmée",
          order.status
        )}

        ${statusOption(
          "preparing",
          "En préparation",
          order.status
        )}

        ${statusOption(
          "ready",
          "Prête",
          order.status
        )}

        ${statusOption(
          "out_for_delivery",
          "En livraison",
          order.status
        )}

        ${statusOption(
          "delivered",
          "Livrée",
          order.status
        )}

        ${statusOption(
          "cancelled",
          "Annulée",
          order.status
        )}

      </select>


      <button class="admin-button update-order">
        💾 Mettre à jour
      </button>

    </div>

  `;


  const select =
    card.querySelector(".order-status");

  const button =
    card.querySelector(".update-order");


  button.addEventListener(
    "click",
    async function() {

      await updateOrderStatus(
        order.id,
        select.value,
        button
      );

    }
  );


  return card;

}


// =====================================================
// OPTIONS STATUT
// =====================================================

function statusOption(
  value,
  label,
  current
) {

  return `
    <option
      value="${value}"
      ${value === current ? "selected" : ""}
    >
      ${label}
    </option>
  `;

}


// =====================================================
// MODIFIER STATUT COMMANDE
// =====================================================

async function updateOrderStatus(
  orderId,
  newStatus,
  button
) {

  button.disabled = true;

  button.textContent =
    "Enregistrement...";


  const {
    error
  } = await supabaseClient
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


  await loadOrders();


  setTimeout(() => {

    button.disabled = false;

    button.textContent =
      "💾 Mettre à jour";

  }, 1000);

}


// =====================================================
// CATEGORIES
// =====================================================

async function loadCategories() {

  const {
    data,
    error
  } = await supabaseClient
    .from("store_categories")
    .select("id,name")
    .order("name");


  if (error) {

    console.error(
      "Erreur catégories :",
      error
    );

    return;

  }


  storeCategory.innerHTML =
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

    storeCategory.appendChild(option);

  });

}


// =====================================================
// BOUTIQUES
// =====================================================

async function loadStores() {

  storesList.innerHTML =
    "Chargement des boutiques...";


  const {
    data: stores,
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
      is_open,
      is_published,
      delivery_available,
      category_id
    `)
    .order("created_at", {
      ascending: false
    });


  if (error) {

    console.error(
      "Erreur boutiques :",
      error
    );


    storesList.innerHTML = `
      <div class="admin-error">
        ❌ ${escapeHTML(error.message)}
      </div>
    `;

    return;

  }


  statStores.textContent =
    stores.length;


  // ===============================
  // LISTE BOUTIQUE POUR PRODUITS
  // ===============================

  productStore.innerHTML = `
    <option value="">
      Choisir une boutique
    </option>
  `;


  // ===============================
  // LISTE BOUTIQUE POUR MEDIA
  // ===============================

  mediaStore.innerHTML = `
    <option value="">
      Choisir une boutique
    </option>
  `;


  stores.forEach(store => {

    const option =
      document.createElement("option");

    option.value =
      store.id;

    option.textContent =
      store.name;


    productStore.appendChild(
      option.cloneNode(true)
    );


    mediaStore.appendChild(
      option
    );

  });


  // ===============================
  // AFFICHAGE DES BOUTIQUES
  // ===============================

  if (stores.length === 0) {

    storesList.innerHTML =
      "<p>Aucune boutique.</p>";

    return;

  }


  storesList.innerHTML = "";


  stores.forEach(store => {

    const card =
      document.createElement("div");

    card.className =
      "item-row";


    card.innerHTML = `

      <div class="item-head">

        <div class="item-title">

          🏪 ${escapeHTML(
            store.name
          )}

        </div>


        <strong>

          ${
            store.is_published
              ? "🟢 Publiée"
              : "⚪ Brouillon"
          }

        </strong>

      </div>


      <div class="item-meta">

        📍 ${escapeHTML(
          store.address ||
          store.city ||
          "Adresse non renseignée"
        )}

        <br>

        📞 ${escapeHTML(
          store.phone ||
          "Non renseigné"
        )}

        <br>

        🚚 ${
          store.delivery_available
            ? "Livraison disponible"
            : "Pas de livraison"
        }

      </div>


      <div class="status-line">

        <button
          class="admin-button toggle-store"
        >

          ${
            store.is_published
              ? "⏸ Dépublier"
              : "🚀 Publier"
          }

        </button>

      </div>

    `;


    card
      .querySelector(
        ".toggle-store"
      )
      .addEventListener(
        "click",
        () => toggleStore(store)
      );


    storesList.appendChild(card);

  });

}


// =====================================================
// CREER UNE BOUTIQUE
// =====================================================

storeForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();


    const name =
      document.getElementById(
        "storeName"
      ).value.trim();


    if (!storeCategory.value) {

      showStoreMessage(
        "❌ Choisis une catégorie."
      );

      return;

    }


    const {
      error
    } = await supabaseClient
      .from("stores")
      .insert({

        name: name,

        slug:
          makeSlug(name),

        category_id:
          storeCategory.value,

        description:
          document.getElementById(
            "storeDescription"
          ).value.trim(),

        phone:
          document.getElementById(
            "storePhone"
          ).value.trim(),

        whatsapp:
          document.getElementById(
            "storeWhatsapp"
          ).value.trim(),

        address:
          document.getElementById(
            "storeAddress"
          ).value.trim(),

        city: "Parakou",

        logo_url:
          document.getElementById(
            "storeLogo"
          ).value.trim() || null,

        cover_url:
          document.getElementById(
            "storeCover"
          ).value.trim() || null,

        is_open: true,

        is_published: true,

        delivery_available:
          document.getElementById(
            "storeDelivery"
          ).checked

      });


    if (error) {

      showStoreMessage(
        "❌ " + error.message
      );

      return;

    }


    showStoreMessage(
      "✅ Boutique créée avec succès.",
      true
    );


    storeForm.reset();


    document.getElementById(
      "storeDelivery"
    ).checked = true;


    await loadStores();

  }
);


// =====================================================
// PUBLIER / DEPUBLIER
// =====================================================

async function toggleStore(store) {

  const {
    error
  } = await supabaseClient
    .from("stores")
    .update({

      is_published:
        !store.is_published

    })
    .eq(
      "id",
      store.id
    );


  if (error) {

    alert(
      "Erreur : " + error.message
    );

    return;

  }


  await loadStores();

}


// =====================================================
// PRODUITS
// =====================================================

async function loadProducts() {

  productsList.innerHTML =
    "Chargement des produits...";


  const {
    data: products,
    error
  } = await supabaseClient
    .from("products")
    .select(`
      id,
      name,
      slug,
      description,
      price,
      image_url,
      is_available,
      stores (
        name
      )
    `)
    .order("created_at", {
      ascending: false
    });


  if (error) {

    productsList.innerHTML = `
      <div class="admin-error">
        ❌ ${escapeHTML(
          error.message
        )}
      </div>
    `;

    return;

  }


  if (!products.length) {

    productsList.innerHTML =
      "<p>Aucun produit.</p>";

    return;

  }


  productsList.innerHTML = "";


  products.forEach(product => {

    const card =
      document.createElement("div");

    card.className =
      "item-row";


    card.innerHTML = `

      <div class="item-head">

        <div class="item-title">

          📦 ${escapeHTML(
            product.name
          )}

        </div>


        <strong>

          ${Number(
            product.price
          ).toLocaleString(
            "fr-FR"
          )}

          FCFA

        </strong>

      </div>


      <div class="item-meta">

        🏪 ${escapeHTML(
          product.stores?.name ||
          "Boutique"
        )}

        <br>

        ${
          product.is_available
            ? "🟢 Disponible"
            : "🔴 Indisponible"
        }

      </div>


      <div class="status-line">

        <button
          class="admin-button toggle-product"
        >

          ${
            product.is_available
              ? "⏸ Indisponible"
              : "▶ Disponible"
          }

        </button>

      </div>

    `;


    card
      .querySelector(
        ".toggle-product"
      )
      .addEventListener(
        "click",
        () => toggleProduct(product)
      );


    productsList.appendChild(card);

  });

}


// =====================================================
// AJOUTER PRODUIT
// =====================================================

productForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();


    if (!productStore.value) {

      showProductMessage(
        "❌ Choisis une boutique."
      );

      return;

    }


    const name =
      document.getElementById(
        "productName"
      ).value.trim();


    const {
      error
    } = await supabaseClient
      .from("products")
      .insert({

        store_id:
          productStore.value,

        name: name,

        slug:
          makeSlug(name),

        description:
          document.getElementById(
            "productDescription"
          ).value.trim(),

        price:
          Number(
            document.getElementById(
              "productPrice"
            ).value
          ),

        image_url:
          document.getElementById(
            "productImage"
          ).value.trim() || null,

        is_available:
          document.getElementById(
            "productAvailable"
          ).checked

      });


    if (error) {

      showProductMessage(
        "❌ " + error.message
      );

      return;

    }


    showProductMessage(
      "✅ Produit ajouté avec succès.",
      true
    );


    productForm.reset();


    document.getElementById(
      "productAvailable"
    ).checked = true;


    await loadProducts();

  }
);


// =====================================================
// DISPONIBILITE PRODUIT
// =====================================================

async function toggleProduct(product) {

  const {
    error
  } = await supabaseClient
    .from("products")
    .update({

      is_available:
        !product.is_available

    })
    .eq(
      "id",
      product.id
    );


  if (error) {

    alert(
      "Erreur : " + error.message
    );

    return;

  }


  await loadProducts();

}


// =====================================================
// CHANGEMENT DE BOUTIQUE POUR MEDIA
// =====================================================

mediaStore.addEventListener(
  "change",
  async function() {

    if (!mediaStore.value) {

      mediaList.innerHTML =
        "Choisis une boutique pour voir ses médias.";

      return;

    }


    await loadStoreMedia(
      mediaStore.value
    );

  }
);


// =====================================================
// CHARGER LES MEDIAS
// =====================================================

async function loadStoreMedia(storeId) {

  mediaList.innerHTML =
    "Chargement des médias...";


  const {
    data: media,
    error
  } = await supabaseClient
    .from("store_media")
    .select(`
      id,
      media_type,
      media_url,
      title,
      is_cover,
      created_at
    `)
    .eq(
      "store_id",
      storeId
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    );


  if (error) {

    mediaList.innerHTML = `
      <div class="admin-error">
        ❌ ${escapeHTML(
          error.message
        )}
      </div>
    `;

    return;

  }


  if (
    !media ||
    media.length === 0
  ) {

    mediaList.innerHTML =
      "<p>Aucun média pour cette boutique.</p>";

    return;

  }


  const container =
    document.createElement("div");

  container.className =
    "media-preview";


  media.forEach(item => {

    const card =
      document.createElement("div");

    card.className =
      "media-item";


    let visual = "";


    if (
      item.media_type === "video"
    ) {

      visual = `

        <video
          src="${escapeHTML(
            item.media_url
          )}"
          controls
          preload="metadata"
        ></video>

      `;

    } else {

      visual = `

        <img
          src="${escapeHTML(
            item.media_url
          )}"
          alt="${escapeHTML(
            item.title ||
            "Photo boutique"
          )}"
        >

      `;

    }


    card.innerHTML = `

      ${visual}


      <div class="media-info">

        <strong>

          ${escapeHTML(
            item.title ||
            "Sans titre"
          )}

        </strong>


        <br>


        ${
          item.media_type === "video"
            ? "🎥 Vidéo"
            : "📸 Photo"
        }


        ${
          item.is_cover
            ? `
              <br>

              <span class="media-cover">
                ⭐ Couverture
              </span>
            `
            : ""
        }


        <br><br>


        <button
          class="admin-button danger delete-media"
        >

          🗑️ Supprimer

        </button>

      </div>

    `;


    card
      .querySelector(
        ".delete-media"
      )
      .addEventListener(
        "click",
        () => deleteMedia(item)
      );


    container.appendChild(card);

  });


  mediaList.innerHTML = "";

  mediaList.appendChild(
    container
  );

}


// =====================================================
// UPLOAD PHOTO / VIDEO
// =====================================================

mediaForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();


    const storeId =
      mediaStore.value;


    const type =
      document.getElementById(
        "mediaType"
      ).value;


    const title =
      document.getElementById(
        "mediaTitle"
      ).value.trim();


    const fileInput =
      document.getElementById(
        "mediaFile"
      );


    const file =
      fileInput.files[0];


    const isCover =
      document.getElementById(
        "mediaCover"
      ).checked;


    if (!storeId) {

      showMediaMessage(
        "❌ Choisis une boutique."
      );

      return;

    }


    if (!file) {

      showMediaMessage(
        "❌ Choisis un fichier."
      );

      return;

    }


    if (
      isCover &&
      !file.type.startsWith(
        "image/"
      )
    ) {

      showMediaMessage(
        "❌ La couverture doit être une photo."
      );

      return;

    }


    if (
      type === "image" &&
      !file.type.startsWith(
        "image/"
      )
    ) {

      showMediaMessage(
        "❌ Le fichier sélectionné n'est pas une image."
      );

      return;

    }


    if (
      type === "video" &&
      !file.type.startsWith(
        "video/"
      )
    ) {

      showMediaMessage(
        "❌ Le fichier sélectionné n'est pas une vidéo."
      );

      return;

    }


    const maxImageSize =
      10 * 1024 * 1024;


    const maxVideoSize =
      100 * 1024 * 1024;


    if (
      type === "image" &&
      file.size > maxImageSize
    ) {

      showMediaMessage(
        "❌ Photo trop lourde. Maximum : 10 Mo."
      );

      return;

    }


    if (
      type === "video" &&
      file.size > maxVideoSize
    ) {

      showMediaMessage(
        "❌ Vidéo trop lourde. Maximum : 100 Mo."
      );

      return;

    }


    const button =
      document.getElementById(
        "uploadMediaButton"
      );


    button.disabled = true;

    button.textContent =
      "⏳ Envoi en cours...";


    try {

      const extension =
        file.name
          .split(".")
          .pop()
          .toLowerCase();


      const safeName =
        makeSlug(
          file.name.replace(
            /\.[^/.]+$/,
            ""
          )
        ) ||
        "media";


      const filePath =
        `${storeId}/${Date.now()}-${safeName}.${extension}`;


      // =========================
      // STORAGE
      // =========================

      const {
        error: uploadError
      } = await supabaseClient
        .storage
        .from("store-media")
        .upload(
          filePath,
          file,
          {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
          }
        );


      if (uploadError) {

        throw uploadError;

      }


      // =========================
      // URL PUBLIQUE
      // =========================

      const {
        data: publicUrlData
      } = supabaseClient
        .storage
        .from("store-media")
        .getPublicUrl(
          filePath
        );


      const publicUrl =
        publicUrlData.publicUrl;


      // =========================
      // COUVERTURE
      // =========================

      if (isCover) {

        await supabaseClient
          .from("store_media")
          .update({
            is_cover: false
          })
          .eq(
            "store_id",
            storeId
          );


        await supabaseClient
          .from("stores")
          .update({
            cover_url: publicUrl
          })
          .eq(
            "id",
            storeId
          );

      }


      // =========================
      // BASE DE DONNEES
      // =========================

      const {
        error: mediaError
      } = await supabaseClient
        .from("store_media")
        .insert({

          store_id:
            storeId,

          media_type:
            type,

          media_url:
            publicUrl,

          title:
            title || null,

          is_cover:
            isCover

        });


      if (mediaError) {

        await supabaseClient
          .storage
          .from("store-media")
          .remove([
            filePath
          ]);


        throw mediaError;

      }


      showMediaMessage(
        "✅ Média ajouté avec succès.",
        true
      );


      mediaForm.reset();


      await loadStoreMedia(
        storeId
      );

    }

    catch (error) {

      console.error(
        "Erreur upload :",
        error
      );


      showMediaMessage(
        "❌ " +
        (
          error.message ||
          "Erreur pendant l'envoi."
        )
      );

    }


    button.disabled = false;

    button.textContent =
      "📤 Envoyer le média";

  }
);


// =====================================================
// SUPPRIMER MEDIA
// =====================================================

async function deleteMedia(media) {

  const confirmed =
    confirm(
      "Supprimer définitivement ce média ?"
    );


  if (!confirmed) {

    return;

  }


  const {
    error
  } = await supabaseClient
    .from("store_media")
    .delete()
    .eq(
      "id",
      media.id
    );


  if (error) {

    alert(
      "Erreur : " +
      error.message
    );

    return;

  }


  try {

    const marker =
      "/store-media/";


    const index =
      media.media_url.indexOf(
        marker
      );


    if (index !== -1) {

      const filePath =
        decodeURIComponent(
          media.media_url.substring(
            index + marker.length
          )
        );


      await supabaseClient
        .storage
        .from("store-media")
        .remove([
          filePath
        ]);

    }

  }

  catch (error) {

    console.log(
      "Nettoyage Storage :",
      error
    );

  }


  await loadStoreMedia(
    mediaStore.value
  );

}


// =====================================================
// SLUG
// =====================================================

function makeSlug(text) {

  return text
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


// =====================================================
// SECURITE HTML
// =====================================================

function escapeHTML(value) {

  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


// =====================================================
// ACTUALISER COMMANDES
// =====================================================

refreshOrders.addEventListener(
  "click",
  loadOrders
);


// =====================================================
// DEMARRAGE
// =====================================================

checkAdmin();
