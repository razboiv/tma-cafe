// frontend/js/pages/main.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getInfo, getCategories, getPopularMenu } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage, replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/* === Popular cache === */
const POPULAR_CACHE_KEY = "tma-popular-cache-v1";
function getPopularCache() {
  try { return JSON.parse(sessionStorage.getItem(POPULAR_CACHE_KEY) || "null"); }
  catch { return null; }
}
function setPopularCache(items) {
  try { sessionStorage.setItem(POPULAR_CACHE_KEY, JSON.stringify(items)); } catch {}
}

/* === helpers === */
function pluralizePositions(n) {
  n = Number(n) || 0;
  return n === 1 ? "1 POSITION" : `${n} POSITIONS`;
}

/* === рендер Popular из кэша, если главная в DOM === */
function renderPopularFromCacheIfMainPresent() {
  const container = document.querySelector("#cafe-popular");
  if (!container) return false;

  const cached = getPopularCache();
  if (!Array.isArray(cached) || cached.length === 0) return false;

  // уже есть контент — не дублируем
  if (container.dataset.filled === "1" && container.children.length > 0) return true;

  const title = document.querySelector("#cafe-section-popular-title");
  if (title) title.classList.remove("shimmer");

  replaceShimmerContent(
    "#cafe-popular",
    "#cafe-item-template",
    "#cafe-item-image",
    cached,
    (tpl, item) => {
      tpl.find("#cafe-item-name").text(item?.name ?? "");
      tpl.find("#cafe-item-description").text(item?.description ?? "");

      const img = tpl.find("#cafe-item-image");
      if (item?.image) loadImage(img, item.image);

      tpl.on("click", () => {
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

/* === Постоянная «страховка»: следим за изменениями DOM и подрисовываем Popular из кэша === */
let lastEnsureTs = 0;
function ensurePopularFromCacheDebounced() {
  const now = Date.now();
  if (now - lastEnsureTs < 80) return; // лёгкий троттлинг
  lastEnsureTs = now;
  requestAnimationFrame(() => { renderPopularFromCacheIfMainPresent(); });
}

// запускаем observer один раз на всё WebView
const __popularObserver = new MutationObserver(ensurePopularFromCacheDebounced);
__popularObserver.observe(document.documentElement || document.body, {
  childList: true,
  subtree: true,
});
// первая попытка на случай, если уже стоим на главной
ensurePopularFromCacheDebounced();

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

    // мгновенно попробовать показать Popular из кэша
    ensurePopularFromCacheDebounced();

    // нижняя кнопка корзины
    this.updateMainButton();

    // параллельно загружаем и перерисовываем
    await Promise.allSettled([
      this.loadCafeInfo(),
      this.loadCategories(),
      this.loadPopularMenu(), // с кэшем
    ]);
  }

  /* ----- кнопка корзины ----- */
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

  /* ----- инфо о кафе ----- */
  async loadCafeInfo() {
    try {
      const info = await getInfo();

      if (info?.coverImage) {
        loadImage($("#cafe-cover"), info.coverImage);
        $("#cafe-cover").removeClass("shimmer");
      }
      if (info?.logoImage) {
        loadImage($("#cafe-logo"), info.logoImage);
        $("#cafe-logo").removeClass("shimmer");
      }
      if (info?.name) $("#cafe-name").text(info.name);
      if (info?.kitchenCategories) $("#cafe-kitchen-categories").text(info.kitchenCategories);
      if (info?.rating) $("#cafe-rating").text(info.rating);
      if (info?.cookingTime) $("#cafe-cooking-time").text(info.cookingTime);
      if (info?.status) $("#cafe-status").text(info.status);

      $("#cafe-info, #cafe-name, #cafe-kitchen-categories, .cafe-parameters-container")
        .removeClass("shimmer");
    } catch (e) {
      console.error("[MainPage] failed to load info", e);
    }
  }

  /* ----- категории ----- */
  async loadCategories() {
    try {
      const categories = await getCategories();

      $("#cafe-section-categories-title").removeClass("shimmer");

      replaceShimmerContent(
        "#cafe-categories",
        "#cafe-category-template",
        "#cafe-category-icon",
        Array.isArray(categories) ? categories : [],
        (tpl, category) => {
          tpl.attr("id", category.id);
          tpl.css("background-color", category.backgroundColor || "");
          tpl.find("#cafe-category-name").text(category.name ?? "");

          const img = tpl.find("#cafe-category-icon");
          if (category.icon) loadImage(img, category.icon);

          tpl.on("click", () => {
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
      (tpl, item) => {
        tpl.find("#cafe-item-name").text(item?.name ?? "");
        tpl.find("#cafe-item-description").text(item?.description ?? "");

        const img = tpl.find("#cafe-item-image");
        if (item?.image) loadImage(img, item.image);

        tpl.on("click", () => {
          const params = JSON.stringify({
            id: item?.id,
            categoryId: item?.categoryId || undefined,
          });
          navigateTo("details", params);
        });
      }
    );

    const container = document.querySelector("#cafe-popular");
    if (container) container.dataset.filled = "1";
  }

  /* ----- Popular: загрузка с кэшем ----- */
  async loadPopularMenu() {
    const cached = getPopularCache();
    if (Array.isArray(cached) && cached.length) this.renderPopular(cached);

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