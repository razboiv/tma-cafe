// frontend/js/pages/main.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getInfo, getCategories, getPopularMenu } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage, replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/* === Popular cache across route re-renders === */
const POPULAR_CACHE_KEY = "tma-popular-cache-v1";
function getPopularCache() {
  try { return JSON.parse(sessionStorage.getItem(POPULAR_CACHE_KEY) || "null"); }
  catch { return null; }
}
function setPopularCache(items) {
  try { sessionStorage.setItem(POPULAR_CACHE_KEY, JSON.stringify(items)); } catch {}
}

/* === Helper for main button text === */
function pluralizePositions(n) {
  n = Number(n) || 0;
  return n === 1 ? "1 POSITION" : `${n} POSITIONS`;
}

/* === Рендер Popular из кэша (возвращает true, если отрисовали) === */
function renderPopularFromCacheIfMainPresent() {
  const container = document.querySelector("#cafe-popular");
  if (!container) return false;

  const cached = getPopularCache();
  if (!Array.isArray(cached) || cached.length === 0) return false;

  // если уже заполнено – не дублируем
  if (container.dataset.filled === "1" && container.children.length > 0) return true;

  // снять shimmer с заголовка
  const title = document.querySelector("#cafe-section-popular-title");
  if (title) title.classList.remove("shimmer");

  replaceShimmerContent(
    "#cafe-popular",
    "#cafe-item-template",
    "#cafe-item-image",
    cached,
    (template, item) => {
      template.find("#cafe-item-name").text(item?.name ?? "");
      template.find("#cafe-item-description").text(item?.description ?? "");

      const img = template.find("#cafe-item-image");
      if (item?.image) loadImage(img, item.image);

      template.on("click", () => {
        const params = JSON.stringify({
          id: item?.id,
          categoryId: item?.categoryId || undefined,
        });
        navigateTo("details", params);
      });
    }
  );

  container.dataset.filled = "1";
  return true;
}

/* === Дождаться появления main.html и дорисовать Popular из кэша === */
function waitAndRenderPopularFromCache(maxMs = 3000) {
  const start = Date.now();
  const tryOnce = () => {
    if (renderPopularFromCacheIfMainPresent()) return;
    if (Date.now() - start >= maxMs) return;
    setTimeout(tryOnce, 50);
  };
  // на следующем тике, когда роутер успеет подменить DOM
  requestAnimationFrame(tryOnce);
}

/* === Глобальные хуки: при возврате — гарантированно дорисуем Popular из cache === */
window.addEventListener("popstate", () => waitAndRenderPopularFromCache());
try { window.Telegram?.WebApp?.onEvent?.("back_button_pressed", () => waitAndRenderPopularFromCache()); } catch {}

/* === Main page === */
export default class MainPage extends Route {
  constructor() {
    super("root", "/pages/main.html");
  }

  async load() {
    // системные кнопки/expand — только на главной
    TelegramSDK.hideBackButton();
    TelegramSDK.ready?.();
    TelegramSDK.expand?.();

    // мгновенно показать Popular из кэша (если есть),
    // а если main.html вставится чуточку позже — «страховка» тоже сработает
    waitAndRenderPopularFromCache();

    // кнопка корзины
    this.updateMainButton();

    // параллельно загрузим данные и перерисуем
    await Promise.allSettled([
      this.loadCafeInfo(),
      this.loadCategories(),
      this.loadPopularMenu(), // с кэшем
    ]);
  }

  /* ----- Кнопка корзины ----- */
  updateMainButton() {
    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    if (count > 0) {
      TelegramSDK.showMainButton(`MY CART · ${pluralizePositions(count)}`, () => navigateTo("cart"));
      document.body.dataset.mainbutton = "cart";
    } else {
      TelegramSDK.hideMainButton();
      document.body.dataset.mainbutton = "";
    }
  }

  /* ----- Информация о кафе ----- */
  async loadCafeInfo() {
    try {
      const info = await getInfo();

      // обложка
      if (info?.coverImage) {
        loadImage($("#cafe-cover"), info.coverImage);
        $("#cafe-cover").removeClass("shimmer");
      }

      // логотип
      if (info?.logoImage) {
        loadImage($("#cafe-logo"), info.logoImage);
        $("#cafe-logo").removeClass("shimmer");
      }

      // тексты
      if (info?.name) $("#cafe-name").text(info.name);
      if (info?.kitchenCategories) $("#cafe-kitchen-categories").text(info.kitchenCategories);
      if (info?.rating) $("#cafe-rating").text(info.rating);
      if (info?.cookingTime) $("#cafe-cooking-time").text(info.cookingTime);
      if (info?.status) $("#cafe-status").text(info.status);

      // снять shimmer
      $("#cafe-info, #cafe-name, #cafe-kitchen-categories, .cafe-parameters-container")
        .removeClass("shimmer");
    } catch (e) {
      console.error("[MainPage] failed to load info", e);
    }
  }

  /* ----- Категории ----- */
  async loadCategories() {
    try {
      const categories = await getCategories();

      // снять shimmer с заголовка
      $("#cafe-section-categories-title").removeClass("shimmer");

      replaceShimmerContent(
        "#cafe-categories",
        "#cafe-category-template",
        "#cafe-category-icon",
        Array.isArray(categories) ? categories : [],
        (template, category) => {
          template.attr("id", category.id);
          template.css("background-color", category.backgroundColor || "");
          template.find("#cafe-category-name").text(category.name ?? "");

          const img = template.find("#cafe-category-icon");
          if (category.icon) loadImage(img, category.icon);

          template.on("click", () => {
            const params = JSON.stringify({ id: category.id });
            navigateTo("category", params);
          });
        }
      );
    } catch (e) {
      console.error("[MainPage] failed to load categories", e);
    }
  }

  /* ----- Popular: рендер ----- */
  renderPopular(items = []) {
    $("#cafe-section-popular-title").removeClass("shimmer");

    replaceShimmerContent(
      "#cafe-popular",
      "#cafe-item-template",
      "#cafe-item-image",
      Array.isArray(items) ? items : [],
      (template, item) => {
        template.find("#cafe-item-name").text(item?.name ?? "");
        template.find("#cafe-item-description").text(item?.description ?? "");

        const img = template.find("#cafe-item-image");
        if (item?.image) loadImage(img, item.image);

        template.on("click", () => {
          const params = JSON.stringify({
            id: item?.id,
            categoryId: item?.categoryId || undefined,
          });
          navigateTo("details", params);
        });
      }
    );

    // пометим контейнер как заполненный (для страховочного рендера)
    const container = document.querySelector("#cafe-popular");
    if (container) container.dataset.filled = "1";
  }

  /* ----- Popular: загрузка с кэшем ----- */
  async loadPopularMenu() {
    // A) мгновенно показать из кэша (если уже открывали бота)
    const cached = getPopularCache();
    if (Array.isArray(cached) && cached.length) this.renderPopular(cached);

    // B) обновить данные и перерисовать
    try {
      const items = await getPopularMenu();
      setPopularCache(items);
      this.renderPopular(items);
    } catch (e) {
      console.warn("[MainPage] getPopularMenu failed:", e);
      if (!cached) this.renderPopular([]);
    }
  }
}