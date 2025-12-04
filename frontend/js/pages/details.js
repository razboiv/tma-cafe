// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";

const plural = (n) => (n === 1 ? "POSITION" : "POSITIONS");
const getCount = () =>
  ((Cart.getItems && Cart.getItems()) || []).reduce(
    (s, x) => s + Number(x.quantity ?? x.count ?? 0), 0
  );

export default class DetailsPage extends Route {
  constructor() { super("details", "/pages/details.html"); }

  async load(params) {
    console.log("[DetailsPage] load", params);

    // 1) Включаем режим "добавления"
    document.body.dataset.mainbutton = "add";
    document.body.dataset.mainbuttonText = "";

    const W = window.Telegram?.WebApp;
    const MB = W?.MainButton;

    // Единая функция добавления — кликаем по локальной кнопке "+"
    const addCurrent = () => {
      const plusBtn =
        document.querySelector('[data-action="inc"]') ||
        document.querySelector(".js-inc") ||
        document.querySelector('button[aria-label="inc"]') ||
        document.querySelector(".plus, .inc");

      plusBtn?.click(); // используем твою существующую логику

      // 2) Переключаем кнопку на "MY CART · N"
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

    // Навешиваем обработчик (на случай, если persist не успеет поставить свой)
    try {
      MB?.onClick?.(addCurrent);
      W?.onEvent?.("mainButtonClicked", addCurrent);
      MB?.setText?.("ADD TO CART"); MB?.enable?.(); MB?.show?.();
    } catch {}

    // Остальная логика деталки, разметка и т.п. — остаётся как была
  }

  #goCart() {
    if (window.navigateTo) window.navigateTo("cart");
    else { location.hash = "#/cart"; window.handleLocation?.(); }
  }
}