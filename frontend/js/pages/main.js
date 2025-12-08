// frontend/js/pages/main.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getInfo, getCategories, getPopularMenu } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage, replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/* ================= cache ================= */
const POPULAR_CACHE_KEY = "tma-popular-cache-v1";
const getPopularCache = () => {
  try { return JSON.parse(sessionStorage.getItem(POPULAR_CACHE_KEY) || "null"); }
  catch { return null; }
};
const setPopularCache = (items) => {
  try { sessionStorage.setItem(POPULAR_CACHE_KEY, JSON.stringify(items)); } catch {}
};

/* =============== helpers =============== */
const pluralizePositions = (n) => (Number(n) === 1 ? "1 POSITION" : `${Number(n)||0} POSITIONS`);

/* ===== низкоуровневый «ручной» рендер (если template ещё не в DOM) ===== */
function renderPopularRaw(items = []) {
  const cont = document.querySelector("#cafe-popular");
  if (!cont) return false;

  document.querySelector("#cafe-section-popular-title")?.classList.remove("shimmer");
  cont.classList.remove("shimmer");
  cont.innerHTML = "";

  (Array.isArray(items) ? items : []).forEach((it) => {
    const card = document.createElement("div");
    card.className = "cafe-item-container";

    const img = document.createElement("img");
    img.className = "cafe-item-image";
    img.alt = "";
    if (it?.image) img.src = it.image;

    const name = document.createElement("h6");
    name.className = "cafe-item-name";
    name.textContent = it?.name ?? "";

    const d = document.createElement("p");
    d.className = "small cafe-item-description";
    d.textContent = it?.description ?? "";

    card.append(img, name, d);
    card.addEventListener("click", () => {
      navigateTo("details", JSON.stringify({ id: it?.id, categoryId: it?.categoryId || undefined }));
    });
    cont.append(card);
  });

  cont.dataset.filled = "1";
  return true;
}

/* ===== обычный рендер через template/утилиту ===== */
function renderPopularWithTemplate(items = []) {
  $("#cafe-section-popular-title").removeClass("shimmer");
  $("#cafe-popular").removeClass("shimmer");

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
        navigateTo("details", JSON.stringify({
          id: item?.id,
          categoryId: item?.categoryId || undefined,
        }));
      });
    }
  );
  const cont = document.querySelector("#cafe-popular");
  if (cont) cont.dataset.filled = "1";
  return true;
}

/* ===== умный рендер: если есть <template> — используем, иначе «сыро» ===== */
function renderPopularSmart(items = []) {
  const hasTemplate = !!document.querySelector("#cafe-item-template");
  return hasTemplate ? renderPopularWithTemplate(items) : renderPopularRaw(items);
}

/* ===== гарантированный показ Popular из cache при ЛЮБОЙ вклейке главной ===== */
let lastEnsureTs = 0;
function ensurePopularFromCache() {
  const now = Date.now();
  if (now - lastEnsureTs < 80) return; // лёгкий троттлинг
  lastEnsureTs = now;

  const cont = document.querySelector("#cafe-popular");
  const cached = getPopularCache();
  if (!cont || !Array.isArray(cached) || !cached.length) return;

  if (cont.dataset.filled === "1" && cont.children.length > 0) return; // уже заполнено
  renderPopularSmart(cached);
}

/* Постоянный наблюдатель — ловим появление #cafe-popular */
const __popularObserver = new MutationObserver(ensurePopularFromCache);
__popularObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
// watchdog: иногда роутер меняет DOM «молча» — периодически проверим состояние
setInterval(ensurePopularFromCache, 250);
// сразу попробуем на текущем состоянии
ensurePopularFromCache();

/* ================= Main page ================= */
export default class MainPage extends Route {
  constructor() {
    super("root", "/pages/main.html");
  }

  async load() {
    // системные элементы Telegram — только на главной
    TelegramSDK.hideBackButton();
    TelegramSDK.ready?.();
    TelegramSDK.expand?.();

    // показать Popular из cache ещё до сети (если есть)
    ensurePopularFromCache();

    // нижняя кнопка корзины
    this.updateMainButton();

    // параллельно тянем данные и перерисовываем
    await Promise.allSettled([
      this.loadCafeInfo(),
      this.loadCategories(),
      this.loadPopularMenu(), // обновит cache и перерисует
    ]);
  }

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

  async loadCafeInfo() {
    try {
      const info = await getInfo();

      if (info?.coverImage) { loadImage($("#cafe-cover"), info.coverImage); $("#cafe-cover").removeClass("shimmer"); }
      if (info?.logoImage)  { loadImage($("#cafe-logo"),  info.logoImage);  $("#cafe-logo").removeClass("shimmer"); }

      if (info?.name)              $("#cafe-name").text(info.name);
      if (info?.kitchenCategories) $("#cafe-kitchen-categories").text(info.kitchenCategories);
      if (info?.rating)            $("#cafe-rating").text(info.rating);
      if (info?.cookingTime)       $("#cafe-cooking-time").text(info.cookingTime);
      if (info?.status)            $("#cafe-status").text(info.status);

      $("#cafe-info, #cafe-name, #cafe-kitchen-categories, .cafe-parameters-container")
        .removeClass("shimmer");
    } catch (e) {
      console.error("[MainPage] failed to load info", e);
    }
  }

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

  /* Popular */
  renderPopular(items = []) {
    renderPopularSmart(items);
  }

  async loadPopularMenu() {
    // сразу кэш, если есть
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