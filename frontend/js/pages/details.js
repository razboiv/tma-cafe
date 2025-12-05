// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import * as Requests from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

// ── helpers ─────────────────────────────────────────────────────────
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
const goCart = () => {
  if (window.navigateTo) navigateTo("cart");
  else { location.hash = "#/cart"; window.handleLocation?.(); }
};

function tryJsonId(s) {
  try {
    const o = JSON.parse(s);
    if (o && typeof o === "object") {
      if ("id"  in o) return String(o.id);
      if ("dir" in o) return String(o.dir);
    }
  } catch {}
  return null;
}
function readIdFromHash() {
  const h = decodeURIComponent(location.hash || "");
  let m = h.match(/#\/?details\/([^/?#]+)/i);
  if (m) return tryJsonId(m[1]) || m[1];
  m = h.match(/[?&#](?:id|dir)=([^&#]+)/i);
  if (m) return m[1];
  m = h.match(/[?&#](?:params|p)=([^&#]+)/i);
  if (m) return tryJsonId(m[1]) || m[1];
  const last = h.split("/").pop();
  return tryJsonId(last) || null;
}
function normalizeId(params) {
  if (params && typeof params === "object") {
    if ("id"  in params) return String(params.id);
    if ("dir" in params) return String(params.dir);
  }
  if (typeof params === "string") return tryJsonId(decodeURIComponent(params)) || params;
  const ds = document.body?.dataset || {};
  return ds.itemId || ds.dir || ds.id || readIdFromHash() || null;
}

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
  } catch { return null; }
}
function removeSkeleton() {
  $$(".shimmer,[data-skeleton],.skeleton").forEach(el => el.style.display = "none");
  $$("[data-content],.details-content").forEach(el => el.style.removeProperty("display"));
}

// ── page ────────────────────────────────────────────────────────────
export default class DetailsPage extends Route {
  constructor() { super("details", "/pages/details.html"); }

  async load(params) {
    this.id = normalizeId(params);
    if (!this.id) return;

    this.item = await getItem(this.id);
    if (!this.item) return;

    this.qty     = 1;
    this.variant = this.item?.variants?.[0] || null;

    this.addedKey = `added:${this.id}`;

    this.render();

    // если пользователь уже добавлял этот товар или корзина не пустая — показываем "MY CART"
    const alreadyAdded = sessionStorage.getItem(this.addedKey) === "1";
    const hasAny = (Cart.getPortionCount && Cart.getPortionCount() > 0);
    if (alreadyAdded || hasAny) this.showCartButton();
    else this.showAddButton();
  }

  render() {
    const it = this.item;

    removeSkeleton();
    img("#cafe-item-details-image", it.image || it.imageUrl || it.coverImage || "");
    txt("#cafe-item-details-name", it.name || "");
    txt("#cafe-item-details-description", it.description || "");
    txt("#cafe-item-details-section-title", "Price");

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

  showAddButton() {
    document.body.dataset.mainbutton = "add"; // persist-mb НЕ лезет
    showMB("ADD TO CART", () => this.addToCart());
  }

  showCartButton() {
    document.body.dataset.mainbutton = "cart"; // persist-mb вешает goCart (и мы тоже)
    const n = (Cart.getPortionCount && Cart.getPortionCount()) || 1;
    const label = n === 1 ? "MY CART · 1 POSITION" : `MY CART · ${n} POSITIONS`;
    showMB(label, () => goCart());
  }

  updatePrice() {
    const cost = Number(this.variant?.cost || 0) * Number(this.qty || 1);
    txt("#cafe-item-details-selected-variant-price",  toDisplayCost(cost));
    txt("#cafe-item-details-selected-variant-weight", this.variant?.weight || "");
  }

  addToCart() {
    if (!this.item || !this.variant) return;
    try { Cart.addItem(this.item, this.variant, this.qty); } catch {}
    sessionStorage.setItem(this.addedKey, "1");
    this.showCartButton(); // меняем кнопку, но НЕ переходим автоматически
  }
}