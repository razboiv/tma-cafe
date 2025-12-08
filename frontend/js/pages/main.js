// frontend/js/pages/main.js
import { Route } from "../routing/route.js";
import TelegramSDK from "../telegram/telegram.js";
import { navigateTo } from "../routing/router.js";
import { getInfo, getCategories, getPopularMenu } from "../requests/requests.js";

const CACHE = window.__MAIN_CACHE__ || (window.__MAIN_CACHE__ = {});

export default class MainPage extends Route {
  constructor() {
    super("root", "/pages/main.html");
  }

  async load() {
    // На главной «Назад» прячем, expand/ready только тут
    TelegramSDK.hideBackButton();
    TelegramSDK.ready?.();
    TelegramSDK.expand?.();

    // Если уже есть кэш Popular — сразу покажем, без скелетонов
    if (Array.isArray(CACHE.popular)) {
      this.renderPopular(CACHE.popular);
    }

    // Обновим данные в фоне
    try {
      const [info, categories, popular] = await Promise.all([
        getInfo(),
        getCategories(),
        getPopularMenu(),
      ]);

      CACHE.info = info;
      CACHE.categories = categories;
      CACHE.popular = popular;

      // здесь оставь свою текущую отрисовку info/categories, если она у тебя есть
      // (или добавь по аналогии с popular через this.renderCategories(categories))

      this.renderPopular(popular);
    } catch (e) {
      console.warn("[MainPage] background fetch failed", e);
    }
  }

  // Универсальная отрисовка блока Popular (без зависимостей от replaceShimmerContent)
  renderPopular(items) {
    const root = document.querySelector("#cafe-popular");
    if (!root) return;

    root.innerHTML = "";
    (Array.isArray(items) ? items : []).forEach((i) => {
      const card = document.createElement("div");
      card.className = "popular-card";

      card.innerHTML = `
        <img class="popular-card__img" src="${(i.image || i.photo || "").trim()}" alt="">
        <div class="popular-card__title">${i.name || ""}</div>
        <div class="popular-card__subtitle">${i.short || i.description || ""}</div>
      `;

      card.addEventListener("click", () =>
        navigateTo("details", { id: String(i.id), categoryId: i.categoryId || "" })
      );

      root.appendChild(card);
    });
  }
}