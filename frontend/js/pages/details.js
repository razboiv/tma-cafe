// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";

const plural = (n) => (n === 1 ? "POSITION" : "POSITIONS");
const getCount = () =>
  ((Cart.getItems && Cart.getItems()) || []).reduce(
    (s, x) => s + Number(x.quantity ?? x.count ?? 0), 0
  );

function revealContent() {
  // прячем любые «скелеты», показываем контент
  document.querySelectorAll(".shimmer, .skeleton, [data-skeleton]").forEach(el => el.style.display = "none");
  document.querySelectorAll("[data-content], .details-content").forEach(el => el.style.removeProperty("display"));
}

export default class DetailsPage extends Route {
  constructor() { super("details", "/pages/details.html"); }

  async load(params) {
    console.log("[DetailsPage] load", params);

    // показываем «ADD TO CART», без мигания
    document.body.dataset.mainbutton = "add";
    document.body.dataset.mainbuttonText = "";

    revealContent();

    const W = window.Telegram?.WebApp;
    const MB = W?.MainButton;

    const addCurrent = () => {
      // кликаем по твоей локальной кнопке «+» — используем имеющуюся логику
      const plusBtn =
        document.querySelector('[data-action="inc"]') ||
        document.querySelector(".js-inc") ||
        document.querySelector('button[aria-label="inc"]') ||
        document.querySelector(".plus, .inc");
      plusBtn?.click();

      // переключаем на «MY CART · N»
      const n = getCount();
      const text = `MY CART · ${n} ${plural(n)}`;
      document.body.dataset.mainbutton = "cart";
      document.body.dataset.mainbuttonText = text;

      try {
        MB?.setText?.(text);
        MB?.onClick?.(() => this.#goCart());
        W?.onEvent?.("mainButtonClicked", () => this.#goCart());
        MB?.enable?.(); MB?.show?.();
      } catch {}
    };

    try {
      MB?.setText?.("ADD TO CART");
      MB?.onClick?.(addCurrent);
      W?.onEvent?.("mainButtonClicked", addCurrent);
      MB?.enable?.(); MB?.show?.();
    } catch {}
  }

  #goCart() {
    if (window.navigateTo) window.navigateTo("cart");
    else { location.hash = "#/cart"; window.handleLocation?.(); }
  }
}