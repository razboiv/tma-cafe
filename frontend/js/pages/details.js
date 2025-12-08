// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { getMenuItem } from "../requests/requests.js"; // если имя другое — оставь свой импорт

export default class DetailsPage extends Route {
  constructor() {
    super("details", "/pages/details.html");
    this._onBack = this._onBack.bind(this);
  }

  _onBack() {
    // системный back с анимацией
    window.history.back();
  }

  async load(params) {
    // включаем системную кнопку Назад (стрелка)
    TelegramSDK.showBackButton(this._onBack);

    const { id, categoryId } = (params ? JSON.parse(params) : {});

    // на всякий случай: если нет истории (открыли детали «холодно»)
    // дадим запасной маршрут
    this._fallbackBack = () => {
      if (categoryId) navigateTo("category", JSON.stringify({ id: categoryId }));
      else navigateTo("root"); // главная
    };

    try {
      const item = await getMenuItem(id);

      // проставляем контент карточки товара (свои селекторы оставь как у тебя)
      if (item?.image) loadImage($("#details-image"), item.image);
      $("#details-name").text(item?.name ?? "");
      $("#details-description").text(item?.description ?? "");
      $("#details-price").text(item?.price ? `$${item.price}` : "");

      // кнопки размеров/кол-ва остаются как у тебя
      // ...
    } catch (e) {
      console.error("[DetailsPage] load failed", e);
    }
  }

  destroy() {
    try { TelegramSDK.hideBackButton(); } catch {}
    try { TelegramSDK.offBackButton?.(this._onBack); } catch {}

    // Если вдруг пользователь «закрывает» WebView и back не сработал,
    // можно вызвать запасной маршрут:
    // this._fallbackBack?.();
  }
}