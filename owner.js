// Owner-only interface. Actual authorization is enforced by Supabase RLS.
let supabaseClient = null;
let backendReady = false;
let isOwner = false;
let products = [];

const $ = (id) => document.getElementById(id);
const money = (n) => `${Number(n).toLocaleString("en-US")} MMK`;

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

function setBackendStatus(text, isError = false) {
  const node = $("backend-status");
  node.textContent = text;
  node.classList.toggle("admin-error", isError);
}

function setAdminMessage(text) {
  $("admin-message").textContent = text;
}

function normalizeProduct(product) {
  const variants = Array.isArray(product.variants) && product.variants.length
    ? product.variants.map(v => ({name: String(v.name || "Standard"), stock: Math.max(0, Number(v.stock) || 0)}))
    : [{name: "Standard", stock: Math.max(0, Number(product.stock) || 0)}];
  return {...product, id: Number(product.id), price: Number(product.price) || 0,
    variants, stock: variants.reduce((sum, v) => sum + v.stock, 0)};
}

function getVariants(product) {
  return Array.isArray(product.variants) && product.variants.length
    ? product.variants : [{name: "Standard", stock: Number(product.stock) || 0}];
}

async function requireOwner() {
  if (!backendReady || !supabaseClient) throw new Error("Supabase is not configured yet. Follow SETUP-SUPABASE.md first.");
  const {data: {session}} = await supabaseClient.auth.getSession();
  if (!session?.user) throw new Error("Please sign in with the owner account first.");
  const {data, error} = await supabaseClient.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
  if (error || !data) throw new Error("This account does not have owner permissions.");
}

async function loadRemoteProducts() {
  const {data, error} = await supabaseClient.from("products").select("*").order("id", {ascending: true});
  if (error) throw error;
  products = (data || []).map(normalizeProduct);
  renderInventory();
}

function renderInventory() {
  const list = $("inventory-list");
  if (!isOwner || !supabaseClient) { list.innerHTML = ""; return; }
  if (!products.length) {
    list.innerHTML = '<p class="owner-muted">No products yet. Add your first product above.</p>';
    return;
  }
  list.innerHTML = products.map(p => `
    <div class="inventory-row inventory-product-row" data-id="${p.id}">
      <div class="inventory-product-title">
        <div class="inventory-name">${safeText(p.name)}</div>
        <div class="inventory-meta">${money(p.price)} · ${p.stock > 0 ? `${p.stock} in stock` : "Sold out"}</div>
      </div>
      <div class="inventory-variant-list">${getVariants(p).map((v, i) => `
        <label class="inventory-variant-stock"><span>${safeText(v.name)}</span>
          <input aria-label="Stock for ${safeText(p.name)} ${safeText(v.name)}" type="number" min="0" step="1" value="${v.stock}" data-stock-product="${p.id}" data-stock-variant="${i}">
        </label>`).join("")}</div>
      <button type="button" class="small-button" data-delete="${p.id}">Remove</button>
    </div>`).join("");

  list.querySelectorAll("[data-stock-product]").forEach(input => {
    input.addEventListener("change", async () => {
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 0) {
        setAdminMessage("Stock must be a whole number of 0 or more.");
        renderInventory();
        return;
      }
      const id = Number(input.dataset.stockProduct);
      const variantIndex = Number(input.dataset.stockVariant);
      const product = products.find(p => p.id === id);
      if (!product) return;
      const variants = getVariants(product).map(v => ({...v}));
      if (!variants[variantIndex]) return;
      variants[variantIndex].stock = value;
      await updateProduct(id, {variants, stock: variants.reduce((sum, v) => sum + v.stock, 0)});
    });
  });

  list.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this product from the shared ZBlock catalogue?")) return;
      try {
        await requireOwner();
        const {error} = await supabaseClient.from("products").delete().eq("id", Number(btn.dataset.delete));
        if (error) throw error;
        await loadRemoteProducts();
        setAdminMessage("Product removed from the shared catalogue.");
      } catch (error) { setAdminMessage(error.message || "Could not remove product."); }
    });
  });
}

async function updateProduct(id, changes) {
  try {
    await requireOwner();
    const {error} = await supabaseClient.from("products").update(changes).eq("id", id);
    if (error) throw error;
    await loadRemoteProducts();
    setAdminMessage("Shared inventory updated.");
  } catch (error) {
    setAdminMessage(error.message || "Could not update inventory.");
    try { await loadRemoteProducts(); } catch (_) {}
  }
}

async function verifyOwner(user) {
  isOwner = false;
  if (user && supabaseClient) {
    const {data, error} = await supabaseClient.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    isOwner = !error && Boolean(data);
    if (error) console.error("Owner permission check failed:", error);
  }
  $("admin-login-section").hidden = Boolean(user && isOwner);
  $("admin-denied").hidden = !(user && !isOwner);
  $("admin-tools").hidden = !isOwner;
  if (isOwner) {
    $("admin-session-label").textContent = `Owner signed in: ${user.email || "authorized account"}`;
    setBackendStatus("Connected to shared inventory. Owner permissions verified.");
    try { await loadRemoteProducts(); }
    catch (error) { setBackendStatus("Could not load inventory. Check your Supabase tables and permissions.", true); }
  } else if (user) {
    setBackendStatus("This account is not authorized to manage ZBlock.", true);
    $("inventory-list").innerHTML = "";
  } else if (backendReady) {
    setBackendStatus("Connected to ZBlock. Sign in with your owner account to manage products.");
    $("inventory-list").innerHTML = "";
  }
}

async function initializeOwnerTools() {
  const url = String(window.ZBLOCK_SUPABASE_URL || "").trim();
  const key = String(window.ZBLOCK_SUPABASE_ANON_KEY || "").trim();
  const configured = url.startsWith("https://") && key.length > 20 && !url.includes("YOUR_PROJECT") && !key.includes("PASTE_");
  if (!configured || !window.supabase?.createClient) {
    setBackendStatus("Supabase is not configured. Complete SETUP-SUPABASE.md before using owner tools.", true);
    $("admin-login-button").disabled = true;
    return;
  }
  supabaseClient = window.supabase.createClient(url, key);
  backendReady = true;
  setBackendStatus("Connecting to ZBlock inventory…");
  const {data: {session}} = await supabaseClient.auth.getSession();
  await verifyOwner(session?.user || null);
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    // Defer calls out of the auth callback to avoid locking auth internals.
    setTimeout(() => verifyOwner(session?.user || null), 0);
  });
}

$("admin-login-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabaseClient || !backendReady) { $("login-message").textContent = "Finish Supabase setup first."; return; }
  const button = $("admin-login-button");
  button.disabled = true;
  $("login-message").textContent = "Signing in…";
  const {data, error} = await supabaseClient.auth.signInWithPassword({
    email: $("admin-email").value.trim(), password: $("admin-password").value
  });
  button.disabled = false;
  if (error) { $("login-message").textContent = "Sign-in failed. Check your email and password."; return; }
  $("admin-password").value = "";
  await verifyOwner(data.user);
  $("login-message").textContent = isOwner ? "Owner access granted." : "This account is not authorized as the owner.";
});

async function signOutOwner() {
  if (supabaseClient) await supabaseClient.auth.signOut();
  await verifyOwner(null);
  $("login-message").textContent = "Signed out.";
}
$("admin-signout").addEventListener("click", signOutOwner);
$("denied-signout").addEventListener("click", signOutOwner);

$("product-form").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await requireOwner();
    const name = $("new-name").value.trim();
    const price = Number($("new-price").value);
    const totalStock = Number($("new-stock").value);
    const category = $("new-category").value;
    const imageText = $("new-image").value.trim();
    const gallery = imageText ? imageText.split(",").map(url => url.trim()).filter(Boolean) : [];
    const description = $("new-description").value.trim();
    const variantsText = $("new-variants").value.trim();
    if (!name || name.length > 100 || !Number.isInteger(price) || price <= 0 || !Number.isInteger(totalStock) || totalStock < 0) {
      setAdminMessage("Enter a product name, a positive whole-number price, and whole-number stock."); return;
    }
    if (gallery.some(url => !/^https?:\/\//i.test(url))) {
      setAdminMessage("Each image URL must begin with http:// or https://."); return;
    }
    const variants = variantsText
      ? variantsText.split(",").map(part => {
          const match = part.trim().match(/^(.*?)(?:\s*:\s*(\d+))?$/);
          return {name: (match?.[1] || "Standard").trim(), stock: match?.[2] === undefined ? totalStock : Number(match[2])};
        }).filter(v => v.name)
      : [{name: "Standard", stock: totalStock}];
    if (!variants.length || variants.some(v => !Number.isInteger(v.stock) || v.stock < 0)) {
      setAdminMessage("Each variant must have a valid non-negative stock quantity."); return;
    }
    const stock = variants.reduce((sum, v) => sum + v.stock, 0);
    const row = {name, price, stock, category, image: gallery[0] || "", gallery, description, variants, emoji: "🧱", color: "#f3e3ac"};
    const {error} = await supabaseClient.from("products").insert(row);
    if (error) throw error;
    event.target.reset();
    $("new-stock").value = "1";
    await loadRemoteProducts();
    setAdminMessage(`${name} added to the shared ZBlock catalogue.`);
  } catch (error) { setAdminMessage(error.message || "Could not add product. Check owner permissions and database setup."); }
});

initializeOwnerTools().catch(error => {
  console.error("Could not initialize owner tools:", error);
  setBackendStatus("Could not connect to Supabase. Check your project URL and public key.", true);
});
