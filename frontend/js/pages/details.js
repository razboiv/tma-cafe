// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import * as Requests from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

// ── утилиты ───────────────────────────────────────────────────────────────────
const W   = () => window.Telegram?.WebApp;
const $   = (s, r = document) => r.querySelector(s);
const $$  = (s, r = document) => Array.from(r.querySelectorAll(s));
const txt = (sel, v) => { const el = $(sel); if (el) el.textContent = v; return el; };
const img = (sel, url) => {
  const el = $(sel); if (!el) return;
  if (url) { el.src = url; el.style.removeProperty("display"); }
  else el.style.display = "none";
};
const showMB = (label, cb) => {
  try {
    TelegramSDK.showMainButton?.(label, cb);
    const w = W();
    w?.MainButton?.setText?.(label);
    w?.MainButton?.onClick?.(cb);
    w?.onEvent?.("mainButtonClicked", cb);
    w?.MainButton?.enable?.();
    w?.MainButton?.show?.();
  } catch {}
};

// ── извлечение id из любых форм ───────────────────────────────────────────────
function tryJsonId(s) {
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj === "object") {
      if ("id"  in obj) return String(obj.id);
      if ("dir" in obj) return String(obj.dir);
    }
  } catch {}
  return null;
}

function readIdFromHash() {
  const h   = location.hash || "";
  const dec = decodeURIComponent(h);

  // #/details/<что-то>
  let m = dec.match(/#\/?details\/([^/?#]+)/i);
  if (m) {
    const raw = m[1];
    return tryJsonId(raw) || raw;
  }

  // ?id=... / ?dir=...
  m = dec.match(/[?&#](?:id|dir)=([^&#]+)/i);
  if (m) return m[1];

  // ?params=<json> / ?p=<json>
  m = dec.match(/[?&#](?:params|p)=([^&#]+)/i);
  if (m) {
    const raw = m[1];
    return tryJsonId(raw) || raw;
  }

  // запасной вариант — последний сегмент как json
  const last = dec.split("/").pop();
  const t = tryJsonId(last);
  if (t) return t;

  return null;
}

function normalizeId(params) {
  // объект { id: 'burger-1' } или { dir: 'burger-1' }
  if (params && typeof params === "object") {
    if ("id"  in params) return String(params.id);
    if ("dir" in params) return String(params.dir);
  }
  // строка — может быть json
  if (typeof params === "string") {
    const s  = decodeURIComponent(params);
    const id = tryJsonId(s);
    return id || s;
  }
  // dataset / hash
  const ds = document.body?.dataset || {};
  return ds.itemId || ds.dir || ds.id || readIdFromHash() || null;
}

// ── загрузка товара ───────────────────────────────────────────────────────────
async function getItem(id) {
  try {
    if (typeof Requests.getMenuItem === "function") {
      return await Requests.getMenuItem(id);
    }
  } catch {}
  try {
    const r = await fetch(`${location.origin}/menu/details/${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (e) {
    console.error("fetch details failed", e);
    return null;
  }
}

function removeSkeleton() {
  $$(".shimmer,[data-skeleton],.skeleton").forEach(el => el.style.display = "none");
  $$("[data-content],.details-content").forEach(el => el.style.removeProperty("display"));
}

// ── страница Details ──────────────────────────────────────────────────────────
export default class DetailsPage extends Route {
  constructor() { super("details", "/pages/details.html"); }

  async load(params) {
    // чтобы наш persist-mb не перехватывал клик
    document.body.dataset.mainbutton = "add";

    const id = normalizeId(params);
    console.log("[Details] normalized id =", id, "params =", params);

    if (!id) return;                 // без id оставим скелет

    this.item    = await getItem(id);
    if (!this.item) return;

    this.qty     = 1;
    this.variant = this.item?.variants?.[0] || null;

    this.render();

    // показываем кнопку «ADD TO CART», переход в корзину — по нажатию.
    showMB("ADD TO CART", () => this.addToCart());
  }

  render() {
    const it = this.item || {};
    removeSkeleton();

    img ("#cafe-item-details-image", it.image || it.imageUrl || it.coverImage || "");
    txt ("#cafe-item-details-name", it.name || "");
    txt ("#cafe-item-details-description", it.description || "");
    txt ("#cafe-item-details-section-title", "Price");

    // варианты
    const wrap = $("#cafe-item-details-variants");
    if (wrap) {
      wrap.innerHTML = "";
      (it.variants || []).forEach((v, i) => {
        const b = document.createElement("button");
        b.className = "cafe-item-details-variant";
        b.textContent = v.name || "";
        if (i === 0) b.classList.add("active");
        b.addEventListener("click", () => {
          this.variant = v;
          this.updatePrice();
          $$(".cafe-item-details-variant", wrap).forEach(x => x.classList.remove("active"));
          b.classList.add("active");
        });
        wrap.appendChild(b);
      });
    }

    // количество
    txt("#cafe-item-details-quantity-value", String(this.qty));
    $("#cafe-item-details-quantity-increase-button")?.addEventListener("click", () => {
      this.qty = Math.min(99, this.qty + 1);
      txt("#cafe-item-details-quantity-value", String(this.qty));
      this.updatePrice();
    });
    $("#cafe-item-details-quantity-decrease-button")?.addEventListener("click", () => {
      this.qty = Math.max(1, this.qty - 1);
      txt("#cafe-item-details-quantity-value", String(this.qty));
      this.updatePrice();
    });

    this.updatePrice();
  }

  updatePrice() {
    const cost = Number(this.variant?.cost || 0) * Number(this.qty || 1);
    txt("#cafe-item-details-selected-variant-price",  toDisplayCost(cost));
    txt("#cafe-item-details-selected-variant-weight", this.variant?.weight || "");
  }

  addToCart() {
    if (!this.item || !this.variant) return;
    try { Cart.addItem(this.item, this.variant, this.qty); } catch {}

    document.body.dataset.mainbutton = "cart"; // для persist-mb
    const n = (Cart.getPortionCount && Cart.getPortionCount()) || 1;
    const label = n === 1 ? "MY CART · 1 POSITION" : `MY CART · ${n} POSITIONS`;

    showMB(label, () => {
      if (window.navigateTo) navigateTo("cart");
      else { location.hash = "#/cart"; window.handleLocation?.(); }
    });
  }
}