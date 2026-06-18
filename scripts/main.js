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
  // Item 7: icon-only — the count lives in the badge; keep the label in aria only.
  button.innerHTML = `<span class="cart-ico">${CART_ICON}${badge}</span>`;
  button.setAttribute("aria-label", n > 0 ? `Ver carrinho (${n} item(ns))` : "Ver carrinho");
}

// Detail page image gallery: the full picture list lives on data-pictures while
// the template renders only the first as .detail-image. With 2+ photos, overlay
// ‹ › arrows on the main image and build a clickable thumbnail strip below it.
function setupDetailGallery(detail) {
  const gallery = detail.querySelector(".detail-gallery");
  const mainImage = gallery && gallery.querySelector(".detail-image");
  if (!gallery || !mainImage) return;

  const pictures = (detail.dataset.pictures || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (pictures.length <= 1) return; // single image: nothing to scroll through

  const title = detail.dataset.title || mainImage.alt || "";
  let index = 0;

  // Wrap the existing main image so the arrows can sit over it.
  const viewport = document.createElement("div");
  viewport.className = "gallery-viewport";
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "gallery-arrow gallery-prev";
  prev.setAttribute("aria-label", "Imagem anterior");
  prev.textContent = "‹";
  const next = document.createElement("button");
  next.type = "button";
  next.className = "gallery-arrow gallery-next";
  next.setAttribute("aria-label", "Próxima imagem");
  next.textContent = "›";
  mainImage.insertAdjacentElement("beforebegin", viewport);
  viewport.append(prev, mainImage, next);

  // Thumbnail strip below the viewport.
  const strip = document.createElement("div");
  strip.className = "gallery-thumbs";
  const thumbs = pictures.map((src, n) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "gallery-thumb";
    thumb.setAttribute("aria-label", `Ver imagem ${n + 1}`);
    const img = document.createElement("img");
    img.src = src;
    img.alt = `${title} — imagem ${n + 1}`;
    img.loading = "lazy";
    thumb.appendChild(img);
    thumb.addEventListener("click", () => show(n));
    strip.appendChild(thumb);
    return thumb;
  });
  // Sit the strip right under the image viewport, so any element placed after it
  // in the gallery (e.g. the WhatsApp button) stays below the thumbnails.
  viewport.insertAdjacentElement("afterend", strip);

  function show(i) {
    index = (i + pictures.length) % pictures.length; // wrap around both ends
    mainImage.src = pictures[index];
    thumbs.forEach((thumb, n) => {
      const active = n === index;
      thumb.classList.toggle("is-active", active);
      thumb.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  prev.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));
  show(0);
}

// Detail page: wire quantity, "Adicionar ao carrinho" and the WhatsApp link.
function setupProductDetail(detail) {
  setupDetailGallery(detail);
  const qtyInput = detail.querySelector(".qty-input");
  const addButton = detail.querySelector(".add-to-cart");
  const whatsappButtons = detail.querySelectorAll(".detail-whatsapp");

  if (whatsappButtons.length) {
    // plan.md line 25: message ends with this page's exact URL. The page has
    // more than one identical WhatsApp button (below the thumbnails and below
    // the description), so wire them all.
    const text =
      "Olá! Gostaria de mais informações sobre este produto: " +
      window.location.href;
    const href = "https://wa.me/5549988988526?text=" + encodeURIComponent(text);
    whatsappButtons.forEach((button) => { button.href = href; });
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
    obs.placeholder = 'Escreva aqui suas observações';
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

// Fallback copy of the order-message template (source: administration_app/templates/
// order_message.txt). That file IS deployed (under site/templates/, edited via the admin
// "Modelos" tab), so loadOrderTemplate normally fetches it; this built-in copy is the
// last resort if the fetch ever fails offline.
const ORDER_MESSAGE_FALLBACK =
  "{{item}}\n--------------------------\n{n}) {title}\n   Qtd: {qty} — {price} cada\n   Obs: {obs}\n{{pedido}}\n{saudacao}\n{items}==========================\nTotal: {total}\n{{saudacao}}\nOlá! Sou {nome} e gostaria de fazer este pedido:\n{{saudacao_anonima}}\nOlá! Gostaria de fazer este pedido:\n{{obs_vazia}}\n—\n";

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

// Split the template into named {{section}} blocks -> { name: text }. Each section's
// text runs from after its marker to the next marker (or EOF), with one leading newline
// dropped (so the section can start on the line below its marker). Comment lines (#) are
// stripped first. All message wording lives in these sections — nothing is hardcoded here.
function parseOrderTemplate(text) {
  const body = text
    .split("\n")
    .filter((l) => !l.startsWith("#"))
    .join("\n");
  const re = /\{\{(\w+)\}\}/g;
  const sections = {};
  let match;
  let name = null;
  let start = 0;
  while ((match = re.exec(body))) {
    if (name !== null) sections[name] = body.slice(start, match.index).replace(/^\n/, "");
    name = match[1];
    start = match.index + match[0].length;
  }
  if (name !== null) sections[name] = body.slice(start).replace(/^\n/, "");
  return sections;
}

function buildOrderMessage(cart, name, templateText) {
  const s = parseOrderTemplate(templateText);
  // Single-value sections are inline text; drop their trailing newline(s).
  const inline = (key) => (s[key] || "").replace(/\n+$/, "");
  const emptyObs = inline("obs_vazia");
  const items = cart
    .map((item, i) =>
      fillTemplate(s.item || "", {
        n: String(i + 1),
        title: item.title,
        qty: String(item.qty),
        price: item.price,
        obs: item.obs ? item.obs : emptyObs,
      })
    )
    .join("");
  const saudacao = fillTemplate(inline(name ? "saudacao" : "saudacao_anonima"), { nome: name });
  return fillTemplate(s.pedido || "", { saudacao, items, total: formatBRL(cartTotal(cart)) });
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

// Everything a search query can match on one card: visible title + every metadata
// data-* on the card (tags split into tokens), so new fields are searchable for free.
function cardHaystack(card) {
  const titleEl = card.querySelector(".product-title");
  const parts = [titleEl ? titleEl.textContent : ""];
  const d = card.dataset;
  for (const key in d) {
    parts.push(key === "tags" ? parseTags(d[key]).join(" ") : d[key]);
  }
  return normalizeText(parts.join(" "));
}

// Field filters AND the search query must all pass; every query token must match.
// `filter` is a flat object: every key except `query` is a data-<key> constraint
// (empty values ignored), so it works for categoria/subcategoria and any new field.
function cardMatches(card, filter) {
  const d = card.dataset;
  for (const key in filter) {
    if (key === "query") continue;
    const want = filter[key];
    if (want && normalizeText(d[key]) !== normalizeText(want)) return false;
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

// The grid shows at most this many cards at once; the rest are reached page by page.
const PAGE_SIZE = 10;

// Build the page switcher into `nav`: first/prev/next/last arrows + a window of up to
// five numbers centred on `page` + a "Página X de N" total label. Pure builder — every
// click delegates to onGoTo(targetPage); page state lives in the caller's closure.
// Hidden entirely while there is a single page (nothing to switch).
function renderPager(nav, page, totalPages, onGoTo) {
  if (!nav) return;
  if (totalPages <= 1) {
    nav.replaceChildren();
    nav.hidden = true;
    return;
  }
  nav.hidden = false;

  const arrow = (label, aria, target, disabled) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("aria-label", aria);
    b.disabled = disabled;
    if (!disabled) b.addEventListener("click", () => onGoTo(target));
    return b;
  };

  const children = [
    arrow("⏮", "Primeira página", 1, page === 1),
    arrow("◀", "Página anterior", page - 1, page === 1),
  ];

  // Up to two neighbours on each side, clamped to the valid range.
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let p = start; p <= end; p++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(p);
    b.setAttribute("aria-label", "Página " + p);
    if (p === page) {
      b.classList.add("is-current");
      b.setAttribute("aria-current", "page");
      b.disabled = true;
    } else {
      b.addEventListener("click", () => onGoTo(p));
    }
    children.push(b);
  }

  children.push(
    arrow("▶", "Próxima página", page + 1, page === totalPages),
    arrow("⏭", "Última página", totalPages, page === totalPages)
  );

  const total = document.createElement("span");
  total.className = "pagination-total";
  total.textContent = `Página ${page} de ${totalPages}`;
  children.push(total);

  nav.replaceChildren(...children);
}

// Index page: filter the grid from ?categoria/?subcategoria/?q and live search input.
function setupCatalogFilter() {
  const grid = document.getElementById("produtos_disponiveis");
  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  // q -> free-text search; every other param -> a data-<key> field filter, so the
  // bar can filter by categoria/subcategoria/tema/personagem or any future field.
  const state = { query: (params.get("q") || "").trim() };
  params.forEach((value, key) => {
    if (key !== "q") state[key] = (value || "").trim();
  });

  const status = document.getElementById("filter_status");
  const statusText = document.getElementById("filter_status_text");
  const clearButton = document.getElementById("filter_clear");
  const noResults = document.getElementById("no_results");
  const searchInput = document.querySelector("#product_search input[name='q']");
  if (searchInput && state.query) searchInput.value = state.query;

  const pager = document.getElementById("pagination");
  let currentPage = 1;

  // Jump to a page and re-render (clamped in apply()); scroll the grid back into view
  // so the new page starts from the top.
  function goToPage(target) {
    currentPage = target;
    apply();
    // Guarded: scrollIntoView is unavailable under jsdom (unit tests).
    if (typeof grid.scrollIntoView === "function") {
      grid.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function apply() {
    // Cards passing the active filter/search, then sliced to the current page.
    const matched = [...grid.querySelectorAll(".displayed_product")].filter((card) =>
      cardMatches(card, state)
    );
    const totalPages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    grid.querySelectorAll(".displayed_product").forEach((card) => {
      card.hidden = true;
    });
    const start = (currentPage - 1) * PAGE_SIZE;
    matched.slice(start, start + PAGE_SIZE).forEach((card) => {
      card.hidden = false;
    });
    renderPager(pager, currentPage, totalPages, goToPage);

    if (noResults) noResults.hidden = matched.length > 0;
    // Categoria (+ its subcategoria) reads as one crumb; other fields list their value.
    const parts = [];
    if (state.categoria) {
      parts.push(
        state.subcategoria
          ? `${state.categoria} › ${state.subcategoria}`
          : state.categoria
      );
    }
    for (const key in state) {
      if (key === "query" || key === "categoria" || key === "subcategoria") continue;
      if (state[key]) parts.push(state[key]);
    }
    const active = parts.length > 0 || state.query;
    if (status && statusText) {
      const shown = [...parts];
      if (state.query) shown.push(`busca: “${state.query}”`);
      statusText.textContent = shown.length ? "Filtrando: " + shown.join(" · ") : "";
      status.hidden = !active;
    }
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      for (const key in state) state[key] = "";
      if (searchInput) searchInput.value = "";
      history.replaceState(null, "", "index.html#produtos_disponiveis");
      currentPage = 1; // a fresh, unfiltered grid starts at page 1
      apply();
    });
  }

  const form = document.getElementById("product_search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.query = searchInput.value.trim();
      currentPage = 1; // a changed query re-runs the catalog from page 1
      // A new search runs across the whole catalog: typing drops any active
      // category/field filter so it can't hide products the query would match.
      if (state.query) {
        let cleared = false;
        for (const key in state) {
          if (key !== "query" && state[key]) {
            state[key] = "";
            cleared = true;
          }
        }
        if (cleared) {
          history.replaceState(
            null,
            "",
            "index.html?q=" + encodeURIComponent(state.query) + "#produtos_disponiveis"
          );
        }
      }
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

// Dynamic category bar (#category_filter_bar): dropdowns built from the schema's
// data-menu (the role/label list the admin app writes onto the nav) + the live
// product cards, so titles and sub-items reflect the products actually shown.
//   primary  -> one button per distinct value (e.g. each Categoria), its panel
//               listing "Ver tudo" + the nested field's values for that value.
//   nested   -> consumed as a primary's sub-items (e.g. Subcategoria).
//   own      -> one button labelled with the field's label, listing its values.
// Empty groups are dropped (no products → no button). data-tags is never used.
function buildCategoryBar(root) {
  const nav = document.getElementById("category_filter_bar");
  if (!nav) return;
  let config;
  try {
    config = JSON.parse(nav.dataset.menu || "[]");
  } catch {
    config = [];
  }
  if (!Array.isArray(config) || config.length === 0) {
    nav.replaceChildren();
    return;
  }

  const cards = [...root.querySelectorAll("#produtos_disponiveis .displayed_product")];
  const collator = new Intl.Collator("pt-BR");
  const closeAll = () =>
    nav.querySelectorAll(".category-dropdown.open").forEach((d) => d.classList.remove("open"));

  // Distinct, sorted non-empty values of a data-<key> across the displayed cards.
  const distinct = (key) => {
    const set = new Set();
    cards.forEach((card) => {
      const v = (card.dataset[key] || "").trim();
      if (v) set.add(v);
    });
    return [...set].sort(collator.compare);
  };

  const link = (text, params, cls) => {
    const a = document.createElement("a");
    a.href =
      "index.html?" +
      Object.entries(params)
        .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
        .join("&") +
      "#produtos_disponiveis";
    a.textContent = text;
    if (cls) a.className = cls;
    return a;
  };

  // One dropdown from a label + its sub-item links; null when there are none.
  const dropdown = (label, items) => {
    if (items.length === 0) return null;
    const wrap = document.createElement("div");
    wrap.className = "category-dropdown";
    const toggle = document.createElement("button");
    toggle.className = "category-toggle";
    toggle.type = "button";
    toggle.textContent = label;
    const panel = document.createElement("ul");
    panel.className = "category-panel";
    items.forEach((a) => {
      const li = document.createElement("li");
      li.appendChild(a);
      panel.appendChild(li);
    });
    wrap.append(toggle, panel);
    toggle.addEventListener("click", () => {
      const open = wrap.classList.contains("open");
      closeAll(); // CSS handles desktop hover; this is the touch/click path
      wrap.classList.toggle("open", !open);
    });
    return wrap;
  };

  const nestedEntry = config.find((e) => e.menu === "nested");
  const built = [];
  config.forEach((entry) => {
    if (entry.menu === "nested") return; // consumed under the primary group(s)
    if (entry.menu === "primary") {
      distinct(entry.key).forEach((value) => {
        const items = [link("Ver tudo", { [entry.key]: value })];
        if (nestedEntry) {
          const subs = new Set();
          cards.forEach((card) => {
            if ((card.dataset[entry.key] || "").trim() !== value) return;
            const s = (card.dataset[nestedEntry.key] || "").trim();
            if (s) subs.add(s);
          });
          [...subs].sort(collator.compare).forEach((s) =>
            items.push(link(s, { [entry.key]: value, [nestedEntry.key]: s }, "category-panel-sub"))
          );
        }
        const d = dropdown(value, items);
        if (d) built.push(d);
      });
    } else if (entry.menu === "own") {
      const items = distinct(entry.key).map((v) => link(v, { [entry.key]: v }));
      const d = dropdown(entry.label, items);
      if (d) built.push(d);
    }
  });

  nav.replaceChildren(...built);

  if (!nav.dataset.wired) {
    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target)) closeAll();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });
    nav.dataset.wired = "1";
  }
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
  buildCategoryBar(document); // dynamic #category_filter_bar from data-menu + cards
  setupFooterShare();
  setupHeaderAutoHide();
});

// Fade the sticky header out while the visitor browses the products grid, so it
// never sits on top of the cards. "Produtos" tucks it away — on the same page
// and when arriving from another page (e.g. a detail page) via its hash link.
// Desktop keeps it hidden while the pointer is over the grid; touch devices have
// no hover, so it fades back in when the visitor scrolls back to the top.
const PRODUCTS_HASH = "#nossos_produtos_heading";

function setupHeaderAutoHide() {
  const header = document.getElementById("main_header");
  if (!header) return;
  const hide = () => header.classList.add("is-hidden");
  const show = () => header.classList.remove("is-hidden");
  const products = document.getElementById("products_section");

  // True once the grid has scrolled up to (under) the sticky header.
  const atGrid = () =>
    !!products && products.getBoundingClientRect().top <= header.offsetHeight;

  // Scroll position is the source of truth — no touch/hover needed, so this also
  // tucks the header away on mobile as soon as the grid reaches the top, and
  // brings it back once the visitor scrolls to the top of the page.
  const syncToScroll = () => {
    if (window.scrollY <= 8) show();
    else if (atGrid()) hide();
  };

  const navProdutos = document.getElementById("nav_produtos");
  if (navProdutos) navProdutos.addEventListener("click", hide);

  // Landing here via the "Produtos" link (same page or from a detail page)
  // arrives at this hash — start with the header already tucked away.
  if (window.location.hash === PRODUCTS_HASH) hide();

  if (products) {
    products.addEventListener("mouseenter", hide);
    // On leave, defer to scroll position so it never pops back over the grid.
    products.addEventListener("mouseleave", () => { if (!atGrid()) show(); });
  }

  window.addEventListener("scroll", syncToScroll, { passive: true });
}

// Footer "Compartilhar" button: native share sheet where available, otherwise
// copy the page URL to the clipboard and briefly confirm on the button label.
function setupFooterShare() {
  const button = document.querySelector(".footer-share");
  if (!button) return;
  const label = button.querySelector("span");
  button.addEventListener("click", async () => {
    const url = window.location.href;
    const title = document.title || "Ateliê Marcela Boniati";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (_) {
        /* user dismissed the share sheet — nothing to do */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      if (label) {
        const original = label.textContent;
        label.textContent = "Link copiado!";
        setTimeout(() => { label.textContent = original; }, 1800);
      }
    } catch (_) {
      window.prompt("Copie o link:", url);
    }
  });
}
