// frontend/js/pages/category.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage, replaceShimmerContent } from "../utils/dom.js";
import { getMenuByCategory } from "../requests/requests.js"; // если у тебя иначе — оставь свой импорт

export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
    this._onBack = this._onBack.bind(this);
  }

  _onBack() {
    // системный back с анимацией
    window.history.back();
  }

  async load(params) {
    // включаем системную кнопку Назад (стрелка в хедере Telegram)
    TelegramSDK.showBackButton(this._onBack);

    const { id: categoryId } = (params ? JSON.parse(params) : {});
    if (!categoryId) {
      // если вдруг зашли без id — просто вернёмся на главную
      return this._onBack();
    }

    try {
      const items = await getMenuByCategory(categoryId);

      // рендерим карточки категории (id-ы соответствуют твоей разметке)
      replaceShimmerContent(
        "#category-items",
        "#category-item-template",
        "#category-item-image",
        Array.isArray(items) ? items : [],
        (tpl, item) => {
          tpl.find("#category-item-name").text(item?.name ?? "");
          tpl.find("#category-item-description").text(item?.description ?? "");
          const img = tpl.find("#category-item-image");
          if (item?.image) loadImage(img, item.image);

          // ВАЖНО: передаём categoryId, чтобы из details вернуться сюда же
          tpl.on("click", () => {
            const p = JSON.stringify({ id: item?.id, categoryId });
            navigateTo("details", p);
          });
        }
      );
    } catch (e) {
      console.error("[CategoryPage] load failed", e);
    }
  }

  // на выходе со страницы убираем кнопку Назад
  destroy() {
    try { TelegramSDK.hideBackButton(); } catch {}
    try { TelegramSDK.offBackButton?.(this._onBack); } catch {}
  }
}