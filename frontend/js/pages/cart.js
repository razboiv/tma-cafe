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
    // в корзине фиолетовой кнопки быть не должно
    document.body.dataset.mainbutton = "checkout";
    const hideMB = () => {
      try { TelegramSDK.hideMainButton?.(); } catch {}
      try { window.Telegram?.WebApp?.MainButton?.hide?.(); } catch {}
    };
    hideMB();
    this._hideMBTimer = setInterval(hideMB, 700);

    this.render();
    // периодически перерисовываем — чтобы кол-во/сумма обновлялись
    this._liveTimer = setInterval(() => this.render(), 1500);

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
    this._liveTimer = this._hideMBTimer = null;

    const btn =
      document.querySelector('[data-action="checkout"]') ||
      document.querySelector(".js-checkout") ||
      document.getElementById("checkout") ||
      document.querySelector('button[type="submit"]');
    if (btn && this._onCheckout) btn.removeEventListener("click", this._onCheckout);
    this._onCheckout = null;

    super.destroy && super.destroy();
  }

  _pick(root, list) { for (const s of list) { const el = root.querySelector(s); if (el) return el; } return null; }

  render() {
    let items = (Cart.getItems && Cart.getItems()) || [];
    if (!Array.isArray(items)) items = [];

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
      const name = it.cafeItem?.name || it.name || "";
      const variant = it.variant?.name || it.option || "";
      const cost = Number(it.variant?.cost || it.price || 0);
      const imgUrl =
        it.cafeItem?.imageUrl ||
        it.cafeItem?.image ||
        it.cafeItem?.coverImage ||
        it.imageUrl || "";

      let row;
      if (tplHtml) {
        row = document.createElement("div");
        row.innerHTML = tplHtml;
        row = row.firstElementChild;
      } else {
        // запасная разметка, если нет шаблона
        row = document.createElement("div");
        row.className = "cart-item";
        row.style.cssText = "display:flex;gap:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,.04)";
        row.innerHTML = `
          <img class="cart-item__img js-img" style="width:64px;height:64px;border-radius:10px;object-fit:cover;flex:0 0 64px;display:${imgUrl ? "block" : "none"}" alt="">
          <div style="flex:1;min-width:0">
            <div class="cart-item__line" style="display:flex;justify-content:space-between;gap:12px">
              <div class="cart-item__title js-name" style="font-weight:600"></div>
              <div class="cart-item__price js-price"></div>
            </div>
            <div class="cart-item__meta js-variant" style="opacity:.75;font-size:13px;margin:.25rem 0 .5rem"></div>
            <div class="cart-item__qty">
              <button class="js-dec" aria-label="dec">−</button>
              <span class="js-qty">${qty}</span>
              <button class="js-inc" aria-label="inc">+</button>
              <button class="js-remove" aria-label="remove" style="margin-left:8px">×</button>
            </div>
          </div>
        `;
      }

      // Заполняем
      const nameEl    = this._pick(row, [".js-name",".cart-item__title",".title",'[data-role="name"]']) || row;
      const variantEl = this._pick(row, [".js-variant",".cart-item__variant",".variant",'[data-role="variant"]']);
      const qtyEl     = this._pick(row, [".js-qty",".cart-item__qty .qty",".quantity",'[data-role="qty"]']);
      const priceEl   = this._pick(row, [".js-price",".cart-item__price",".price",'[data-role="price"]']);
      const imgEl     = this._pick(row, [".js-img",".cart-item__img","img"]);

      nameEl.textContent = name;
      if (variantEl) variantEl.textContent = variant ? `Option: ${variant}` : "";
      if (qtyEl) qtyEl.textContent = String(qty);
      if (priceEl) priceEl.textContent = toDisplayCost(cost * qty);
      if (imgEl) {
        if (imgUrl) { imgEl.src = imgUrl; imgEl.style.display = "block"; }
        else { imgEl.remove?.(); }
      }

      // Действия
      const btnInc = this._pick(row, [".js-inc",'[data-action="inc"]','.inc','button[aria-label="inc"]']);
      const btnDec = this._pick(row, [".js-dec",'[data-action="dec"]','.dec','button[aria-label="dec"]']);
      const btnRem = this._pick(row, [".js-remove",'[data-action="remove"]','.remove','button[aria-label="remove"]']);
      btnInc && btnInc.addEventListener("click", () => this._changeQty(it, +1));
      btnDec && btnDec.addEventListener("click", () => this._changeQty(it, -1));
      btnRem && btnRem.addEventListener("click", () => this._remove(it));

      list && list.appendChild(row);
    }

    const total = items.reduce((s, x) => s + Number(x.variant?.cost || x.price || 0) * Number(x.quantity ?? x.count ?? 0), 0);
    if (totalNode) totalNode.textContent = toDisplayCost(total);
  }

  _changeQty(item, delta) {
    try {
      if (typeof Cart.changeItemQuantity === "function") {
        Cart.changeItemQuantity(item, delta);
      } else {
        const list = (Cart.getItems && Cart.getItems()) || [];
        const t = list.find(x => (x.cafeItem?.id ?? x.id) === (item.cafeItem?.id ?? item.id) &&
                                  (x.variant?.name || "") === (item.variant?.name || ""));
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
        const i = list.findIndex(x => (x.cafeItem?.id ?? x.id) === (item.cafeItem?.id ?? item.id) &&
                                      (x.variant?.name || "") === (item.variant?.name || ""));
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
      if (!items.length) { (TelegramSDK.showAlert && TelegramSDK.showAlert("Cart is empty")) || alert("Cart is empty"); return; }

      const payload = {
        _auth: (TelegramSDK.getInitData && TelegramSDK.getInitData()) || (window.Telegram?.WebApp?.initData ?? ""),
        cartItems: items.map((it) => ({
          cafeItem: { id: it.cafeItem?.id ?? it.id, name: it.cafeItem?.name ?? it.name },
          variant:  { name: it.variant?.name ?? "", cost: Number(it.variant?.cost ?? it.price ?? 0) },
          quantity: Number(it.quantity ?? it.count ?? 0),
          imageUrl: it.cafeItem?.imageUrl || it.cafeItem?.image || it.cafeItem?.coverImage || it.imageUrl || ""
        })),
      };

      const res = await createOrder(payload);
      if (!res || !res.invoiceUrl) throw new Error("No invoiceUrl in response");

      if (window.Telegram?.WebApp?.openInvoice) {
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