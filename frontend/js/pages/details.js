// frontend/js/pages/details.js

import Route from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuItem } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";

export default class DetailsPage extends Route {
  constructor() {
    super("details", "/pages/details.html");
  }

  async load(params) {
    console.log("[Details] load", params);
    TelegramSDK.expand();

    // Скажем перманентному хуку «не лезь, здесь кастомная кнопка»
    document.body.dataset.mainbutton = "custom";

    // ---- id блюда ----
    let id = null;
    try {
      if (typeof params === "string") {
        id = JSON.parse(params || "{}").id ?? null;
      } else if (params && typeof params === "object") {
        id = params.id ?? null;
      }
    } catch (e) {
      console.error("[Details] bad params:", e, params);
    }
    if (!id) return;

    // ---- данные блюда ----
    let item = null;
    try { item = await getMenuItem(id); } catch (e) { console.error(e); }
    if (!item) return;

    const $ = (s) => document.querySelector(s);

    const name = item.name || item.title || "Untitled";
    const img  = item.photo || item.image || item.coverImage || "icons/icon-transparent.svg";
    const desc = item.description || item.ingredients || "";

    const priceSmall = item?.price?.small ?? item.priceSmall ?? item.price ?? 0;
    const priceLarge = item?.price?.large ?? item.priceLarge ?? null;

    $(".details__title") && ($(".details__title").textContent = name);
    $(".details__desc")  && ($(".details__desc").textContent  = desc);
    const imgEl = $(".details__cover img");
    if (imgEl) imgEl.src = img;

    // ---- опции размера ----
    let option = "small";
    const priceEl = $(".details__price");
    const updatePrice = () => {
      const p = option === "large" && priceLarge != null ? priceLarge : priceSmall;
      if (priceEl) priceEl.textContent = `$${p}`;
    };
    updatePrice();

    const optS = document.getElementById("opt-small");
    const optL = document.getElementById("opt-large");
    optS?.addEventListener("click", () => {
      option = "small";
      optS.classList.add("active");
      optL?.classList.remove("active");
      updatePrice();
    });
    optL?.addEventListener("click", () => {
      option = "large";
      optL.classList.add("active");
      optS?.classList.remove("active");
      updatePrice();
    });

    // ---- количество ----
    let qty = 1;
    const qtyEl = document.getElementById("qty");
    const syncQty = () => { if (qtyEl) qtyEl.textContent = String(qty); };
    document.getElementById("qty-dec")?.addEventListener("click", () => {
      qty = Math.max(1, qty - 1); syncQty();
    });
    document.getElementById("qty-inc")?.addEventListener("click", () => {
      qty += 1; syncQty();
    });
    syncQty();

    // ---- кнопка: сначала ADD TO CART, потом MY CART ----
    const switchToCartButton = () => {
      const count = Cart.getPortionCount();
      const label = `MY CART · ${count} POSITION${count > 1 ? "S" : ""}`;
      TelegramSDK.showMainButton(label, () => navigateTo("cart"));
      // возвращаем управление перманентному хуку
      document.body.dataset.mainbutton = "cart";
    };

    TelegramSDK.showMainButton("ADD TO CART", () => {
      const chosenPrice = option === "large" && priceLarge != null ? priceLarge : priceSmall;
      Cart.add({
        id,
        name,
        option,
        qty,
        price: chosenPrice,
        image: img,
      });
      switchToCartButton();
    });
  }
}