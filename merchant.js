const SUPABASE_URL =
  "https://ljzonxmlpygfryfmohhd.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";

const sb =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


let store = null;



// =====================================================
// UTILITAIRES
// =====================================================

const $ = id =>
  document.getElementById(id);


function escapeHTML(value){

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

}


function slug(value){

  return value
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


function message(
  id,
  text,
  success = false
){

  const element = $(id);

  if(!element) return;

  element.innerHTML = `

    <div class="msg ${
      success ? "ok" : "err"
    }">

      ${escapeHTML(text)}

    </div>

  `;

}



// =====================================================
// CREATION DE COMPTE
// =====================================================

$("signupForm").addEventListener(
  "submit",
  async function(event){

    event.preventDefault();


    const email =
      $("signupEmail")
        .value
        .trim();


    const password =
      $("signupPassword")
        .value;


    const {
      data,
      error
    } =
      await sb.auth.signUp({

        email,
        password

      });


    if(error){

      message(
        "signupMsg",
        error.message
      );

      return;

    }


    if(data.session){

      message(
        "signupMsg",
        "Compte créé avec succès.",
        true
      );


      await init();

    }
    else{

      message(
        "signupMsg",
        "Compte créé. Vérifiez votre email si une confirmation est demandée, puis connectez-vous.",
        true
      );

    }

  }
);



// =====================================================
// CONNEXION
// =====================================================

$("loginForm").addEventListener(
  "submit",
  async function(event){

    event.preventDefault();


    const email =
      $("loginEmail")
        .value
        .trim();


    const password =
      $("loginPassword")
        .value;


    const {
      error
    } =
      await sb.auth
        .signInWithPassword({

          email,
          password

        });


    if(error){

      message(
        "loginMsg",
        "Email ou mot de passe incorrect."
      );

      return;

    }


    await init();

  }
);



// =====================================================
// DECONNEXION
// =====================================================

$("logoutBtn").addEventListener(
  "click",
  async function(){

    await sb.auth.signOut();

    location.reload();

  }
);



// =====================================================
// INITIALISATION
// =====================================================

async function init(){

  const {
    data: {
      session
    }
  } =
    await sb.auth.getSession();


  if(!session){

    return;

  }


  $("authSection")
    .classList
    .add("hidden");


  $("logoutBtn")
    .classList
    .remove("hidden");


  const {
    data: owned
  } =
    await sb
      .from("stores")
      .select("id")
      .eq(
        "owner_id",
        session.user.id
      )
      .limit(1);


  if(
    owned &&
    owned.length
  ){

    await loadStore(
      owned[0].id
    );

  }
  else{

    $("claimSection")
      .classList
      .remove("hidden");

  }

}



// =====================================================
// RATTACHER LA BOUTIQUE
// =====================================================

$("claimForm").addEventListener(
  "submit",
  async function(event){

    event.preventDefault();


    const code =
      $("merchantCode")
        .value
        .trim();


    const phone =
      $("merchantPhone")
        .value
        .trim();


    const {
      data,
      error
    } =
      await sb.rpc(
        "claim_merchant_store",
        {
          p_merchant_code:
            code,

          p_phone:
            phone
        }
      );


    if(error){

      message(
        "claimMsg",
        error.message
      );

      return;

    }


    message(
      "claimMsg",
      "Boutique rattachée avec succès !",
      true
    );


    await loadStore(data);

  }
);



// =====================================================
// CHARGER LA BOUTIQUE
// =====================================================

async function loadStore(id){

  const {
    data,
    error
  } =
    await sb
      .from("stores")
      .select("*")
      .eq("id",id)
      .single();


  if(error){

    message(
      "claimMsg",
      error.message
    );

    return;

  }


  store = data;


  $("claimSection")
    .classList
    .add("hidden");


  $("dashboard")
    .classList
    .remove("hidden");


  $("storeName")
    .textContent =
      store.name;


  $("storeInfo")
    .textContent =
      (
        store.city ||
        "Parakou"
      )
      +
      " • "
      +
      (
        store.is_open
          ? "🟢 Ouverte"
          : "🔴 Fermée"
      );


  $("sName").value =
    store.name || "";


  $("sPhone").value =
    store.phone || "";


  $("sWhatsapp").value =
    store.whatsapp || "";


  $("sAddress").value =
    store.address || "";


  $("sDescription").value =
    store.description || "";


  $("sLogo").value =
    store.logo_url || "";


  $("sCover").value =
    store.cover_url || "";


  $("sOpen").checked =
    !!store.is_open;


  $("sDelivery").checked =
    !!store.delivery_available;


  await Promise.all([

    loadProducts(),

    loadMedia(),

    loadOrders()

  ]);

}



// =====================================================
// MODIFIER LA BOUTIQUE
// =====================================================

$("storeForm").addEventListener(
  "submit",
  async function(event){

    event.preventDefault();


    const {
      error
    } =
      await sb
        .from("stores")
        .update({

          name:
            $("sName")
              .value
              .trim(),

          phone:
            $("sPhone")
              .value
              .trim(),

          whatsapp:
            $("sWhatsapp")
              .value
              .trim(),

          address:
            $("sAddress")
              .value
              .trim(),

          description:
            $("sDescription")
              .value
              .trim(),

          logo_url:
            $("sLogo")
              .value
              .trim() ||
            null,

          cover_url:
            $("sCover")
              .value
              .trim() ||
            null,

          is_open:
            $("sOpen")
              .checked,

          delivery_available:
            $("sDelivery")
              .checked

        })
        .eq(
          "id",
          store.id
        );


    if(error){

      message(
        "dashMsg",
        error.message
      );

      return;

    }


    message(
      "dashMsg",
      "Boutique mise à jour.",
      true
    );


    await loadStore(
      store.id
    );

  }
);



// =====================================================
// AJOUT PRODUIT
// =====================================================

$("productForm").addEventListener(
  "submit",
  async function(event){

    event.preventDefault();


    const name =
      $("pName")
        .value
        .trim();


    const {
      error
    } =
      await sb
        .from("products")
        .insert({

          store_id:
            store.id,

          name,

          slug:
            slug(name)
            +
            "-"
            +
            Date.now()
              .toString()
              .slice(-6),

          description:
            $("pDescription")
              .value
              .trim(),

          price:
            Number(
              $("pPrice")
                .value
            ),

          image_url:
            $("pImage")
              .value
              .trim() ||
            null,

          is_available:
            $("pAvailable")
              .checked

        });


    if(error){

      message(
        "dashMsg",
        error.message
      );

      return;

    }


    event.target.reset();


    $("pAvailable")
      .checked = true;


    message(
      "dashMsg",
      "Produit ajouté avec succès.",
      true
    );


    await loadProducts();

  }
);



// =====================================================
// CHARGER PRODUITS
// =====================================================

async function loadProducts(){

  const {
    data,
    error
  } =
    await sb
      .from("products")
      .select("*")
      .eq(
        "store_id",
        store.id
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if(error){

    $("productsList")
      .innerHTML = `

        <div class="msg err">

          ${escapeHTML(
            error.message
          )}

        </div>

      `;

    return;

  }


  if(
    !data ||
    data.length === 0
  ){

    $("productsList")
      .innerHTML =
        "<p>Aucun produit.</p>";

    return;

  }


  $("productsList")
    .innerHTML =
      data.map(
        product => `

          <div class="product">

            <div class="row">

              <strong>

                ${escapeHTML(
                  product.name
                )}

              </strong>

              <span class="price">

                ${Number(
                  product.price
                ).toLocaleString(
                  "fr-FR"
                )}

                FCFA

              </span>

            </div>


            ${
              product.image_url
                ? `

                  <img
                    src="${escapeHTML(
                      product.image_url
                    )}"
                    alt=""
                  >

                `
                : ""
            }


            <p class="small">

              ${escapeHTML(
                product.description ||
                ""
              )}

            </p>


            <div class="actions">

              <button
                class="btn"
                onclick="toggleProduct(
                  '${product.id}',
                  ${!product.is_available}
                )"
              >

                ${
                  product.is_available
                    ? "⏸ Désactiver"
                    : "▶ Activer"
                }

              </button>

            </div>

          </div>

        `
      ).join("");

}



// =====================================================
// ACTIVER / DESACTIVER PRODUIT
// =====================================================

window.toggleProduct =
async function(
  id,
  value
){

  const {
    error
  } =
    await sb
      .from("products")
      .update({

        is_available:
          value

      })
      .eq(
        "id",
        id
      )
      .eq(
        "store_id",
        store.id
      );


  if(error){

    alert(
      error.message
    );

    return;

  }


  await loadProducts();

};



// =====================================================
// UPLOAD MEDIA
// =====================================================

$("mediaForm").addEventListener(
  "submit",
  async function(event){

    event.preventDefault();


    const file =
      $("mediaFile")
        .files[0];


    if(!file){

      return;

    }


    const type =
      $("mediaType")
        .value;


    if(
      (
        type === "image" &&
        !file.type.startsWith(
          "image/"
        )
      )
      ||
      (
        type === "video" &&
        !file.type.startsWith(
          "video/"
        )
      )
    ){

      message(
        "dashMsg",
        "Type de fichier incorrect."
      );

      return;

    }


    const button =
      $("mediaBtn");


    button.disabled = true;

    button.textContent =
      "⏳ Envoi...";


    try{

      const extension =
        file.name
          .split(".")
          .pop()
          .toLowerCase();


      const safeName =
        slug(
          file.name.replace(
            /\.[^/.]+$/,
            ""
          )
        );


      const filePath =
        store.id
        +
        "/"
        +
        Date.now()
        +
        "-"
        +
        safeName
        +
        "."
        +
        extension;


      const {
        error: uploadError
      } =
        await sb
          .storage
          .from("store-media")
          .upload(
            filePath,
            file,
            {
              upsert:false,
              contentType:file.type
            }
          );


      if(uploadError){

        throw uploadError;

      }


      const {
        data:
          publicData
      } =
        sb
          .storage
          .from("store-media")
          .getPublicUrl(
            filePath
          );


      const publicUrl =
        publicData.publicUrl;


      const isCover =
        $("mediaCover")
          .checked;


      if(isCover){

        await sb
          .from("store_media")
          .update({
            is_cover:false
          })
          .eq(
            "store_id",
            store.id
          );


        await sb
          .from("stores")
          .update({
            cover_url:
              publicUrl
          })
          .eq(
            "id",
            store.id
          );

      }


      const {
        error:
          mediaError
      } =
        await sb
          .from("store_media")
          .insert({

            store_id:
              store.id,

            media_type:
              type,

            media_url:
              publicUrl,

            title:
              $("mediaTitle")
                .value
                .trim() ||
              null,

            is_cover:
              isCover

          });


      if(mediaError){

        throw mediaError;

      }


      event.target.reset();


      message(
        "dashMsg",
        "Média ajouté avec succès.",
        true
      );


      await loadMedia();


    }
    catch(error){

      message(
        "dashMsg",
        error.message ||
        "Erreur pendant l'envoi."
      );

    }


    button.disabled = false;

    button.textContent =
      "📤 Envoyer";

  }
);



// =====================================================
// CHARGER MEDIAS
// =====================================================

async function loadMedia(){

  const {
    data,
    error
  } =
    await sb
      .from("store_media")
      .select("*")
      .eq(
        "store_id",
        store.id
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if(error){

    $("mediaList")
      .innerHTML = `

        <div class="msg err">

          ${escapeHTML(
            error.message
          )}

        </div>

      `;

    return;

  }


  if(
    !data ||
    data.length === 0
  ){

    $("mediaList")
      .innerHTML =
        "<p>Aucun média.</p>";

    return;

  }


  $("mediaList")
    .innerHTML =
      data.map(
        media => `

          <div class="product">

            ${
              media.media_type === "video"

                ? `

                  <video
                    src="${escapeHTML(
                      media.media_url
                    )}"
                    controls
                  ></video>

                `

                : `

                  <img
                    src="${escapeHTML(
                      media.media_url
                    )}"
                    style="
                      width:100%;
                      max-height:250px;
                      object-fit:cover;
                      border-radius:12px;
                    "
                  >

                `
            }


            <p>

              <strong>

                ${escapeHTML(
                  media.title ||
                  "Sans titre"
                )}

              </strong>

              ${
                media.is_cover
                  ? " ⭐"
                  : ""
              }

            </p>

          </div>

        `
      ).join("");

}



// =====================================================
// COMMANDES
// =====================================================

async function loadOrders(){

  const {
    data,
    error
  } =
    await sb
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        total,
        delivery_address,
        payment_method,
        created_at,

        customers (
          full_name,
          phone
        ),

        order_items (
          product_name,
          quantity,
          line_total
        )

      `)
      .eq(
        "store_id",
        store.id
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      )
      .limit(50);


  if(error){

    $("ordersList")
      .innerHTML = `

        <div class="msg err">

          ${escapeHTML(
            error.message
          )}

        </div>

      `;

    return;

  }


  if(
    !data ||
    data.length === 0
  ){

    $("ordersList")
      .innerHTML =
        "<p>Aucune commande.</p>";

    return;

  }


  $("ordersList")
    .innerHTML =
      data.map(
        order => `

          <div class="order">

            <div class="row">

              <strong>

                📦 #${order.order_number}

              </strong>


              <span class="price">

                ${Number(
                  order.total
                ).toLocaleString(
                  "fr-FR"
                )}

                FCFA

              </span>

            </div>


            <p>

              👤 ${escapeHTML(
                order.customers?.full_name ||
                "Client"
              )}

              <br>

              📞 ${escapeHTML(
                order.customers?.phone ||
                ""
              )}

            </p>


            <p>

              📍 ${escapeHTML(
                order.delivery_address ||
                ""
              )}

              <br>

              💳 ${escapeHTML(
                order.payment_method ||
                ""
              )}

            </p>


            <p class="small">

              ${new Date(
                order.created_at
              ).toLocaleString(
                "fr-FR"
              )}

            </p>


            <select
              onchange="
                updateOrder(
                  '${order.id}',
                  this.value
                )
              "
            >

              ${orderStatusOptions(
                order.status
              )}

            </select>


            <div class="small">

              ${
                (order.order_items || [])
                  .map(
                    item =>
                      escapeHTML(
                        item.product_name
                      )
                      +
                      " × "
                      +
                      item.quantity
                  )
                  .join(" • ")
              }

            </div>

          </div>

        `
      ).join("");

}



function orderStatusOptions(
  current
){

  const statuses = [

    ["pending","En attente"],

    ["confirmed","Confirmée"],

    ["preparing","En préparation"],

    ["ready","Prête"],

    ["out_for_delivery","En livraison"],

    ["delivered","Livrée"],

    ["cancelled","Annulée"]

  ];


  return statuses
    .map(
      status => `

        <option
          value="${status[0]}"
          ${
            status[0] === current
              ? "selected"
              : ""
          }
        >

          ${status[1]}

        </option>

      `
    )
    .join("");

}



window.updateOrder =
async function(
  id,
  status
){

  const {
    error
  } =
    await sb
      .from("orders")
      .update({
        status
      })
      .eq(
        "id",
        id
      )
      .eq(
        "store_id",
        store.id
      );


  if(error){

    alert(
      error.message
    );

    return;

  }


  await loadOrders();

};



// =====================================================
// DEMARRAGE
// =====================================================

init();
