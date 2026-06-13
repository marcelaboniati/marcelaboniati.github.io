// Site interactivity. Plain DOM APIs, no dependencies.

// "Produtos em destaque" carousel: arrows scroll the strip one product per click
// and gray out (disable) when there is nothing more to scroll in that direction.
function setupFeaturedCarousel(carousel) {
  const track = carousel.querySelector("#produtos_destaque");
  const leftArrow = carousel.querySelector(".scroll-left");
  const rightArrow = carousel.querySelector(".scroll-right");
  if (!track || !leftArrow || !rightArrow) return;

  // One card width + the flex gap between cards; falls back to the visible width.
  function step() {
    const card = track.querySelector(".featured_product");
    if (!card) return track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 12;
    return card.offsetWidth + gap;
  }

  function updateArrows() {
    const maxScroll = track.scrollWidth - track.clientWidth;
    // Nothing to scroll (e.g. few items on a wide screen): hide the arrows
    // entirely rather than showing permanently-disabled controls.
    const noOverflow = maxScroll <= 1;
    leftArrow.style.display = noOverflow ? "none" : "";
    rightArrow.style.display = noOverflow ? "none" : "";
    if (noOverflow) return;
    leftArrow.disabled = track.scrollLeft <= 1;
    rightArrow.disabled = track.scrollLeft >= maxScroll - 1;
  }

  leftArrow.addEventListener("click", () => {
    track.scrollBy({ left: -step(), behavior: "smooth" });
  });
  rightArrow.addEventListener("click", () => {
    track.scrollBy({ left: step(), behavior: "smooth" });
  });

  track.addEventListener("scroll", updateArrows, { passive: true });
  window.addEventListener("resize", updateArrows);
  updateArrows();
}

// --- Shopping cart, persisted in localStorage (no backend on this static host) ---
const CART_KEY = "atelie_cart";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// Add an item (or bump its quantity if the same slug is already in the cart).
function addToCart(item) {
  const cart = getCart();
  const existing = cart.find((i) => i.slug === item.slug);
  if (existing) {
    existing.qty += item.qty;
  } else {
    cart.push(item);
  }
  saveCart(cart);
}

function cartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

// Outline cart icon — inherits the button's text color (currentColor) so it stays
// crisp on any theme, unlike the multicolor 🛒 emoji.
const CART_ICON =
  '<svg class="cart-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4"></circle><circle cx="17" cy="20" r="1.4"></circle><path d="M2 3h2.2l2.1 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6"></path></svg>';

// Reflect the cart size in the header button on every page (count = badge on icon).
function updateCartButton() {
  const button = document.getElementById("cart_button");
  if (!button) return;
  const n = cartCount();
  const badge = n > 0 ? `<span class="cart-badge">${n}</span>` : "";
  button.innerHTML =
    `<span class="cart-ico">${CART_ICON}${badge}</span><span class="cart-label">Ver carrinho</span>`;
}

// Detail page: wire quantity, "Adicionar ao carrinho" and the WhatsApp link.
function setupProductDetail(detail) {
  const qtyInput = detail.querySelector(".qty-input");
  const addButton = detail.querySelector(".add-to-cart");
  const whatsapp = detail.querySelector(".detail-whatsapp");

  if (whatsapp) {
    // plan.md line 25: message ends with this page's exact URL.
    const text =
      "Olá! Gostaria de mais informações sobre este produto: " +
      window.location.href;
    whatsapp.href = "https://wa.me/5549988988526?text=" + encodeURIComponent(text);
  }

  // P5: −/+ stepper around the quantity input (consistent with the cart page).
  const qtyControl = detail.querySelector(".qty-control");
  if (qtyControl && qtyInput) {
    const dec = document.createElement("button");
    dec.type = "button";
    dec.className = "qty-dec";
    dec.textContent = "−";
    dec.setAttribute("aria-label", "Diminuir quantidade");
    const inc = document.createElement("button");
    inc.type = "button";
    inc.className = "qty-inc";
    inc.textContent = "+";
    inc.setAttribute("aria-label", "Aumentar quantidade");
    const adjust = (delta) => {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) + delta);
    };
    dec.addEventListener("click", () => adjust(-1));
    inc.addEventListener("click", () => adjust(1));
    qtyInput.insertAdjacentElement("beforebegin", dec);
    qtyInput.insertAdjacentElement("afterend", inc);
  }

  // P4: a "Ver carrinho" shortcut that appears once something has been added.
  let viewCart = null;
  const actions = detail.querySelector(".detail-actions");
  if (actions) {
    viewCart = document.createElement("a");
    viewCart.className = "btn-secondary view-cart";
    viewCart.href = "carrinho.html";
    viewCart.textContent = "Ver carrinho →";
    viewCart.style.display = "none";
    actions.appendChild(viewCart);
  }

  if (addButton) {
    // Related spot: give the add-to-cart button the same cart icon.
    addButton.innerHTML = `${CART_ICON}<span>${addButton.textContent.trim()}</span>`;
    addButton.addEventListener("click", () => {
      let qty = parseInt(qtyInput && qtyInput.value, 10);
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      addToCart({
        slug: detail.dataset.slug,
        title: detail.dataset.title,
        price: detail.dataset.price,
        // data-pictures is the full comma-separated list; the cart thumb
        // (carrinho uses item.pictures as the img src) wants only the first.
        pictures: (detail.dataset.pictures || "").split(",")[0],
        qty,
      });
      updateCartButton();
      if (viewCart) viewCart.style.display = "";
      // Pin the current width so the shorter confirmation can't shrink the button
      // and reflow the row; save/restore innerHTML so the icon survives the swap.
      addButton.style.minWidth = addButton.offsetWidth + "px";
      const original = addButton.innerHTML;
      addButton.textContent = "Adicionado ✓";
      addButton.disabled = true;
      setTimeout(() => {
        addButton.innerHTML = original;
        addButton.disabled = false;
      }, 1500);
    });
  }
}

// Cart mutations used by the cart page.
function setQty(slug, qty) {
  const cart = getCart();
  const item = cart.find((i) => i.slug === slug);
  if (item) {
    item.qty = Math.max(1, qty);
    saveCart(cart);
  }
}

function removeItem(slug) {
  saveCart(getCart().filter((i) => i.slug !== slug));
}

function setObs(slug, obs) {
  const cart = getCart();
  const item = cart.find((i) => i.slug === slug);
  if (item) {
    item.obs = obs;
    saveCart(cart);
  }
}

function clearCart() {
  saveCart([]);
}

// --- Money helpers (BRL): parse "R$1.234,56" -> 1234.56 and format back ---
function parsePrice(str) {
  const cleaned = String(str).replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatBRL(n) {
  const [int, dec] = n.toFixed(2).split(".");
  return "R$" + int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
}

function cartTotal(cart) {
  return cart.reduce((sum, i) => sum + parsePrice(i.price) * i.qty, 0);
}

// --- Cart page -------------------------------------------------------------- #
function renderCartPage() {
  const container = document.getElementById("cart_container");
  if (!container) return;

  function emptyState() {
    const p = document.createElement("p");
    p.className = "cart-empty";
    p.innerHTML = 'Seu carrinho está vazio. <a href="index.html">Voltar aos produtos</a>.';
    return p;
  }

  function row(item, redraw) {
    const el = document.createElement("div");
    el.className = "cart-item";

    if (item.pictures) {
      const img = document.createElement("img");
      img.className = "cart-thumb";
      img.src = item.pictures;
      img.alt = item.title;
      el.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "cart-item-info";
    const title = document.createElement("a");
    title.className = "cart-item-title";
    title.href = `produto-${item.slug}.html`;
    title.textContent = item.title;
    const unit = document.createElement("span");
    unit.className = "cart-item-unit";
    unit.textContent = `${item.price} cada`;
    const obsLabel = document.createElement("label");
    obsLabel.className = "cart-obs-label";
    obsLabel.textContent = "Personalização (opcional)";
    const obs = document.createElement("textarea");
    obs.className = "cart-obs";
    obs.maxLength = 200;
    obs.rows = 2;
    obs.placeholder = 'Ex.: escrever "Ana" no topo';
    obs.value = item.obs || "";
    obs.addEventListener("input", () => setObs(item.slug, obs.value));
    obsLabel.appendChild(obs);
    info.append(title, unit, obsLabel);
    el.appendChild(info);

    const controls = document.createElement("div");
    controls.className = "cart-item-controls";

    const qtyCtl = document.createElement("div");
    qtyCtl.className = "qty-control";
    const dec = document.createElement("button");
    dec.type = "button";
    dec.className = "qty-dec";
    dec.textContent = "−";
    dec.setAttribute("aria-label", "Diminuir quantidade");
    const qty = document.createElement("input");
    qty.type = "number";
    qty.min = "1";
    qty.className = "qty-input";
    qty.value = item.qty;
    qty.inputMode = "numeric";
    const inc = document.createElement("button");
    inc.type = "button";
    inc.className = "qty-inc";
    inc.textContent = "+";
    inc.setAttribute("aria-label", "Aumentar quantidade");
    const change = (v) => {
      setQty(item.slug, Math.max(1, parseInt(v, 10) || 1));
      redraw();
      updateCartButton();
    };
    dec.addEventListener("click", () => change(item.qty - 1));
    inc.addEventListener("click", () => change(item.qty + 1));
    qty.addEventListener("change", () => change(qty.value));
    qtyCtl.append(dec, qty, inc);

    const subtotal = document.createElement("span");
    subtotal.className = "cart-item-subtotal";
    subtotal.textContent = formatBRL(parsePrice(item.price) * item.qty);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "cart-remove";
    remove.textContent = "Remover";
    remove.addEventListener("click", () => {
      removeItem(item.slug);
      redraw();
      updateCartButton();
    });

    controls.append(qtyCtl, subtotal, remove);
    el.appendChild(controls);
    return el;
  }

  function draw() {
    const cart = getCart();
    container.innerHTML = "";
    if (cart.length === 0) {
      container.appendChild(emptyState());
      return;
    }

    const list = document.createElement("div");
    list.className = "cart-list";
    cart.forEach((item) => list.appendChild(row(item, draw)));
    container.appendChild(list);

    const footer = document.createElement("div");
    footer.className = "cart-footer";
    const total = document.createElement("p");
    total.className = "cart-total";
    total.innerHTML = `Total: <strong>${formatBRL(cartTotal(cart))}</strong>`;

    const actions = document.createElement("div");
    actions.className = "cart-actions";
    const cont = document.createElement("a");
    cont.className = "btn-secondary";
    cont.href = "index.html";
    cont.textContent = "Continuar comprando";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "btn-secondary";
    clear.textContent = "Limpar carrinho";
    clear.addEventListener("click", () => {
      clearCart();
      draw();
      updateCartButton();
    });
    const checkout = document.createElement("a");
    checkout.className = "btn-primary";
    checkout.href = "resumo.html";
    checkout.textContent = "Fazer o pedido";
    actions.append(cont, clear, checkout);

    footer.append(total, actions);
    container.appendChild(footer);
  }

  draw();
}

// --- Order message + "Resumo do pedido" page -------------------------------- #
const WHATSAPP_GLYPH =
  '<svg aria-hidden="true" class="whatsapp_glyph" fill="currentColor" focusable="false" height="20" viewbox="0 0 32 32" width="20"><path d="M16 .4C7.4.4.4 7.4.4 16c0 2.8.7 5.5 2.1 7.9L.3 31.6l7.9-2.1c2.3 1.3 4.9 1.9 7.5 1.9h.3c8.6 0 15.6-7 15.6-15.6S24.6.4 16 .4zm0 28.5c-2.4 0-4.7-.6-6.7-1.8l-.5-.3-4.7 1.2 1.3-4.6-.3-.5a12.9 12.9 0 0 1-2-6.9C2.4 8.9 8.5 2.9 16 2.9S29.6 8.9 29.6 16 23.5 28.9 16 28.9zm7.4-9.7c-.4-.2-2.4-1.2-2.7-1.3-.4-.1-.7-.2-.9.2-.3.4-1 1.3-1.3 1.6-.2.2-.5.3-.9.1-.4-.2-1.7-.6-3.3-2-1.2-1.1-2-2.4-2.3-2.8-.2-.4 0-.6.2-.8l.6-.7c.2-.2.3-.4.4-.6.1-.2 0-.5 0-.7-.1-.2-.9-2.2-1.3-3-.3-.8-.6-.7-.9-.7h-.7c-.2 0-.6.1-1 .5-.3.4-1.3 1.3-1.3 3.1s1.3 3.6 1.5 3.9c.2.3 2.6 4 6.3 5.6.9.4 1.6.6 2.1.8.9.3 1.7.2 2.3.1.7-.1 2.4-1 2.7-1.9.3-.9.3-1.7.2-1.9-.1-.2-.4-.3-.8-.5z"></path></svg>';

// Fallback copy of templates/order_message.txt — templates/ is not deployed, so
// the live site relies on this when the fetch is unavailable.
const ORDER_MESSAGE_FALLBACK =
  "{{item}}\n{n}) {title}\n   Qtd: {qty} — {price} cada\n   Obs: {obs}\n\n{{pedido}}\n{saudacao}\n\n{items}Total: {total}\n";

async function loadOrderTemplate() {
  try {
    const res = await fetch("templates/order_message.txt", { cache: "no-store" });
    if (res.ok) return await res.text();
  } catch {
    /* fall through to the built-in copy */
  }
  return ORDER_MESSAGE_FALLBACK;
}

// Replace {key} tokens from a map; missing keys are left untouched. A function
// replacer keeps "$" in values literal and never re-scans inserted text.
function fillTemplate(tpl, map) {
  return tpl.replace(/{(\w+)}/g, (m, k) => (k in map ? map[k] : m));
}

function parseOrderTemplate(text) {
  const body = text
    .split("\n")
    .filter((l) => !l.startsWith("#"))
    .join("\n");
  const itemTpl = body.slice(body.indexOf("{{item}}") + 8, body.indexOf("{{pedido}}")).replace(/^\n/, "");
  const pedidoTpl = body.slice(body.indexOf("{{pedido}}") + 10).replace(/^\n/, "");
  return { itemTpl, pedidoTpl };
}

function buildOrderMessage(cart, name, templateText) {
  const { itemTpl, pedidoTpl } = parseOrderTemplate(templateText);
  const items = cart
    .map((item, i) =>
      fillTemplate(itemTpl, {
        n: String(i + 1),
        title: item.title,
        qty: String(item.qty),
        price: item.price,
        obs: item.obs ? item.obs : "—",
      })
    )
    .join("");
  const saudacao = name
    ? `Olá! Sou ${name} e gostaria de fazer este pedido:`
    : "Olá! Gostaria de fazer este pedido:";
  return fillTemplate(pedidoTpl, { saudacao, items, total: formatBRL(cartTotal(cart)) });
}

function renderResumoPage() {
  const container = document.getElementById("summary_container");
  if (!container) return;
  const cart = getCart();
  container.innerHTML = "";

  if (cart.length === 0) {
    const p = document.createElement("p");
    p.className = "cart-empty";
    p.innerHTML = 'Seu carrinho está vazio. <a href="index.html">Voltar aos produtos</a>.';
    container.appendChild(p);
    return;
  }

  const list = document.createElement("ol");
  list.className = "summary-list";
  cart.forEach((item) => {
    const li = document.createElement("li");
    li.className = "summary-item";
    const head = document.createElement("div");
    head.className = "summary-item-head";
    const title = document.createElement("span");
    title.className = "summary-item-title";
    title.textContent = item.title;
    const sub = document.createElement("span");
    sub.className = "summary-item-subtotal";
    sub.textContent = formatBRL(parsePrice(item.price) * item.qty);
    head.append(title, sub);
    const meta = document.createElement("div");
    meta.className = "summary-item-meta";
    meta.textContent = `Qtd: ${item.qty} — ${item.price} cada`;
    li.append(head, meta);
    if (item.obs) {
      const obs = document.createElement("div");
      obs.className = "summary-item-obs";
      obs.textContent = `Obs: ${item.obs}`;
      li.appendChild(obs);
    }
    list.appendChild(li);
  });
  container.appendChild(list);

  const total = document.createElement("p");
  total.className = "cart-total";
  total.innerHTML = `Total: <strong>${formatBRL(cartTotal(cart))}</strong>`;
  container.appendChild(total);

  const nameLabel = document.createElement("label");
  nameLabel.className = "name-field";
  nameLabel.textContent = "Seu nome (opcional)";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.id = "customer_name";
  nameInput.maxLength = 80;
  nameInput.placeholder = "Como podemos te chamar?";
  nameLabel.appendChild(nameInput);
  container.appendChild(nameLabel);

  const actions = document.createElement("div");
  actions.className = "resumo-actions";
  const back = document.createElement("a");
  back.className = "btn-secondary";
  back.href = "carrinho.html";
  back.textContent = "Voltar ao carrinho";
  const send = document.createElement("a");
  send.className = "whatsapp_button btn-primary";
  send.href = "#";
  send.innerHTML = WHATSAPP_GLYPH + "<span>Enviar o pedido via Whatsapp</span>";
  send.addEventListener("click", async (e) => {
    e.preventDefault();
    const tpl = await loadOrderTemplate();
    const msg = buildOrderMessage(getCart(), nameInput.value.trim(), tpl);
    window.location.href = "https://wa.me/5549988988526?text=" + encodeURIComponent(msg);
  });
  actions.append(back, send);
  container.appendChild(actions);
}

// --- Category browsing + search ---------------------------------------------- #
// The displayed cards carry data-categoria/subcategoria/tema/tags (template-filled
// metadata, invisible to visitors); the grid is filtered in place — no backend.

// Accent- and case-insensitive comparison base (pt-BR: "Páscoa" matches "pascoa").
function normalizeText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// "vela, biscuit , azul" -> ["vela", "biscuit", "azul"]
function parseTags(csv) {
  return String(csv || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Everything a search query can match on one card: visible title + the metadata.
function cardHaystack(card) {
  const d = card.dataset;
  const titleEl = card.querySelector(".product-title");
  const title = titleEl ? titleEl.textContent : "";
  return normalizeText(
    [title, d.categoria, d.subcategoria, d.tema, parseTags(d.tags).join(" ")].join(" ")
  );
}

// Category filter AND search query must both pass; every query token must match.
function cardMatches(card, filter) {
  const d = card.dataset;
  if (filter.categoria && normalizeText(d.categoria) !== normalizeText(filter.categoria)) {
    return false;
  }
  if (
    filter.subcategoria &&
    normalizeText(d.subcategoria) !== normalizeText(filter.subcategoria)
  ) {
    return false;
  }
  const q = normalizeText(filter.query);
  if (!q) return true;
  const hay = cardHaystack(card);
  return q.split(/\s+/).every((token) => hay.includes(token));
}

// Map(categoria -> Set(subcategorias)) from the displayed cards, so the menu only
// ever shows categories that actually have products (uncategorized cards skipped).
function categoriesFromCards(root) {
  const map = new Map();
  root.querySelectorAll("#produtos_disponiveis .displayed_product").forEach((card) => {
    const cat = (card.dataset.categoria || "").trim();
    if (!cat) return;
    if (!map.has(cat)) map.set(cat, new Set());
    const sub = (card.dataset.subcategoria || "").trim();
    if (sub) map.get(cat).add(sub);
  });
  return map;
}

// Index page: filter the grid from ?categoria/?subcategoria/?q and live search input.
function setupCatalogFilter() {
  const grid = document.getElementById("produtos_disponiveis");
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  const state = {
    categoria: (params.get("categoria") || "").trim(),
    subcategoria: (params.get("subcategoria") || "").trim(),
    query: (params.get("q") || "").trim(),
  };

  const status = document.getElementById("filter_status");
  const statusText = document.getElementById("filter_status_text");
  const clearButton = document.getElementById("filter_clear");
  const noResults = document.getElementById("no_results");
  const searchInput = document.querySelector("#product_search input[name='q']");
  if (searchInput && state.query) searchInput.value = state.query;

  function apply() {
    let visible = 0;
    grid.querySelectorAll(".displayed_product").forEach((card) => {
      const show = cardMatches(card, state);
      card.hidden = !show;
      if (show) visible++;
    });
    if (noResults) noResults.hidden = visible > 0;
    const active = state.categoria || state.query;
    if (status && statusText) {
      const parts = [];
      if (state.categoria) {
        parts.push(
          state.subcategoria
            ? `${state.categoria} › ${state.subcategoria}`
            : state.categoria
        );
      }
      if (state.query) parts.push(`busca: “${state.query}”`);
      statusText.textContent = parts.length ? "Filtrando: " + parts.join(" · ") : "";
      status.hidden = !active;
    }
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      state.categoria = "";
      state.subcategoria = "";
      state.query = "";
      if (searchInput) searchInput.value = "";
      history.replaceState(null, "", "index.html#produtos_disponiveis");
      apply();
    });
  }

  const form = document.getElementById("product_search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.query = searchInput.value.trim();
      apply();
    });
  }
  if (form) {
    // The grid is already filtered live; a submit must not reload the page.
    form.addEventListener("submit", (e) => e.preventDefault());
  }

  apply();
}

// Other pages (detail/cart/resumo): the header search navigates to the index grid.
function setupHeaderSearch() {
  if (document.getElementById("produtos_disponiveis")) return; // index handles itself
  const form = document.getElementById("product_search");
  const input = form && form.querySelector("input[name='q']");
  if (!form || !input) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    const query = q ? "?q=" + encodeURIComponent(q) : "";
    window.location.href = "index.html" + query + "#produtos_disponiveis";
  });
}

// "Produtos ▾" nav menu: categorias + subcategorias as links to the filtered grid.
// Built from live card metadata so it never goes stale; on pages without the grid
// the index is fetched once (on failure the trigger stays a plain working link).
async function setupCategoryMenu() {
  const trigger = document.getElementById("nav_produtos");
  const wrap = trigger && trigger.closest(".nav-dropdown");
  if (!wrap) return;

  let root = document;
  if (!document.getElementById("produtos_disponiveis")) {
    try {
      const res = await fetch("index.html");
      if (!res.ok) return;
      root = new DOMParser().parseFromString(await res.text(), "text/html");
    } catch {
      return;
    }
  }
  const cats = categoriesFromCards(root);
  if (cats.size === 0) return;

  const panel = document.createElement("div");
  panel.className = "nav-panel";
  panel.hidden = true;
  const collator = new Intl.Collator("pt-BR");
  [...cats.keys()].sort(collator.compare).forEach((cat) => {
    const catLink = document.createElement("a");
    catLink.href =
      "index.html?categoria=" + encodeURIComponent(cat) + "#produtos_disponiveis";
    catLink.textContent = cat;
    panel.appendChild(catLink);
    [...cats.get(cat)].sort(collator.compare).forEach((sub) => {
      const subLink = document.createElement("a");
      subLink.className = "nav-panel-sub";
      subLink.href =
        "index.html?categoria=" + encodeURIComponent(cat) +
        "&subcategoria=" + encodeURIComponent(sub) + "#produtos_disponiveis";
      subLink.textContent = sub;
      panel.appendChild(subLink);
    });
  });
  wrap.appendChild(panel);

  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  trigger.insertAdjacentText("beforeend", " ▾");
  const setOpen = (open) => {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  };
  trigger.addEventListener("click", (e) => {
    e.preventDefault(); // tap opens the menu; the panel links do the navigating
    setOpen(panel.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".featured_carousel").forEach(setupFeaturedCarousel);
  document.querySelectorAll(".detailed_product").forEach(setupProductDetail);
  updateCartButton();
  const cartButton = document.getElementById("cart_button");
  if (cartButton) {
    cartButton.addEventListener("click", () => {
      window.location.href = "carrinho.html";
    });
  }
  renderCartPage();
  renderResumoPage();
  setupCatalogFilter();
  setupHeaderSearch();
  setupCategoryMenu();
});
