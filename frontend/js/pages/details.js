// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { getMenuItem } from "../requests/requests.js"; // правильный экспорт

export default class DetailsPage extends Route {
  constructor() {
    super("details", "/pages/details.html");
    this._onBack = this._onBack.bind(this);
  }

  _onBack() {
    window.history.back(); // системный back с анимацией
  }

  async load(params) {
    TelegramSDK.showBackButton(this._onBack);
    TelegramSDK.ready?.();
    TelegramSDK.expand?.();

    const { id, categoryId } = params ? JSON.parse(params) : {};
    this._fallbackBack = () => {
      if (categoryId) navigateTo("category", JSON.stringify({ id: categoryId }));
      else navigateTo("root");
    };

    try {
      const item = await getMenuItem(id);

      // Подставь свои селекторы, если отличаются
      if (item?.image) {
        loadImage($("#cafe-item-details-image"), item.image);
        $("#cafe-item-details-image").show();
      }
      $("#cafe-item-details-name").text(item?.name ?? "");
      $("#cafe-item-details-description").text(item?.description ?? "");
      if (item?.price != null) $("#cafe-item-details-price").text(`$${item.price}`);
      if (item?.mass) $("#cafe-item-details-mass").text(item.mass);

      // Убери скелетоны, если они у тебя помечены data-skeleton
      $("[data-skeleton]").remove();
      $("[data-content]").show();
    } catch (e) {
      console.error("[DetailsPage] load failed", e);
      // на всякий случай вернём пользователя назад по запасному маршруту
      this._fallbackBack?.();
    }
  }

  destroy() {
    try { TelegramSDK.hideBackButton(); } catch {}
    try { TelegramSDK.offBackButton?.(this._onBack); } catch {}
  }
}