// frontend/js/pages/cart.js
import { Route } from "../routing/route.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { createOrder } from "../requests/requests.js";
import { toDisplayCost } from "../utils/currency.js";

export default class CartPage extends Route {
  constructor() {
    super("cart", "/pages/cart.html");
    this._onCheckout = null;
    this._liveTimer = null;
    this._hideMBTimer = null;
  }

  async load() {
    // На странице корзины глобальный хук не должен перехватывать кнопку
    document.body.dataset.mainbutton = "checkout";

    // Форс-скрытие MainButton + поддерживаем скрытым, пока страница открыта
    const hideMB = () => {
      try { TelegramSDK.hideMainButton?.(); } catch {}
      try { window.Telegram?.WebApp?.MainButton?.hide?.(); } catch {}
    };
    hideMB();
    this._hideMBTimer = setInterval(hideMB, 600);

    this.render();

    // «Живое» обновление списка (на случай внешних изменений количества)
    this._liveTimer = setInterval(() => this.render(), 1500);

    // Кнопка Checkout
    const btn =
      document.querySelector('[data-action="checkout"]') ||
      document.querySelector(".js-checkout") ||
      document.getElementById("checkout") ||
      document.querySelector('button[type="submit"]');

    if (btn) {
      this._onCheckout = (e) => { e.preventDefault(); this.#checkout(btn); };
      btn.addEventListener("click", this._onCheckout);
    }
  }

  destroy() {
    document.body.dataset.mainbutton = "";
    try { this._liveTimer && clearInterval(this._liveTimer); } catch {}
    try { this._hideMBTimer && clearInterval(this._hideMBTimer); } catch {}
    this._liveTimer = null;
    this._hideMBTimer = null;

    const btn =
      document.querySelector('[data-action="checkout"]') ||
      document.querySelector(".js-checkout") ||
      document.getElementById("checkout") ||
      document.querySelector('button[type="submit"]');
    if (btn && this._onCheckout) btn.removeEventListener("click", this._onCheckout);
    this._onCheckout = null;

    super.destroy && super.destroy();
  }

  // ---------- helpers ----------

  _pick(root, list) {
    for (const sel of list) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  render() {
    const items = (Cart.getItems && Cart.getItems()) || [];

    const list =
      document.querySelector("#cart-items") ||
      document.querySelector(".cart-items") ||
      document.querySelector('[data-list="cart"]');

    const emptyBlock =
      document.querySelector("#cart-empty") ||
      document.querySelector(".cart-empty");

    const totalNode =
      document.querySelector("#cart-total") ||
      document.querySelector('[data-id="cart-total"]') ||
      document.querySelector(".cart-total");

    if (list) list.innerHTML = "";

    if (!items.length) {
      if (emptyBlock) emptyBlock.style.display = "";
      if (totalNode) totalNode.textContent = toDisplayCost(0);
      return;
    }
    if (emptyBlock) emptyBlock.style.display = "none";

    const tpl = document.querySelector("#cart-item-template");
    const tplHtml = tpl ? tpl.innerHTML : null;

    for (const it of items) {
      const qty = Number(it.quantity ?? it.count ?? 0);
      const name = it.cafeItem?.name || "";
      const variant = it.variant?.name || "";
      const cost = Number(it.variant?.cost || 0);

      let row;
      if (tplHtml) {
        row = document.createElement("div");
        row.innerHTML = tplHtml;
        row = row.firstElementChild;
      } else {
        row = document.createElement("div");
        row.className = "cart-item";
        row.style.padding = "12px 0";
        row.innerHTML = `
          <div class="cart-item__line">
            <div class="cart-item__title js-name"></div>
            <div class="cart-item__price js-price"></div>
          </div>
          <div class="cart-item__meta js-variant" style="opacity:.75;margin-bottom:6px;"></div>
          <div class="cart-item__qty">
            <button class="js-dec" aria-label="dec">−</button>
            <span class="js-qty">${qty}</span>
            <button class="js-inc" aria-label="inc">+</button>
            <button class="js-remove" aria-label="remove" style="margin-left:8px">×</button>
          </div>
        `;
      }

      const nameEl    = this._pick(row, [".js-name",".cart-item__title",".cart-item-title",".title",'[data-role="name"]']) || row;
      const variantEl = this._pick(row, [".js-variant",".cart-item__variant",".variant",'[data-role="variant"]']);
      const qtyEl     = this._pick(row, [".js-qty",".cart-item__qty .qty",".quantity",'[data-role="qty"]']);
      const priceEl   = this._pick(row, [".js-price",".cart-item__price",".price",'[data-role="price"]']);

      nameEl.textContent = name;
      if (variantEl) variantEl.textContent = variant ? `Option: ${variant}` : "";
      if (qtyEl) qtyEl.textContent = String(qty);
      if (priceEl) priceEl.textContent = toDisplayCost(cost * qty);

      row.dataset.itemId = String(it.cafeItem?.id ?? "");
      row.dataset.variantName = String(variant);

      const btnInc = this._pick(row, [".js-inc",'[data-action="inc"]','.inc','button[aria-label="inc"]']);
      const btnDec = this._pick(row, [".js-dec",'[data-action="dec"]','.dec','button[aria-label="dec"]']);
      const btnRem = this._pick(row, [".js-remove",'[data-action="remove"]','.remove','button[aria-label="remove"]']);

      btnInc && btnInc.addEventListener("click", () => this._changeQty(it, +1));
      btnDec && btnDec.addEventListener("click", () => this._changeQty(it, -1));
      btnRem && btnRem.addEventListener("click", () => this._remove(it));

      list && list.appendChild(row);
    }

    const total = items.reduce((s, x) => s + Number(x.variant?.cost || 0) * Number(x.quantity ?? x.count ?? 0), 0);
    if (totalNode) totalNode.textContent = toDisplayCost(total);
  }

  _changeQty(item, delta) {
    try {
      if (typeof Cart.changeItemQuantity === "function") {
        Cart.changeItemQuantity(item, delta);
      } else {
        const list = (Cart.getItems && Cart.getItems()) || [];
        const t = list.find(x => x.cafeItem?.id === item.cafeItem?.id && x.variant?.name === item.variant?.name);
        if (t) {
          const q = Math.max(0, Number(t.quantity ?? t.count ?? 0) + delta);
          t.quantity = q;
          if (typeof Cart.save === "function") Cart.save(list);
        }
      }
    } catch {}
    this.render();
  }

  _remove(item) {
    try {
      if (typeof Cart.removeItem === "function") {
        Cart.removeItem(item);
      } else {
        const list = (Cart.getItems && Cart.getItems()) || [];
        const i = list.findIndex(x => x.cafeItem?.id === item.cafeItem?.id && x.variant?.name === item.variant?.name);
        if (i >= 0) {
          list.splice(i, 1);
          if (typeof Cart.save === "function") Cart.save(list);
        }
      }
    } catch {}
    this.render();
  }

  async #checkout(btn) {
    try {
      btn?.setAttribute("disabled", "disabled");

      const items = (Cart.getItems && Cart.getItems()) || [];
      if (!items.length) {
        (TelegramSDK.showAlert && TelegramSDK.showAlert("Cart is empty")) || alert("Cart is empty");
        return;
      }

      const payload = {
        _auth:
          (TelegramSDK.getInitData && TelegramSDK.getInitData()) ||
          (window.Telegram?.WebApp?.initData ?? ""),
        cartItems: items.map((it) => ({
          cafeItem: { id: it.cafeItem.id, name: it.cafeItem.name },
          variant: { name: it.variant.name, cost: Number(it.variant.cost) },
          quantity: Number(it.quantity ?? it.count ?? 0),
        })),
      };

      const res = await createOrder(payload);
      if (!res || !res.invoiceUrl) throw new Error("No invoiceUrl in response");

      if (typeof TelegramSDK.openInvoice === "function") {
        TelegramSDK.openInvoice(res.invoiceUrl, (status) => console.log("invoice:", status));
      } else if (window.Telegram?.WebApp?.openInvoice) {
        window.Telegram.WebApp.openInvoice(res.invoiceUrl, (status) => console.log("invoice:", status));
      } else {
        window.location.href = res.invoiceUrl;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      (TelegramSDK.showAlert && TelegramSDK.showAlert("Не удалось создать оплату. Попробуйте ещё раз."))
        || alert("Не удалось создать оплату. Попробуйте ещё раз.");
    } finally {
      btn?.removeAttribute("disabled");
    }
  }
}