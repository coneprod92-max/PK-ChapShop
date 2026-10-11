const SUPABASE_URL = "https://ljzonxmlpygfryfmohhd.supabase.co";
const SUPABASE_KEY = "sb_publishable_3i2Mx68x3yO8Z_-xxiakMA_aDsIoZuR";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let store = null;
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const slug = v => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
function message(id,text,success=false){const el=$(id);if(el)el.innerHTML=`<div class="msg ${success?"ok":"err"}">${esc(text)}</div>`;}
function setMsg(text,ok=false){message("dashMsg",text,ok);}
async function uploadFile(file,folder="products"){
  if(!file)return null;
  if(file.size>50*1024*1024)throw new Error("Fichier trop volumineux (maximum 50 Mo).");
  const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"");
  const path=`${store.id}/${folder}/${Date.now()}-${slug(file.name.replace(/\.[^/.]+$/,""))}.${ext}`;
  const {error}=await sb.storage.from("store-media").upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});
  if(error)throw error;
  return sb.storage.from("store-media").getPublicUrl(path).data.publicUrl;
}
function storePublicUrl(){return location.origin+location.pathname.replace(/merchant\.html?$/i,"store.html")+"?id="+encodeURIComponent(store.id);}
async function copyStoreLink(){
  if(!store)return;
  const url=storePublicUrl();
  try{
    if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(url);setMsg("Lien de la boutique copié ! Collez-le sur WhatsApp, Facebook ou ailleurs.",true);}
    else prompt("Copiez le lien de votre boutique :",url);
  }catch(e){prompt("Copiez le lien de votre boutique :",url);}
}
async function shareStoreLink(){
  if(!store)return;
  const url=storePublicUrl(),title=store.name||"Ma boutique PK ChapShop";
  try{if(navigator.share)await navigator.share({title,text:"Découvrez ma boutique "+title+" sur PK ChapShop",url});else await copyStoreLink();}
  catch(e){if(e?.name!=="AbortError")await copyStoreLink();}
}
window.copyStoreLink=copyStoreLink;
window.shareStoreLink=shareStoreLink;
function addShareControls(){
  if($("shareStoreBtn"))return;
  const hero=document.querySelector(".hero");if(!hero)return;
  const wrap=document.createElement("div");wrap.className="actions";wrap.style.marginTop="14px";
  wrap.innerHTML=`<button id="shareStoreBtn" class="gold" type="button">🔗 Partager ma boutique</button><button id="copyStoreBtn" class="btn" type="button">📋 Copier le lien</button>`;
  hero.appendChild(wrap);
  $("shareStoreBtn").addEventListener("click",shareStoreLink);
  $("copyStoreBtn").addEventListener("click",copyStoreLink);
}
$("signupForm").addEventListener("submit",async e=>{
  e.preventDefault();const {data,error}=await sb.auth.signUp({email:$("signupEmail").value.trim(),password:$("signupPassword").value});
  if(error)return message("signupMsg",error.message);
  if(data.session){message("signupMsg","Compte créé avec succès.",true);await init();}
  else message("signupMsg","Compte créé. Vérifiez votre email si une confirmation est demandée, puis connectez-vous.",true);
});
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const {error}=await sb.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
  if(error)return message("loginMsg","Email ou mot de passe incorrect.");await init();
});
$("logoutBtn").addEventListener("click",async()=>{await sb.auth.signOut();location.reload();});
async function init(){
  const {data:{session}}=await sb.auth.getSession();if(!session)return;
  $("authSection").classList.add("hidden");$("logoutBtn").classList.remove("hidden");
  const {data:owned,error}=await sb.from("stores").select("id").eq("owner_id",session.user.id).limit(1);
  if(error){message("claimMsg",error.message);return;}
  if(owned?.length)await loadStore(owned[0].id);else $("claimSection").classList.remove("hidden");
}
$("claimForm").addEventListener("submit",async e=>{
  e.preventDefault();const {data,error}=await sb.rpc("claim_merchant_store",{p_merchant_code:$("merchantCode").value.trim(),p_phone:$("merchantPhone").value.trim()});
  if(error)return message("claimMsg",error.message);message("claimMsg","Boutique rattachée avec succès !",true);await loadStore(data);
});
async function loadStore(id){
  const {data,error}=await sb.from("stores").select("*").eq("id",id).single();if(error){message("claimMsg",error.message);return;}
  store=data;$("claimSection").classList.add("hidden");$("dashboard").classList.remove("hidden");
  $("storeName").textContent=store.name||"Ma boutique";$("storeInfo").textContent=`${store.city||store.address||"Boutique"} • ${store.is_open?"🟢 Ouverte":"🔴 Fermée"}`;
  $("sName").value=store.name||"";$("sPhone").value=store.phone||"";$("sWhatsapp").value=store.whatsapp||"";$("sAddress").value=store.address||"";
  $("sDescription").value=store.description||"";$("sLogo").value=store.logo_url||"";$("sCover").value=store.cover_url||"";
  $("sOpen").checked=!!store.is_open;$("sDelivery").checked=!!store.delivery_available;
  addShareControls();await Promise.all([loadProducts(),loadMedia(),loadOrders()]);
}
$("storeForm").addEventListener("submit",async e=>{
  e.preventDefault();const {error}=await sb.from("stores").update({
    name:$("sName").value.trim(),phone:$("sPhone").value.trim(),whatsapp:$("sWhatsapp").value.trim(),address:$("sAddress").value.trim(),
    description:$("sDescription").value.trim(),logo_url:$("sLogo").value.trim()||null,cover_url:$("sCover").value.trim()||null,
    is_open:$("sOpen").checked,delivery_available:$("sDelivery").checked
  }).eq("id",store.id);
  if(error)return setMsg(error.message);setMsg("Boutique mise à jour.",true);await loadStore(store.id);
});
function resetProductForm(){
  $("productForm").reset();if($("pId"))$("pId").value="";if($("pImage"))$("pImage").value="";if($("pImageFile"))$("pImageFile").value="";
  $("pAvailable").checked=true;const b=$("productSubmit");if(b)b.textContent="➕ Ajouter le produit";
  const c=$("cancelEditProduct");if(c)c.classList.add("hidden");
}
$("productForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!store)return;const btn=$("productSubmit")||e.submitter;if(btn){btn.disabled=true;btn.textContent="⏳ Enregistrement...";}
  try{
    const id=$("pId")?.value||"",name=$("pName").value.trim();let imageUrl=$("pImage")?.value.trim()||null;const file=$("pImageFile")?.files?.[0];
    if(file)imageUrl=await uploadFile(file,"products");
    const payload={name,description:$("pDescription").value.trim(),price:Number($("pPrice").value),image_url:imageUrl,is_available:$("pAvailable").checked};
    const result=id?await sb.from("products").update(payload).eq("id",id).eq("store_id",store.id):await sb.from("products").insert({...payload,store_id:store.id,slug:`${slug(name)}-${Date.now().toString().slice(-6)}`});
    if(result.error)throw result.error;resetProductForm();setMsg(id?"Produit modifié avec succès.":"Produit ajouté avec succès.",true);await loadProducts();
  }catch(err){setMsg(err.message||"Impossible d'enregistrer le produit.");}
  finally{if(btn){btn.disabled=false;btn.textContent=$("pId")?.value?"💾 Enregistrer les modifications":"➕ Ajouter le produit";}}
});
async function loadProducts(){
  const {data,error}=await sb.from("products").select("*").eq("store_id",store.id).order("created_at",{ascending:false});
  if(error){$("productsList").innerHTML=`<div class="msg err">${esc(error.message)}</div>`;return;}
  if(!data?.length){$("productsList").innerHTML="<p>Aucun produit pour le moment.</p>";return;}
  $("productsList").innerHTML=data.map(p=>`<div class="product"><div class="row"><strong>${esc(p.name)}</strong><span class="price">${Number(p.price||0).toLocaleString("fr-FR")} FCFA</span></div>${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:""}<p class="small">${esc(p.description||"")}</p><p class="small">${p.is_available?"🟢 Disponible":"🔴 Indisponible"}</p><div class="actions"><button class="gold" type="button" onclick="editProduct('${esc(p.id)}')">✏️ Modifier</button><button class="btn" type="button" onclick="toggleProduct('${esc(p.id)}',${!p.is_available})">${p.is_available?"⏸ Désactiver":"▶ Activer"}</button><button class="danger" type="button" onclick="deleteProduct('${esc(p.id)}','${esc(p.name)}')">🗑 Supprimer</button></div></div>`).join("");
}
window.editProduct=async id=>{
  const {data,error}=await sb.from("products").select("*").eq("id",id).eq("store_id",store.id).single();if(error)return setMsg(error.message);
  $("pId").value=data.id;$("pName").value=data.name||"";$("pPrice").value=data.price??"";$("pDescription").value=data.description||"";$("pImage").value=data.image_url||"";
  $("pAvailable").checked=!!data.is_available;if($("pImageFile"))$("pImageFile").value="";$("productSubmit").textContent="💾 Enregistrer les modifications";
  $("cancelEditProduct").classList.remove("hidden");$("productForm").scrollIntoView({behavior:"smooth",block:"start"});
};
window.toggleProduct=async(id,value)=>{
  const {error}=await sb.from("products").update({is_available:value}).eq("id",id).eq("store_id",store.id);if(error)return setMsg(error.message);await loadProducts();
};
window.deleteProduct=async(id,name)=>{
  if(!confirm(`Supprimer le produit « ${name} » ? Cette action est définitive.`))return;
  const {error}=await sb.from("products").delete().eq("id",id).eq("store_id",store.id);if(error)return setMsg(error.message);
  setMsg("Produit supprimé.",true);await loadProducts();
};
if($("cancelEditProduct"))$("cancelEditProduct").addEventListener("click",resetProductForm);
$("mediaForm").addEventListener("submit",async e=>{
  e.preventDefault();const file=$("mediaFile").files[0];if(!file)return;const type=$("mediaType").value;
  if((type==="image"&&!file.type.startsWith("image/"))||(type==="video"&&!file.type.startsWith("video/")))return setMsg("Type de fichier incorrect.");
  const button=$("mediaBtn");button.disabled=true;button.textContent="⏳ Envoi...";
  try{
    const url=await uploadFile(file,"gallery"),isCover=$("mediaCover").checked;
    if(isCover){const {error}=await sb.from("stores").update({cover_url:url}).eq("id",store.id);if(error)throw error;await sb.from("store_media").update({is_cover:false}).eq("store_id",store.id);}
    const {error}=await sb.from("store_media").insert({store_id:store.id,media_type:type,media_url:url,title:$("mediaTitle").value.trim()||null,is_cover:isCover});
    if(error)throw error;e.target.reset();setMsg("Média ajouté avec succès.",true);await loadMedia();
  }catch(err){setMsg(err.message||"Erreur pendant l'envoi.");}
  finally{button.disabled=false;button.textContent="📤 Envoyer";}
});
async function loadMedia(){
  const {data,error}=await sb.from("store_media").select("*").eq("store_id",store.id).order("created_at",{ascending:false});
  if(error){$("mediaList").innerHTML=`<div class="msg err">${esc(error.message)}</div>`;return;}
  if(!data?.length){$("mediaList").innerHTML="<p>Aucun média.</p>";return;}
  $("mediaList").innerHTML=data.map(m=>`<div class="product">${m.media_type==="video"?`<video src="${esc(m.media_url)}" controls playsinline></video>`:`<img src="${esc(m.media_url)}" alt="${esc(m.title||"Photo boutique")}">`}<p><strong>${esc(m.title||"Sans titre")}</strong>${m.is_cover?" ⭐":""}</p></div>`).join("");
}
async function loadOrders(){
  const {data,error}=await sb.from("orders").select("id,order_number,status,total,delivery_address,payment_method,created_at,customers(full_name,phone),order_items(product_name,quantity,line_total)").eq("store_id",store.id).order("created_at",{ascending:false}).limit(50);
  if(error){$("ordersList").innerHTML=`<div class="msg err">${esc(error.message)}</div>`;return;}
  if(!data?.length){$("ordersList").innerHTML="<p>Aucune commande pour le moment.</p>";return;}
  const statuses=["pending","confirmed","preparing","shipped","delivered","cancelled"],labels={pending:"En attente",confirmed:"Confirmée",preparing:"En préparation",shipped:"Expédiée",delivered:"Livrée",cancelled:"Annulée"};
  $("ordersList").innerHTML=data.map(o=>`<div class="order"><div class="row"><strong>Commande ${esc(o.order_number||o.id)}</strong><span class="price">${Number(o.total||0).toLocaleString("fr-FR")} FCFA</span></div><p><strong>Client :</strong> ${esc(o.customers?.full_name||"Client")} — ${esc(o.customers?.phone||"")}</p><p><strong>Adresse :</strong> ${esc(o.delivery_address||"Non renseignée")}</p><p><strong>Articles :</strong> ${(o.order_items||[]).map(i=>`${esc(i.product_name)} × ${Number(i.quantity||1)}`).join(", ")}</p><label>Statut de la commande</label><select id="status-${esc(o.id)}">${statuses.map(s=>`<option value="${s}" ${o.status===s?"selected":""}>${labels[s]}</option>`).join("")}</select><button class="gold" type="button" onclick="updateOrder('${esc(o.id)}')">Mettre à jour</button></div>`).join("");
}
window.updateOrder=async id=>{
  const status=$(`status-${id}`).value;const {error}=await sb.from("orders").update({status}).eq("id",id).eq("store_id",store.id);
  if(error)return setMsg(error.message);setMsg("Statut de la commande mis à jour.",true);await loadOrders();
};
init();
