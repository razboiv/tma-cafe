// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import * as Requests from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

/* ====== helpers ====== */

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function unshimmer(root = document) {
  $all(".shimmer,[data-skeleton],.skeleton", root).forEach(el => el.style.display = "none");
  $all("[data-content],.details-content", root).forEach(el => el.style.removeProperty("display"));
}

function setText(sel, text) { const el = $(sel); if (el) el.textContent = text; return el; }
function setImg(sel, url) {
  const el = $(sel);
  if (!el) return;
  if (url) { el.src = url; el.style.removeProperty("display"); }
  else el.style.display = "none";
}

function readIdFromHash() {
  const h = location.hash || "";
  // #/details/burger-1
  let m = h.match(/#\/?details\/([^/?#]+)/i);
  if (m) return decodeURIComponent(m[1]);
  // #/details?id=burger-1  or  #?id=burger-1
  m = h.match(/[?#&]id=([^&#]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

async function getItemById(id) {
  try {
    if (typeof Requests.getMenuItem === "function") {
      return await Requests.getMenuItem(id);
    }
  } catch (e) { console.warn("getMenuItem failed -> fetch fallback", e); }
  try {
    const res = await fetch(`${location.origin}/menu/details/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.error("fetch details failed", e);
    return null;
  }
}

function portionCount() {
  try {
    const items = (Cart.getItems && Cart.getItems()) || [];
    return items.reduce((s, it) => s + Number(it.quantity ?? it.count ?? 0), 0);
  } catch { return 0; }
}

function mbShow(text, cb) {
  document.body.dataset.mainbuttonText = text;
  try {
    TelegramSDK.showMainButton?.(text, cb);
    const W = window.Telegram?.WebApp;
    W?.MainButton?.setText?.(text);
    W?.MainButton?.onClick?.(cb);
    W?.onEvent?.("mainButtonClicked", cb);
    W?.MainButton?.enable?.();
    W?.MainButton?.show?.();
  } catch {}
}

/* ====== page ====== */

export default class DetailsPage extends Route {
  constructor() { super("details", "/pages/details.html"); }

  async load(params) {
    // режим «добавления», чтобы persist-mb не схватывал кнопку
    document.body.dataset.mainbutton = "add";

    // 1) Надёжно получаем id
    const id =
      params?.id ||
      document.body.dataset?.itemId ||
      document.body.dataset?.dir ||
      readIdFromHash();

    if (!id) {
      console.error("[Details] no id");
      // всё равно покажем кнопку, но без действия
      mbShow("ADD TO CART", () => {});
      return;
    }

    // 2) Грузим товар
    const item = await getItemById(id);
    if (!item) {
      console.error("[Details] item not found", id);
      mbShow("ADD TO CART", () => {});
      return;
    }

    this.item = item;
    this.qty = 1;
    this.variant = (item.variants && item.variants[0]) || null;

    // 3) Рендерим контент
    this.render();

    // 4) Показываем ADD TO CART и навешиваем обработчик
    mbShow("ADD TO CART", () => this.addToCart());
  }

  render() {
    const it = this.item || {};

    // Снимаем шимер
    unshimmer();

    // Картинка / заголовок / описание
    const imgUrl = it.image || it.imageUrl || it.coverImage || "";
    setImg("#cafe-item-details-image", imgUrl);
    setText("#cafe-item-details-name", it.name || "");
    setText("#cafe-item-details-description", it.description || "");
    setText("#cafe-item-details-section-title", "Price");

    // Кол-во
    setText("#cafe-item-details-quantity-value", String(this.qty));
    $("#cafe-item-details-quantity-increase-button")?.addEventListener("click", () => {
      this.qty = Math.min(99, (this.qty || 1) + 1);
      setText("#cafe-item-details-quantity-value", String(this.qty));
      this.updatePrice();
    });
    $("#cafe-item-details-quantity-decrease-button")?.addEventListener("click", () => {
      this.qty = Math.max(1, (this.qty || 1) - 1);
      setText("#cafe-item-details-quantity-value", String(this.qty));
      this.updatePrice();
    });

    // Варианты
    const variantsWrap = $("#cafe-item-details-variants");
    if (variantsWrap) {
      variantsWrap.innerHTML = "";
      (it.variants || []).forEach((v, i) => {
        const b = document.createElement("button");
        b.className = "cafe-item-details-variant";
        b.textContent = v.name || "";
        if (i === 0) b.classList.add("active");
        b.addEventListener("click", () => {
          this.variant = v;
          this.updatePrice();
          $all(".cafe-item-details-variant", variantsWrap).forEach(x => x.classList.remove("active"));
          b.classList.add("active");
        });
        variantsWrap.appendChild(b);
      });
    }

    this.updatePrice();
  }

  updatePrice() {
    const cost = Number(this.variant?.cost ?? 0) * Number(this.qty ?? 1);
    setText("#cafe-item-details-selected-variant-price", toDisplayCost(cost));
    setText("#cafe-item-details-selected-variant-weight", this.variant?.weight || "");
  }

  addToCart() {
    if (!this.item || !this.variant) return;

    try { Cart.addItem(this.item, this.variant, this.qty); } catch {}

    // переключаем главную кнопку на переход в корзину
    document.body.dataset.mainbutton = "cart";

    const n = Math.max(1, portionCount());
    const label = n === 1 ? "MY CART · 1 POSITION" : `MY CART · ${n} POSITIONS`;
    mbShow(label, () => {
      if (window.navigateTo) window.navigateTo("cart");
      else { location.hash = "#/cart"; window.handleLocation?.(); }
    });
  }
}