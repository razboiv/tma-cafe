// frontend/js/pages/category.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js"; // ВАЖНО: правильное имя экспорта
import TelegramSDK from "../telegram/telegram.js";
import { replaceShimmerContent, loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
    this._onBack = this._onBack.bind(this);
  }

  _onBack() {
    // системный back с анимацией роутера
    window.history.back();
  }

  async load(params) {
    // включаем кнопку «Назад» Telegram
    TelegramSDK.showBackButton(this._onBack);
    TelegramSDK.ready?.();
    TelegramSDK.expand?.();

    // обновить кнопку корзины
    this.updateMainButton();

    const { id: categoryId } = params ? JSON.parse(params) : {};
    if (!categoryId) return this._onBack();

    try {
      const items = await getMenuCategory(categoryId);

      // если в category.html у тебя другие id — замени селекторы ниже
      replaceShimmerContent(
        "#category-items",          // контейнер
        "#category-item-template",  // <template>
        "#category-item-image",     // id картинки внутри шаблона
        Array.isArray(items) ? items : [],
        (tpl, item) => {
          tpl.find("#category-item-name").text(item?.name ?? "");
          tpl.find("#category-item-description").text(item?.description ?? "");
          const img = tpl.find("#category-item-image");
          if (item?.image) loadImage(img, item.image);

          // Пробрасываем categoryId, чтобы из деталей вернуться в ту же категорию
          tpl.on("click", () => {
            navigateTo("details", JSON.stringify({ id: item?.id, categoryId }));
          });
        }
      );
    } catch (e) {
      console.error("[CategoryPage] load failed", e);
    }
  }

  destroy() {
    try { TelegramSDK.hideBackButton(); } catch {}
    try { TelegramSDK.offBackButton?.(this._onBack); } catch {}
  }

  updateMainButton() {
    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    if (count > 0) {
      TelegramSDK.showMainButton(`MY CART · ${count} POSITIONS`, () => navigateTo("cart"));
      document.body.dataset.mainbutton = "cart";
    } else {
      TelegramSDK.hideMainButton();
      document.body.dataset.mainbutton = "";
    }
  }
}