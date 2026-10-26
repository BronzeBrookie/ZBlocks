
 // Brick Corner / ZBlock demo shop.
 // Update the contact details in index.html before publishing.
// Public browser config. Only the Supabase URL and publishable/anon key belong here.
// Authorization is enforced by Supabase Auth + Row Level Security, not by this file.
let supabaseClient = null;

const starterProducts = [
  {id:1,name:"Shadow Ninja",category:"NINJA",price:12000,stock:3,emoji:"🥷",color:"#e5d9c8",image:"",description:"A stealthy ninja minifigure for your collection.",variants:[{name:"Black",stock:2},{name:"Red",stock:1}]},
  {id:2,name:"Golden Knight",category:"KNIGHTS",price:15000,stock:1,emoji:"⚔️",color:"#f3d978",image:"",description:"A classic knight-themed minifigure with golden styling.",variants:[{name:"Gold",stock:1}]},
  {id:3,name:"Space Explorer",category:"SPACE",price:18000,stock:0,emoji:"🚀",color:"#d8e0e8",image:"",description:"A space explorer minifigure. Currently unavailable.",variants:[{name:"White",stock:0}]},
  {id:4,name:"Forest Adventurer",category:"ADVENTURE",price:10000,stock:4,emoji:"🌲",color:"#dce5d2",image:"",description:"An adventurer ready for forest exploration and imaginative builds.",variants:[{name:"Green",stock:4}]},
  {id:5,name:"Fire Warrior",category:"NINJA",price:14000,stock:2,emoji:"🔥",color:"#f2d4bd",image:"",description:"A fiery warrior minifigure for action-packed displays.",variants:[{name:"Red",stock:2}]},
  {id:6,name:"Robot Pilot",category:"SPACE",price:16000,stock:0,emoji:"🤖",color:"#ddd9ea",image:"",description:"A robot pilot minifigure for sci-fi collections.",variants:[{name:"Silver",stock:0}]}
];

let products = starterProducts.map(p => ({...p}));
let activeFilter = "all";
let activeCategory = "ALL";
let selectedOrderProduct = null;
let selectedVariant = null;
let detailProductId = null;
let detailSelectedVariantIndex = 0;

const $ = (id) => document.getElementById(id);
const money = (n) => `${Number(n).toLocaleString("en-US")} MMK`;

function normalizeProduct(product) {
  const variants = Array.isArray(product.variants) && product.variants.length
    ? product.variants.map(v => ({name: String(v.name || "Standard"), stock: Math.max(0, Number(v.stock) || 0)}))
    : [{name: "Standard", stock: Math.max(0, Number(product.stock) || 0)}];
  return {
    ...product,
    id: Number(product.id),
    price: Number(product.price) || 0,
    variants,
    stock: variants.reduce((sum, variant) => sum + variant.stock, 0),
    gallery: Array.isArray(product.gallery) ? product.gallery : (product.image ? [product.image] : []),
    description: product.description || "",
    emoji: product.emoji || "🧱",
    color: product.color || "#f3e3ac"
  };
}

async function loadRemoteProducts() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("products").select("*").order("id", {ascending: true});
  if (error) {
    console.error("Could not load ZBlock products:", error);
    products = [];
    render();
    return;
  }
  products = (data || []).map(normalizeProduct);
  render();
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

// Create the order popup automatically.
function createOrderPopup() {
  if ($("orderPopup")) return;

  const popup = document.createElement("div");
  popup.id = "orderPopup";
  popup.className = "popup";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-modal", "true");
  popup.setAttribute("aria-labelledby", "orderPopupTitle");

  popup.innerHTML = `
    <div class="popup-box order-popup-box">
      <h2 id="orderPopupTitle">Order Your Minifigure</h2>

      <p id="orderFigureName"></p>
      <p id="orderFigurePrice"></p>

      <label for="orderVariant">Choose colour / variant:</label>
      <select id="orderVariant"></select>

      <label for="orderQuantity">Quantity:</label>
      <input
        id="orderQuantity"
        type="number"
        min="1"
        value="1"
        step="1"
      >

      <p class="order-total">
        Total: <strong id="orderTotal"></strong>
      </p>

      <p id="orderStockNote" class="order-stock-note"></p>

      <div class="order-actions">
        <button type="button" id="confirmOrderButton">
          Contact to Order
        </button>
        <button type="button" id="closeOrderButton" class="order-close">
          Cancel
        </button>
      </div>
      <p class="order-disclaimer">
        Your order is not submitted until you contact the shop.
      </p>
    </div>
  `;

  document.body.appendChild(popup);

  $("closeOrderButton").addEventListener("click", closeOrderPopup);

  $("orderQuantity").addEventListener("input", updateOrderTotal);
  $("orderVariant").addEventListener("change", () => {
    selectedVariant = getSelectedVariant();
    const variants = getVariants(selectedOrderProduct);
    const current = selectedVariant ? selectedVariant.stock : 0;
    $("orderQuantity").max = String(current);
    if (Number($("orderQuantity").value) > current) $("orderQuantity").value = current > 0 ? "1" : "";
    updateOrderTotal();
  });

  $("confirmOrderButton").addEventListener("click", () => {
    if (!selectedOrderProduct) return;

    const quantity = Number($("orderQuantity").value);
    selectedVariant = getSelectedVariant();
    const available = selectedVariant ? selectedVariant.stock : selectedOrderProduct.stock;

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > available
    ) {
      $("orderStockNote").textContent =
        `Please choose a quantity from 1 to ${available}.`;
      return;
    }

    const orderSummary = `Order enquiry: ${selectedOrderProduct.name}\nVariant: ${selectedVariant ? selectedVariant.name : "Standard"}\nQuantity: ${quantity}\nTotal: ${money(selectedOrderProduct.price * quantity)}`;
    closeOrderPopup();
    showPopup(orderSummary);

    // Open your existing contact popup if it exists.

  });

  // Close if the user clicks the dark background.
  popup.addEventListener("click", event => {
    if (event.target === popup) closeOrderPopup();
  });

  // Close when Escape is pressed.
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeOrderPopup();
  });
}

function openOrderPopup(id, preferredVariantIndex = null) {
  const product = products.find(p => p.id === id);

  if (!product || product.stock < 1) {
    return;
  }

  selectedOrderProduct = product;

  $("orderFigureName").textContent = `Product: ${product.name}`;
  $("orderFigurePrice").textContent = `Price per item: ${money(product.price)}`;
  const variants = getVariants(product);
  $("orderVariant").innerHTML = variants.map((v, i) => `<option value="${i}" ${v.stock < 1 ? "disabled" : ""}>${safeText(v.name)}${v.stock < 1 ? " (sold out)" : ` (${v.stock} available)`}</option>`).join("");
  selectedVariant = (preferredVariantIndex !== null && variants[preferredVariantIndex]?.stock > 0)
    ? variants[preferredVariantIndex]
    : (variants.find(v => v.stock > 0) || variants[0] || null);
  if (selectedVariant) $("orderVariant").value = String(variants.indexOf(selectedVariant));

  const quantityInput = $("orderQuantity");
  quantityInput.value = "1";
  quantityInput.max = String(selectedVariant ? selectedVariant.stock : product.stock);

  $("orderStockNote").textContent = `${quantityInput.max} available in this variant.`;
  $("confirmOrderButton").disabled = false;

  updateOrderTotal();

  $("orderPopup").style.display = "flex";
  $("closeOrderButton").focus();
}

function closeOrderPopup() {
  const popup = $("orderPopup");
  if (popup) popup.style.display = "none";
  selectedOrderProduct = null;
  selectedVariant = null;
}

function getVariants(product) {
  if (Array.isArray(product.variants) && product.variants.length) return product.variants.map(v => typeof v === "string" ? {name:v, stock:Number(product.stock)||0} : {name:String(v.name || "Standard"), stock:Math.max(0, Number(v.stock ?? product.stock) || 0)});
  return [{name:"Standard", stock:Math.max(0, Number(product.stock)||0)}];
}

function getSelectedVariant() {
  if (!selectedOrderProduct) return null;
  const variants = getVariants(selectedOrderProduct);
  const index = Number($("orderVariant").value);
  return variants[index] || variants.find(v => v.stock > 0) || variants[0] || null;
}

function updateOrderTotal() {
  if (!selectedOrderProduct) return;

  const quantityInput = $("orderQuantity");
  let quantity = Number(quantityInput.value);
  selectedVariant = getSelectedVariant();
  const available = selectedVariant ? selectedVariant.stock : selectedOrderProduct.stock;
  quantityInput.max = String(available);

  if (!Number.isInteger(quantity) || quantity < 1) {
    $("orderTotal").textContent = "—";
    $("orderStockNote").textContent = "Enter a valid quantity.";
    $("confirmOrderButton").disabled = true;
    return;
  }

  if (quantity > available || available < 1) {
    $("orderTotal").textContent = "—";
    $("orderStockNote").textContent =
      `Only ${available} available for this variant.`;
    $("confirmOrderButton").disabled = true;
    return;
  }

  $("orderTotal").textContent =
    money(selectedOrderProduct.price * quantity);

  $("orderStockNote").textContent =
    `${available} available in this variant.`;

  $("confirmOrderButton").disabled = false;
}

function productImages(product) {
  const raw = Array.isArray(product.gallery) && product.gallery.length ? product.gallery : (product.image ? [product.image] : []);
  return [...new Set(raw.map(value => String(value || "").trim()).filter(value => /^https?:\/\//i.test(value)))];
}

function openDetails(id, selectedVariantIndex = 0) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  detailProductId = id;
  const variants = getVariants(product);
  detailSelectedVariantIndex = Math.max(0, Math.min(selectedVariantIndex, variants.length - 1));
  const selectedVariant = variants[detailSelectedVariantIndex] || variants[0];
  const images = productImages(product);
  const productPage = $("product-page");
  const collection = $("collection");
  const hero = document.querySelector(".hero");
  const contactNote = $("contact-note");
  const content = $("product-page-content");

  if (hero) hero.classList.add("hidden");
  collection.classList.add("hidden");
  contactNote?.classList.add("hidden");
  productPage.classList.remove("hidden");

  const gallery = images.length
    ? `<div class="detail-gallery"><div class="detail-main-image"><img id="detail-main-image" src="${safeText(images[0])}" alt="${safeText(product.name)}"></div><div class="detail-thumbnails">${images.map((src, i) => `<button type="button" class="detail-thumbnail ${i === 0 ? "active" : ""}" data-gallery-index="${i}" aria-label="View product image ${i + 1}"><img src="${safeText(src)}" alt=""></button>`).join("")}</div></div>`
    : `<div class="detail-gallery"><div class="detail-main-image detail-placeholder" style="background:${safeText(product.color || "#e7dfcf")}"><span>${safeText(product.emoji || "🧱")}</span></div><p class="gallery-hint">Add product photos to show a photo gallery.</p></div>`;

  content.innerHTML = `
    <div class="product-detail-layout">
      ${gallery}
      <div class="product-detail-copy">
        <div class="category-label">${safeText(product.category || "OTHER")}</div>
        <h1>${safeText(product.name)}</h1>
        <div class="detail-price">${money(product.price)}</div>
        <p class="detail-stock ${selectedVariant && selectedVariant.stock > 0 ? "available" : "unavailable"}" id="detail-stock">${selectedVariant && selectedVariant.stock > 0 ? `${selectedVariant.stock} available in ${safeText(selectedVariant.name)}` : `${safeText(selectedVariant?.name || "This variant")} is sold out`}</p>
        <p class="details-description">${safeText(product.description || "No detailed description has been added yet.")}</p>
        <div class="variant-picker">
          <h2>Choose a colour / variant</h2>
          <div class="variant-swatches" role="group" aria-label="Choose product variant">${variants.map((variant, i) => `<button type="button" class="variant-swatch ${i === detailSelectedVariantIndex ? "selected" : ""} ${variant.stock < 1 ? "sold-out" : ""}" data-variant-index="${i}" aria-pressed="${i === detailSelectedVariantIndex}" title="${safeText(variant.name)}${variant.stock < 1 ? " — sold out" : ""}"><span class="swatch-dot" style="background:${safeText(colorForVariant(variant.name, product.color))}"></span><span>${safeText(variant.name)}</span>${variant.stock < 1 ? `<small>Sold out</small>` : `<small>${variant.stock} left</small>`}</button>`).join("")}</div>
          <p class="selected-variant-note" id="selected-variant-note">Selected: <strong>${safeText(selectedVariant?.name || "Standard")}</strong></p>
        </div>
        <button type="button" class="button button-yellow detail-order-button" id="detail-order-button" ${!selectedVariant || selectedVariant.stock < 1 ? "disabled" : ""}>${selectedVariant && selectedVariant.stock > 0 ? "Choose quantity & order" : "Currently sold out"}</button>
        <p class="detail-order-note">Orders are confirmed directly with the shop owner. This demo does not process payments.</p>
      </div>
    </div>`;

  content.querySelectorAll("[data-gallery-index]").forEach(button => button.addEventListener("click", () => {
    const imageIndex = Number(button.dataset.galleryIndex);
    const mainImage = $("detail-main-image");
    if (mainImage && images[imageIndex]) mainImage.src = images[imageIndex];
    content.querySelectorAll("[data-gallery-index]").forEach(item => item.classList.toggle("active", item === button));
  }));

  content.querySelectorAll("[data-variant-index]").forEach(button => button.addEventListener("click", () => {
    detailSelectedVariantIndex = Number(button.dataset.variantIndex);
    openDetails(id, detailSelectedVariantIndex);
    history.replaceState(null, "", `#product-${id}`);
  }));

  $("detail-order-button").addEventListener("click", () => {
    if (!selectedVariant || selectedVariant.stock < 1) return;
    openOrderPopup(id, detailSelectedVariantIndex);
  });

  history.replaceState(null, "", `#product-${id}`);
  window.scrollTo({top: 0, behavior: "smooth"});
}

function colorForVariant(name, fallback = "#e7dfcf") {
  const key = String(name || "").toLowerCase();
  const colors = {
    black: "#292929", white: "#f7f5ef", red: "#d94a42", blue: "#377bc5",
    lightblue: "#82c6e8", "light blue": "#82c6e8", green: "#4b9b68", darkgreen: "#246443",
    yellow: "#f3d34a", gold: "#d9ad37", orange: "#ed8a32", purple: "#8b67b4",
    pink: "#e99ab7", brown: "#80583e", gray: "#999999", grey: "#999999",
    silver: "#b8c0c8", tan: "#c6a77a"
  };
  return colors[key] || fallback || "#e7dfcf";
}

function returnToCollection() {
  $("product-page").classList.add("hidden");
  $("collection").classList.remove("hidden");
  $("contact-note")?.classList.remove("hidden");
  document.querySelector(".hero")?.classList.remove("hidden");
  detailProductId = null;
  history.replaceState(null, "", window.location.pathname + window.location.search + "#collection");
  $("collection").scrollIntoView({behavior: "smooth", block: "start"});
}

function categories() {
  const cats = ["ALL", ...new Set(products.map(p => p.category || "OTHER"))];

  $("categories").innerHTML = cats.map(c => `
    <button class="category-button ${activeCategory === c ? "active" : ""}"
      data-category="${safeText(c)}">
      ${c === "ALL" ? "All categories" : safeText(c)}
    </button>
  `).join("");

  $("categories").querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      render();
    });
  });
}

function visibleProducts() {
  const query = $("search").value.trim().toLowerCase();

  return products.filter(p =>
    (
      String(p.name || "").toLowerCase().includes(query) ||
      String(p.category || "").toLowerCase().includes(query)
    ) &&
    (
      activeFilter === "all" ||
      (activeFilter === "in" ? p.stock > 0 : p.stock === 0)
    ) &&
    (activeCategory === "ALL" || p.category === activeCategory)
  );
}

function render() {
  categories();

  const items = visibleProducts();

  $("available-count").textContent =
    products.filter(p => p.stock > 0).length;

  $("unit-count").textContent =
    products.reduce((sum, p) => sum + Number(p.stock || 0), 0);

  $("result-count").textContent =
    `${items.length} item${items.length === 1 ? "" : "s"}`;

  $("product-grid").innerHTML = items.map(p => {
    const image = p.image && /^https?:\/\//i.test(p.image)
      ? `<img src="${safeText(p.image)}"
          alt="${safeText(p.name)}"
          loading="lazy"
          onerror="this.remove()">`
      : "";

    return `
      <article class="product-card">
        <div class="product-art" style="--art:${safeText(p.color || "#e7dfcf")}">
          ${image || `<span class="emoji" aria-hidden="true">${safeText(p.emoji || "🧱")}</span>`}

          <span class="stock-badge ${p.stock > 0 ? "stock-in" : "stock-out"}">
            ${p.stock > 0 ? "IN STOCK" : "SOLD OUT"}
          </span>
        </div>

        <div class="product-info">
          <div class="category-label">${safeText(p.category || "OTHER")}</div>
          <h3>${safeText(p.name)}</h3>
          <div class="price">${money(p.price)}</div>
          <p class="product-summary">${safeText(p.description || "Ask the shop for more product details.")}</p>

          <div class="stock-copy">
            ${p.stock > 0 ? `${p.stock} available` : "Currently unavailable"}
          </div>

          <button type="button" class="button button-light details-button" data-details-id="${p.id}">View product</button>
          <button
            type="button"
            class="button button-yellow order-now-button"
            data-order-id="${p.id}"
            ${p.stock < 1 ? "disabled" : ""}
          >
            ${p.stock > 0 ? "Order Now" : "Sold Out"}
          </button>
        </div>
      </article>
    `;
  }).join("");

  $("product-grid").querySelectorAll("[data-details-id]").forEach(btn => {
    btn.addEventListener("click", () => openDetails(Number(btn.dataset.detailsId)));
  });

  // Connect each newly rendered Order Now button.
  $("product-grid").querySelectorAll("[data-order-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      openOrderPopup(Number(btn.dataset.orderId));
    });
  });

  $("empty-state").classList.toggle("hidden", items.length > 0);

}

$("search").addEventListener("input", render);

document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;

    document.querySelectorAll(".filter").forEach(b => {
      b.classList.toggle("active", b === btn);
    });

    render();
  });
});

$("clear-filters").addEventListener("click", () => {
  $("search").value = "";
  activeFilter = "all";
  activeCategory = "ALL";

  document.querySelectorAll(".filter").forEach(b => {
    b.classList.toggle("active", b.dataset.filter === "all");
  });

  render();
});

$("contact-link").addEventListener("click", showPopup);

function showPopup(orderSummary = "") {
  const popup = $("myPopup");
  if (!popup) return;
  let summary = $("orderContactSummary");
  if (!summary) { summary = document.createElement("p"); summary.id = "orderContactSummary"; summary.className = "order-contact-summary"; $("contactPopupTitle").after(summary); }
  summary.textContent = orderSummary;
  summary.hidden = !orderSummary;
  popup.style.display = "flex";
}

function closePopup() {
  const popup = $("myPopup");
  if (popup) popup.style.display = "none";
}

// Product detail navigation and initial deep-link support.
$("back-to-shop").addEventListener("click", returnToCollection);
window.addEventListener("hashchange", () => {
  const match = window.location.hash.match(/^#product-(\d+)$/);
  if (match) openDetails(Number(match[1]));
  else if ($("product-page") && !$("product-page").classList.contains("hidden")) returnToCollection();
});

// Start in read-only mode. The database, not the UI, decides who can write.
createOrderPopup();
render();

async function initializeZBlock() {
  const url = String(window.ZBLOCK_SUPABASE_URL || "").trim();
  const key = String(window.ZBLOCK_SUPABASE_ANON_KEY || "").trim();
  const configured = url.startsWith("https://") && key.length > 20 && !url.includes("YOUR_PROJECT") && !key.includes("PASTE_");
  if (!configured || !window.supabase?.createClient) {
    products = starterProducts.map(p => normalizeProduct(p));
    render();
    console.warn("Supabase is not configured. Showing demo products in read-only mode.");
    return;
  }
  supabaseClient = window.supabase.createClient(url, key);
  await loadRemoteProducts();
}

initializeZBlock().then(() => {
  const initialProductMatch = window.location.hash.match(/^#product-(\d+)$/);
  if (initialProductMatch) openDetails(Number(initialProductMatch[1]));
});

