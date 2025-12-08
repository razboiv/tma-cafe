// frontend/js/pages/category.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
    this._onBack = this._onBack.bind(this);
  }

  _onBack() {
    window.history.back();
  }

  #cartCount() {
    try {
      const items = (Cart.getItems && Cart.getItems()) || [];
      return items.reduce((s, it) => s + Number(it.quantity || it.count || 0), 0);
    } catch { return 0; }
  }

  async load(params) {
    TelegramSDK.showBackButton(this._onBack);
    TelegramSDK.ready?.();
    TelegramSDK.expand?.();

    // main button (корзина)
    const count = this.#cartCount();
    if (count > 0) {
      TelegramSDK.showMainButton(`MY CART · ${count === 1 ? "1 POSITION" : `${count} POSITIONS`}`, () => navigateTo("cart"));
      document.body.dataset.mainbutton = "cart";
    } else {
      TelegramSDK.hideMainButton();
      document.body.dataset.mainbutton = "";
    }

    // === ключевое: снимаем shimmer до рендера ===
    const $container = $("#cafe-category");
    $container.removeClass("shimmer").find(".shimmer").removeClass("shimmer");

    try {
      const categoryId = params ? JSON.parse(params).id : null;
      if (!categoryId) return this._onBack();

      const items = await getMenuCategory(categoryId);

      replaceShimmerContent(
        "#cafe-category",        // контейнер
        "#cafe-item-template",   // template
        "#cafe-item-image",      // img в шаблоне
        Array.isArray(items) ? items : [],
        (tpl, item) => {
          tpl.find("#cafe-item-name").text(item?.name ?? "");
          tpl.find("#cafe-item-description").text(item?.description ?? "");
          const img = tpl.find("#cafe-item-image");
          if (img && item?.image) img.attr("src", item.image);

          tpl.on("click", () => {
            navigateTo("details", JSON.stringify({ id: item?.id, categoryId }));
          });
        }
      );

      // и после — на всякий случай ещё раз
      $container.removeClass("shimmer").find(".shimmer").removeClass("shimmer");
    } catch (e) {
      console.error("[CategoryPage] failed to load category menu:", e);
      // на фейле тоже уберём скелетон, чтобы не висел серым
      $container.removeClass("shimmer").find(".shimmer").removeClass("shimmer");
    }
  }

  destroy() {
    try { TelegramSDK.hideBackButton(); } catch {}
    try { TelegramSDK.offBackButton?.(this._onBack); } catch {}
  }
}