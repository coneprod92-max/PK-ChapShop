const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null, currentStoreId = null, currentStoreCity = null, editingProductId = null;
const $ = id => document.getElementById(id);
document.addEventListener("DOMContentLoaded", async () => {
  $("loginForm")?.addEventListener("submit", handleLogin);
  $("logoutButton")?.addEventListener("click", logout);
  $("refreshOrders")?.addEventListener("click", loadOrders);
  $("refreshAdvertisers")?.addEventListener("click", loadAdvertiserApplications);
  $("refreshStores")?.addEventListener("click", loadStores);
  // Gestion des boutons de boutique par délégation : plus fiable que onclick inline.
  $("storesList")?.addEventListener("click", async event => {
    const button = event.target.closest("button[data-store-action]");
    if (!button) return;
    event.preventDefault();
    const id = button.dataset.storeId;
    if (!id) return alert("Identifiant de boutique introuvable.");
    if (button.dataset.storeAction === "edit") await editStore(id);
    if (button.dataset.storeAction === "whatsapp") await resendMerchantCode(id);
    if (button.dataset.storeAction === "delete") await deleteStore(id, button.dataset.storeName || "cette boutique");
  });
  $("orderFilter")?.addEventListener("change", loadOrders);
  $("storeForm")?.addEventListener("submit", handleStoreSubmit);
  $("productForm")?.addEventListener("submit", handleProductSubmit);
  $("mediaForm")?.addEventListener("submit", handleMediaUpload);
  $("mediaStore")?.addEventListener("change", e => loadGallery(e.target.value));
  $("productStore")?.addEventListener("change", e => loadProducts(e.target.value));
  $("cancelStoreEdit")?.addEventListener("click", resetStoreForm);
  $("cancelProductEdit")?.addEventListener("click", resetProductForm);
  showLogin();
  try { const {data,error}=await supabaseClient.auth.getSession(); if(error) throw error; if(data?.session){currentUser=data.session.user;await openAdmin();} }
  catch(e){console.error(e);showLogin("Erreur d'initialisation : "+e.message);}
});
function showLogin(msg=""){ $("loginSection")?.classList.remove("admin-hidden");$("dashboard")?.classList.add("admin-hidden");$("loginMessage").innerHTML=msg?`<div class="admin-error">${esc(msg)}</div>`:""; }
function showDashboard(){ $("loginSection")?.classList.add("admin-hidden");$("dashboard")?.classList.remove("admin-hidden"); }
async function handleLogin(e){e.preventDefault();const button=document.querySelector('#loginForm button[type="submit"]');if(button){button.disabled=true;button.textContent="Connexion...";}try{const {data,error}=await supabaseClient.auth.signInWithPassword({email:$("adminEmail").value.trim(),password:$("adminPassword").value});if(error)throw error;currentUser=data.user;await openAdmin();}catch(e){showLogin("Échec de connexion : "+e.message);}finally{if(button){button.disabled=false;button.textContent="🔐 Se connecter";}}}
async function checkAdmin(){const {data,error}=await supabaseClient.auth.getSession();if(error)throw error;if(!data?.session)return false;currentUser=data.session.user;const r=await supabaseClient.rpc("is_admin");if(r.error)throw r.error;return r.data===true;}
async function openAdmin(){try{if(!await checkAdmin()){await supabaseClient.auth.signOut();return showLogin("Ce compte n'a pas les droits administrateur.");}showDashboard();await Promise.allSettled([loadStats(),loadOrders(),loadCategories(),loadStores(),loadAdvertiserApplications()]);}catch(e){console.error(e);showLogin(e.message||"Impossible d'ouvrir le tableau de bord.");}}
async function logout(){const {error}=await supabaseClient.auth.signOut();if(error)return alert(error.message);currentUser=null;showLogin("Vous êtes déconnecté.");}
async function loadStats(){try{const [a,b,c,d]=await Promise.all([supabaseClient.from("orders").select("id",{count:"exact",head:true}),supabaseClient.from("orders").select("id",{count:"exact",head:true}).eq("status","pending"),supabaseClient.from("orders").select("id",{count:"exact",head:true}).eq("status","delivered"),supabaseClient.from("stores").select("id",{count:"exact",head:true})]);[a,b,c,d].forEach(r=>{if(r.error)throw r.error;});[["statOrders",a.count],["statPending",b.count],["statDelivered",c.count],["statStores",d.count]].forEach(([id,n])=>{if($(id))$(id).textContent=n||0;});}catch(e){console.error("Statistiques",e);}}

// COMMANDES : fonctions au niveau global pour que les boutons des cartes puissent les appeler.
async function loadOrders(){const box=$("ordersList");if(!box)return;box.textContent="Chargement des commandes...";try{let q=supabaseClient.from("orders").select("id,order_number,status,payment_method,total,delivery_address,customer_note,created_at,archived_at,customers(full_name,phone),stores(name),deliveries(driver_name,driver_phone,status,current_location,estimated_minutes)").order("created_at",{ascending:false});const f=$("orderFilter")?.value||"active";if(f==="active")q=q.is("archived_at",null);else if(f==="archived")q=q.not("archived_at","is",null);else if(f!=="all")q=q.eq("status",f).is("archived_at",null);const {data,error}=await q;if(error)throw error;box.innerHTML="";if(!data?.length){box.textContent="Aucune commande dans cette catégorie.";return;}data.forEach(o=>{const c=o.customers||{},s=o.stores||{},d=Array.isArray(o.deliveries)?o.deliveries[0]||{}:o.deliveries||{},arch=!!o.archived_at,el=document.createElement("article");el.className="item-row";el.innerHTML=`<div class="item-head"><strong>Commande #${esc(o.order_number||o.id)}</strong><strong>${price(o.total)}</strong></div>${arch?'<p class="admin-success">Commande archivée</p>':""}<div class="item-meta">Client : ${esc(c.full_name||"-")}<br>Téléphone : ${esc(c.phone||"-")}<br>Boutique : ${esc(s.name||"-")}<br>Adresse : ${esc(o.delivery_address||"-")}<br>Paiement : ${esc(o.payment_method||"-")}<br>Date : ${date(o.created_at)}</div>${arch?`Statut : ${esc(o.status)}`:`<label>Statut de la commande</label><select onchange="updateOrderStatus('${o.id}',this.value)">${orderStatusOptions(o.status)}</select><hr><label>Nom du livreur</label><input id="driverName-${o.id}" value="${attr(d.driver_name||"")}"><label>Téléphone du livreur</label><input id="driverPhone-${o.id}" value="${attr(d.driver_phone||"")}"><label>Statut de livraison</label><select id="deliveryStatus-${o.id}">${deliveryStatusOptions(d.status||"pending")}</select><label>Position ou note</label><input id="deliveryLocation-${o.id}" value="${attr(d.current_location||"")}"><label>Délai estimé (minutes)</label><input id="deliveryMinutes-${o.id}" type="number" min="0" max="10080" value="${d.estimated_minutes??""}"><button type="button" onclick="saveDelivery('${o.id}')">Enregistrer la livraison</button>`}${o.customer_note?`<p>Note : ${esc(o.customer_note)}</p>`:""}<div class="status-line" style="margin-top:12px">${arch?`<button class="gold" onclick="restoreOrder('${o.id}')">Restaurer</button><button class="danger" onclick="deleteArchivedOrder('${o.id}','${attr(o.order_number||o.id)}')">Supprimer définitivement</button>`:o.status==="delivered"?`<button class="gold" onclick="archiveOrder('${o.id}')">Archiver</button>`:""}</div>`;box.appendChild(el);});}catch(e){console.error(e);box.textContent="Erreur de chargement : "+e.message;}}
function orderStatusOptions(v){return [["pending","En attente"],["confirmed","Confirmée"],["preparing","En préparation"],["ready","Prête"],["out_for_delivery","En livraison"],["delivered","Livrée"],["cancelled","Annulée"]].map(([k,l])=>`<option value="${k}" ${v===k?"selected":""}>${l}</option>`).join("");}
function deliveryStatusOptions(v){return [["pending","À attribuer"],["assigned","Livreur attribué"],["picked_up","Commande récupérée"],["in_transit","En route"],["delivered","Livrée"],["failed","Échec de livraison"]].map(([k,l])=>`<option value="${k}" ${v===k?"selected":""}>${l}</option>`).join("");}
async function archiveOrder(id){if(!confirm("Archiver cette commande livrée ?"))return;const {error}=await supabaseClient.from("orders").update({archived_at:new Date().toISOString()}).eq("id",id).eq("status","delivered").is("archived_at",null);if(error)return alert("Archivage impossible : "+error.message);await Promise.all([loadOrders(),loadStats()]);}
async function restoreOrder(id){if(!confirm("Restaurer cette commande ?"))return;const {error}=await supabaseClient.from("orders").update({archived_at:null}).eq("id",id).not("archived_at","is",null);if(error)return alert("Restauration impossible : "+error.message);await Promise.all([loadOrders(),loadStats()]);}
async function deleteArchivedOrder(id,num){if(!confirm(`Supprimer définitivement la commande ${num} ? Cette action est irréversible.`))return;if(prompt("Écris SUPPRIMER pour confirmer.")!=="SUPPRIMER")return;const {data,error}=await supabaseClient.from("orders").delete().eq("id",id).not("archived_at","is",null).select("id");if(error)return alert("Suppression impossible : "+error.message);if(!data?.length)return alert("Aucune commande supprimée. Vérifie les droits.");await Promise.all([loadOrders(),loadStats()]);}
async function updateOrderStatus(id,status){const {error}=await supabaseClient.from("orders").update({status}).eq("id",id);if(error)return alert("Modification impossible : "+error.message);await Promise.all([loadOrders(),loadStats()]);}
async function saveDelivery(id){const f=n=>$(`${n}-${id}`),raw=f("deliveryMinutes")?.value.trim()||"",mins=raw===""?null:Number(raw);if(mins!==null&&(!Number.isInteger(mins)||mins<0||mins>10080))return alert("Le délai doit être un entier entre 0 et 10080 minutes.");const {error}=await supabaseClient.rpc("admin_update_delivery",{p_order_id:id,p_driver_name:f("driverName")?.value.trim()||null,p_driver_phone:f("driverPhone")?.value.trim()||null,p_status:f("deliveryStatus")?.value||"pending",p_current_location:f("deliveryLocation")?.value.trim()||null,p_estimated_minutes:mins});if(error)return alert("Impossible d'enregistrer la livraison : "+error.message);alert("Livraison enregistrée.");await loadOrders();}

async function loadCategories(){const s=$("storeCategory");if(!s)return;const {data,error}=await supabaseClient.from("store_categories").select("id,name").order("name");if(error){s.innerHTML='<option value="">Erreur de chargement</option>';return;}s.innerHTML='<option value="">Choisir une catégorie</option>';(data||[]).forEach(c=>{const o=document.createElement("option");o.value=c.id;o.textContent=c.name;s.appendChild(o);});}
async function loadStores(){
  const box=$("storesList");
  if(!box)return;
  box.textContent="Chargement des boutiques...";
  try {
    const {data,error}=await supabaseClient.from("stores")
      .select("id,name,slug,description,phone,whatsapp,address,city,logo_url,cover_url,is_open,is_published,delivery_available,merchant_code,category_id,store_categories(name)")
      .order("created_at",{ascending:false});
    if(error)throw error;
    box.innerHTML="";
    if(!data?.length) box.textContent="Aucune boutique enregistrée.";
    (data||[]).forEach(s=>{
      const el=document.createElement("article");
      el.className="item-row";
      const title=document.createElement("strong");
      title.textContent=s.name||"Boutique sans nom";
      const details=document.createElement("div");
      details.className="item-meta";
      details.innerHTML=`Catégorie : ${esc(s.store_categories?.name||"-")}<br>Téléphone : ${esc(s.phone||"-")}<br>Adresse : ${esc(s.address||"-")}<br>Ville : ${esc(s.city||"-")}<br>Code marchand : ${esc(s.merchant_code||"Non attribué")}`;
      const actions=document.createElement("div");
      actions.className="status-line";
      const edit=document.createElement("button");
      edit.type="button"; edit.dataset.storeAction="edit"; edit.dataset.storeId=s.id; edit.textContent="Modifier";
      const whatsapp=document.createElement("button");
      whatsapp.type="button"; whatsapp.dataset.storeAction="whatsapp"; whatsapp.dataset.storeId=s.id; whatsapp.textContent="Envoyer le code par WhatsApp";
      const del=document.createElement("button");
      del.type="button"; del.className="danger"; del.dataset.storeAction="delete"; del.dataset.storeId=s.id; del.dataset.storeName=s.name||"cette boutique"; del.textContent="Supprimer";
      actions.append(edit,whatsapp,del); el.append(title,details,actions); box.appendChild(el);
    });
    await loadStoreSelectors(data||[]);
    await loadStats();
  } catch(e) {
    console.error("Chargement des boutiques",e);
    box.textContent="Erreur de chargement : "+(e.message||e);
  }
}
async function loadStoreSelectors(stores){["mediaStore","productStore"].forEach(id=>{const s=$(id);if(!s)return;const old=s.value;s.innerHTML='<option value="">Choisir une boutique</option>';stores.forEach(x=>{const o=document.createElement("option");o.value=x.id;o.textContent=x.name;s.appendChild(o);});if(stores.some(x=>x.id===old))s.value=old;});}
async function handleStoreSubmit(e){
  e.preventDefault();
  const button=$("storeForm")?.querySelector('button[type="submit"]');
  const name=$("storeName")?.value.trim()||"", category=$("storeCategory")?.value||"", phone=$("storePhone")?.value.trim()||"";
  if(!name||!category||!phone)return alert("Le nom, la catégorie et le téléphone sont obligatoires.");
  const isEditing=Boolean(currentStoreId);
  const payload={name,slug:createSlug(name),category_id:category,description:$("storeDescription")?.value.trim()||null,phone,whatsapp:$("storeWhatsapp")?.value.trim()||null,address:$("storeAddress")?.value.trim()||null,logo_url:$("storeLogo")?.value.trim()||null,cover_url:$("storeCover")?.value.trim()||null,city:isEditing?(currentStoreCity||"Parakou"):"Parakou",is_open:true,is_published:true,delivery_available:Boolean($("storeDelivery")?.checked)};
  if(button){button.disabled=true;button.textContent=isEditing?"Enregistrement des modifications...":"Création de la boutique...";}
  try {
    let result;
    if(isEditing) {
      result=await supabaseClient.from("stores").update(payload).eq("id",currentStoreId).select("id").maybeSingle();
    } else {
      result=await supabaseClient.from("stores").insert(payload).select("id").single();
    }
    if(result.error)throw result.error;
    if(isEditing&&!result.data)throw new Error("Aucune boutique n'a été modifiée. Vérifie les droits administrateur (politiques RLS) dans Supabase.");
    alert(isEditing?"Boutique modifiée avec succès.":"Boutique créée avec succès.");
    resetStoreForm();
    await loadStores();
  } catch(err) {
    console.error("Enregistrement boutique",err);
    alert("Enregistrement impossible : "+(err.message||err));
  } finally {
    if(button){button.disabled=false;button.textContent=currentStoreId?"💾 Enregistrer les modifications":"Enregistrer la boutique";}
  }
}
async function editStore(id){
  try {
    const form=$("storeForm");
    if(!form)throw new Error("Formulaire de boutique introuvable dans admin.html.");
    const {data,error}=await supabaseClient.from("stores").select("*").eq("id",id).single();
    if(error)throw error;
    if(!data)throw new Error("Boutique introuvable.");
    currentStoreId=data.id;
    currentStoreCity=data.city||null;
    set("storeName",data.name);
    set("storeCategory",data.category_id);
    set("storeDescription",data.description);
    set("storePhone",data.phone);
    set("storeWhatsapp",data.whatsapp);
    set("storeAddress",data.address);
    set("storeLogo",data.logo_url);
    set("storeCover",data.cover_url);
    if($("storeDelivery"))$("storeDelivery").checked=data.delivery_available!==false;
    const submit=form.querySelector('button[type="submit"]');
    if(submit){submit.type="submit";submit.textContent="💾 Enregistrer les modifications";}
    const cancel=$("cancelStoreEdit");
    if(cancel)cancel.hidden=false;
    form.scrollIntoView({behavior:"smooth",block:"start"});
    if($("storeName"))$("storeName").focus({preventScroll:true});
    alert("Boutique chargée dans le formulaire. Modifie les champs puis clique sur « Enregistrer les modifications ».");
  } catch(e) {
    console.error("Modification boutique",e);
    alert("Impossible de charger la boutique : "+(e.message||e));
  }
}
function resetStoreForm(){
  $("storeForm")?.reset();
  currentStoreId=null;
  currentStoreCity=null;
  if($("storeDelivery"))$("storeDelivery").checked=true;
  const submit=$("storeForm")?.querySelector('button[type="submit"]');
  if(submit){submit.disabled=false;submit.textContent="Enregistrer la boutique";}
  const cancel=$("cancelStoreEdit");
  if(cancel)cancel.hidden=true;
}
async function handleProductSubmit(e){e.preventDefault();const storeId=$("productStore").value,name=$("productName").value.trim(),priceValue=Number($("productPrice").value||0);if(!storeId||!name||priceValue<=0)return alert("La boutique, le nom et un prix positif sont obligatoires.");const payload={store_id:storeId,name,slug:createSlug(name)+"-"+Date.now(),description:$("productDescription").value.trim()||null,price:priceValue,image_url:$("productImage").value.trim()||null,is_available:$("productAvailable").checked};const r=editingProductId?await supabaseClient.from("products").update(payload).eq("id",editingProductId):await supabaseClient.from("products").insert(payload);if(r.error)return alert("Enregistrement impossible : "+r.error.message);alert(editingProductId?"Produit modifié.":"Produit ajouté.");resetProductForm(false);$("productStore").value=storeId;await loadProducts(storeId);}
function resetProductForm(clearStore=true){editingProductId=null;$("productForm")?.reset();if(clearStore)$("productStore").value="";if($("productAvailable"))$("productAvailable").checked=true;const b=document.querySelector('#productForm button[type="submit"]');if(b)b.textContent="📦 Enregistrer le produit";if(clearStore&&$("productsList"))$("productsList").textContent="Sélectionnez une boutique.";}
async function loadProducts(id){const box=$("productsList");if(!box)return;if(!id){box.textContent="Sélectionnez une boutique.";return;}box.textContent="Chargement...";const {data,error}=await supabaseClient.from("products").select("*").eq("store_id",id).order("created_at",{ascending:false});if(error){box.textContent="Erreur : "+error.message;return;}box.innerHTML="";if(!data?.length){box.textContent="Aucun produit pour cette boutique.";return;}data.forEach(p=>{const el=document.createElement("article");el.className="item-row";el.innerHTML=`<strong>${esc(p.name)}</strong><div class="item-meta">${price(p.price)} — ${p.is_available?"Disponible":"Indisponible"}</div>${p.image_url?`<img src="${attr(p.image_url)}" alt="" loading="lazy" style="width:120px;border-radius:10px">`:""}<div class="status-line"><button type="button" onclick="editAdminProduct('${p.id}')">Modifier</button><button type="button" class="danger" onclick="deleteAdminProduct('${p.id}','${attr(p.name)}')">Supprimer</button></div>`;box.appendChild(el);});}
async function editAdminProduct(id){const {data,error}=await supabaseClient.from("products").select("*").eq("id",id).single();if(error||!data)return alert("Impossible de charger le produit.");set("productStore",data.store_id);set("productName",data.name);set("productDescription",data.description);set("productPrice",data.price);set("productImage",data.image_url);$("productAvailable").checked=data.is_available!==false;editingProductId=id;const b=document.querySelector('#productForm button[type="submit"]');if(b)b.textContent="💾 Enregistrer les modifications";$("productForm").scrollIntoView({behavior:"smooth",block:"start"});}
async function deleteAdminProduct(id,name){if(!confirm(`Supprimer définitivement le produit "${name}" ?`))return;const {error}=await supabaseClient.from("products").delete().eq("id",id);if(error)return alert("Suppression impossible : "+error.message);await loadProducts($("productStore").value);}
async function handleMediaUpload(e){e.preventDefault();const storeId=$("mediaStore").value,type=$("mediaType").value,file=$("mediaFile").files?.[0],title=$("mediaTitle").value.trim(),cover=$("mediaCover").checked,b=$("uploadMediaButton");if(!storeId||!file)return alert("Choisis une boutique et un fichier.");const max=type==="video"?100*1024*1024:12*1024*1024;if(file.size>max)return alert("Fichier trop volumineux (vidéo 100 Mo max, image 12 Mo max).");if((type==="image"&&!file.type.startsWith("image/"))||(type==="video"&&!file.type.startsWith("video/")))return alert("Le type du fichier ne correspond pas au média choisi.");b.disabled=true;b.textContent="Envoi en cours...";try{const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,""),path=`${storeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const {error:up}=await supabaseClient.storage.from("store-media").upload(path,file,{upsert:false});if(up)throw up;const {data}=supabaseClient.storage.from("store-media").getPublicUrl(path);if(cover){const {error}=await supabaseClient.from("store_media").update({is_cover:false}).eq("store_id",storeId);if(error)throw error;}const {error:ins}=await supabaseClient.from("store_media").insert({store_id:storeId,media_type:type,media_url:data.publicUrl,title:title||null,is_cover:cover});if(ins)throw ins;if(cover){const {error}=await supabaseClient.from("stores").update({cover_url:data.publicUrl}).eq("id",storeId);if(error)throw error;}alert("Média ajouté.");$("mediaForm").reset();await loadGallery(storeId);}catch(e){console.error(e);alert("Erreur lors de l'envoi : "+e.message);}finally{b.disabled=false;b.textContent="📤 Envoyer le média";}}
async function loadGallery(id){const box=$("mediaList");if(!box)return;if(!id){box.textContent="Choisis une boutique.";return;}box.textContent="Chargement...";const {data,error}=await supabaseClient.from("store_media").select("*").eq("store_id",id).order("created_at",{ascending:false});if(error){box.textContent="Erreur : "+error.message;return;}box.innerHTML="";if(!data?.length){box.textContent="Aucun média pour cette boutique.";return;}data.forEach(m=>{const el=document.createElement("div");el.className="media-item";el.innerHTML=m.media_type==="image"?`<img src="${attr(m.media_url)}" alt="" loading="lazy"><div class="media-info">${esc(m.title||"Sans titre")}${m.is_cover?"<strong> — Couverture</strong>":""}</div>`:`<video src="${attr(m.media_url)}" controls preload="metadata"></video><div class="media-info">${esc(m.title||"Vidéo")}</div>`;box.appendChild(el);});}
async function loadAdvertiserApplications(){const box=$("advertisersList");if(!box)return;box.textContent="Chargement des demandes...";const {data,error}=await supabaseClient.from("advertiser_applications").select("id,full_name,business_name,category,phone,whatsapp,city,address,description,goal,status,created_at,store_id,merchant_code").order("created_at",{ascending:false});if(error){box.textContent="Erreur de chargement : "+error.message;return;}box.innerHTML="";if(!data?.length){box.textContent="Aucune demande pour le moment.";return;}data.forEach(a=>{const el=document.createElement("article");el.className="item-row";el.innerHTML=`<div class="item-head"><strong>${esc(a.business_name||"Entreprise sans nom")}</strong><span>${esc(statusLabel(a.status))}</span></div><div class="item-meta">Nom : ${esc(a.full_name||"-")}<br>Téléphone : ${esc(a.phone||"-")}<br>WhatsApp : ${esc(a.whatsapp||"-")}<br>Catégorie : ${esc(a.category||"-")}<br>Ville : ${esc(a.city||"-")}<br>Adresse : ${esc(a.address||"-")}<br>Reçue le : ${date(a.created_at)}</div>${a.description?`<p>${esc(a.description)}</p>`:""}${a.merchant_code?`<p><strong>Code marchand :</strong> ${esc(a.merchant_code)}</p>`:""}<label>Statut</label><select onchange="updateAdvertiserStatus('${a.id}',this.value)">${advertiserOptions(a.status)}</select><div class="status-line">${a.status==="pending"?`<button class="gold" onclick="approveAdvertiser('${a.id}')">Approuver et créer la boutique</button>`:a.status==="approved"&&a.store_id?`<button onclick="approveAdvertiser('${a.id}')">Renvoyer le code par e-mail</button>`:""}</div>`;box.appendChild(el);});}
function advertiserOptions(v){return [["pending","En attente"],["contacted","Contacté"],["approved","Approuvé"],["rejected","Refusé"]].map(([k,l])=>`<option value="${k}" ${v===k?"selected":""}>${l}</option>`).join("");}function statusLabel(s){return ({pending:"En attente",contacted:"Contacté",approved:"Approuvé",rejected:"Refusé"})[s]||s||"-";}
async function updateAdvertiserStatus(id,status){const {error}=await supabaseClient.from("advertiser_applications").update({status,updated_at:new Date().toISOString()}).eq("id",id);if(error)return alert("Modification impossible : "+error.message);await loadAdvertiserApplications();}
async function getApplication(id){const {data,error}=await supabaseClient.from("advertiser_applications").select("*").eq("id",id).single();if(error){console.error(error);return null;}return data;}
async function approveAdvertiser(id){const a=await getApplication(id);if(!a)return alert("Demande introuvable.");if(a.status==="approved"&&a.store_id){if(!confirm("Cette demande est déjà approuvée. Renvoyer le code marchand par e-mail ?"))return;const {data,error}=await supabaseClient.functions.invoke("send-merchant-code-email",{body:{applicationId:id}});if(error||!data?.success)return alert("Échec de l'envoi : "+(data?.error||error?.message||"Erreur inconnue"));return alert("E-mail envoyé.");}if(!confirm(`Approuver la demande et créer la boutique "${a.business_name}" ?`))return;const {data:storeId,error}=await supabaseClient.rpc("approve_advertiser_application",{p_application_id:id});if(error||!storeId)return alert("Approbation impossible : "+(error?.message||"Identifiant boutique absent"));await Promise.all([loadAdvertiserApplications(),loadStores()]);const {data,error:mailError}=await supabaseClient.functions.invoke("send-merchant-code-email",{body:{applicationId:id}});if(mailError||!data?.success)return alert("Boutique créée, mais e-mail non envoyé : "+(data?.error||mailError?.message||"Erreur inconnue"));alert("Demande approuvée, boutique créée et code envoyé par e-mail.");}
async function resendMerchantCode(id){const {data:s,error}=await supabaseClient.from("stores").select("name,phone,whatsapp,merchant_code").eq("id",id).single();if(error||!s)return alert("Impossible de récupérer les informations de la boutique.");if(!s.merchant_code)return alert("Aucun code marchand attribué.");let phone=String(s.whatsapp||s.phone||"").replace(/\D/g,"");if(phone&&!phone.startsWith("229"))phone="229"+phone;if(!phone)return alert("Aucun numéro de téléphone disponible.");if(!confirm(`Ouvrir WhatsApp pour envoyer le code marchand de "${s.name}" ?`))return;const msg=`Bonjour ${s.name} !\n\nVotre code marchand PK ChapShop : ${s.merchant_code}\n\nMerci de votre confiance !`;window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(msg),"_blank","noopener");}
async function deleteStore(id,name){if(!confirm(`Supprimer la boutique "${name}" ?`))return;const p=await supabaseClient.from("products").select("id").eq("store_id",id).limit(1);if(p.error)return alert(p.error.message);if(p.data?.length)return alert("Cette boutique contient encore des produits. Supprime-les d'abord.");const o=await supabaseClient.from("orders").select("id").eq("store_id",id).limit(1);if(o.error)return alert(o.error.message);if(o.data?.length)return alert("Suppression bloquée : cette boutique possède des commandes.");const {error}=await supabaseClient.from("stores").delete().eq("id",id);if(error)return alert("Suppression impossible : "+error.message);alert("Boutique supprimée.");await loadStores();}
function price(v){return Number(v||0).toLocaleString("fr-FR")+" FCFA";}function date(v){return v?new Date(v).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"}):"-";}function createSlug(v){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");}function set(id,v){if($(id))$(id).value=v??"";}function esc(v){return v==null?"":String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}function attr(v){return esc(v);}
window.logout=logout;window.archiveOrder=archiveOrder;window.restoreOrder=restoreOrder;window.deleteArchivedOrder=deleteArchivedOrder;window.updateOrderStatus=updateOrderStatus;window.saveDelivery=saveDelivery;window.editStore=editStore;window.deleteStore=deleteStore;window.loadProducts=loadProducts;window.loadGallery=loadGallery;window.updateAdvertiserStatus=updateAdvertiserStatus;window.approveAdvertiser=approveAdvertiser;window.resendMerchantCode=resendMerchantCode;window.editAdminProduct=editAdminProduct;window.deleteAdminProduct=deleteAdminProduct;
