const SUPABASE_URL =
  "https://ljzonxmlpygfryfmohhd.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";


const form =
  document.getElementById("advertiserForm");

const message =
  document.getElementById("formMessage");

const cartCount =
  document.getElementById("cartCount");


// =====================================================
// COMPTEUR PANIER
// =====================================================

function updateCartCount() {

  const cart =
    JSON.parse(
      localStorage.getItem("pk_cart") || "[]"
    );

  const count =
    cart.reduce(
      (total, item) =>
        total + Number(item.quantity || 0),
      0
    );

  cartCount.textContent = count;

}


// =====================================================
// ENVOI DE LA DEMANDE
// =====================================================

form.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();


    message.className =
      "form-message";

    message.style.display =
      "block";

    message.textContent =
      "⏳ Envoi de votre demande...";


    const payload = {

      full_name:
        document
          .getElementById("fullName")
          .value
          .trim(),

      business_name:
        document
          .getElementById("businessName")
          .value
          .trim(),

      category:
        document
          .getElementById("category")
          .value,

      phone:
        document
          .getElementById("phone")
          .value
          .trim(),

      whatsapp:
        document
          .getElementById("whatsapp")
          .value
          .trim(),

      city:
        document
          .getElementById("city")
          .value
          .trim(),

      address:
        document
          .getElementById("address")
          .value
          .trim(),

      description:
        document
          .getElementById("description")
          .value
          .trim(),

      goal:
        document
          .getElementById("goal")
          .value
          .trim()

    };


    try {

      const response =
        await fetch(

          SUPABASE_URL +
          "/rest/v1/advertiser_applications",

          {

            method: "POST",

            headers: {

              apikey:
                SUPABASE_KEY,

              Authorization:
                "Bearer " +
                SUPABASE_KEY,

              "Content-Type":
                "application/json",

              Prefer:
                "return=minimal"

            },

            body:
              JSON.stringify(payload)

          }

        );


      if (!response.ok) {

        const errorText =
          await response.text();

        throw new Error(
          errorText ||
          "Impossible d'envoyer la demande."
        );

      }


      // ==========================
      // SUCCÈS
      // ==========================

      form.reset();


      document
        .getElementById("city")
        .value =
        "Parakou";


      message.className =
        "form-message success";

      message.textContent =
        "✅ Votre demande a bien été envoyée ! " +
        "Notre équipe vous contactera prochainement.";


    } catch (error) {

      console.error(
        "Erreur annonceur :",
        error
      );


      message.className =
        "form-message error";

      message.textContent =
        "❌ Impossible d'envoyer votre demande " +
        "pour le moment. Veuillez réessayer.";

    }

  }
);


// =====================================================
// INITIALISATION
// =====================================================

updateCartCount();
