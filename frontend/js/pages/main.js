// frontend/js/pages/main.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getInfo, getCategories, getPopularMenu } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage, replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/* ——— лёгкий raw-рендер на случай, если template не найдётся ——— */
function renderPopularRaw(items = []) {
  const cont = document.querySelector("#cafe-popular");
  if (!cont) return;
  document.querySelector("#cafe-section-popular-title")?.classList.remove("shimmer");
  cont.classList.remove("shimmer");
  cont.innerHTML = "";
  (Array.isArray(items) ? items : []).forEach((it) => {
    const card = document.createElement("div");
    card.className = "cafe-item-container";
    const img = document.createElement("img");
    img.className = "cafe-item-image";
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
}

export default class MainPage extends Route {
  constructor() {
    super("root", "/pages/main.html");
  }

  async load() {
    // только на главной — скрыть back, показать нормальную анимацию
    TelegramSDK.hideBackButton();
    TelegramSDK.ready?.();
    TelegramSDK.expand?.();

    this.updateMainButton();

    await Promise.allSettled([
      this.loadCafeInfo(),
      this.loadCategories(),
      this.loadPopularMenu(), // с фолбэком ниже
    ]);
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

  async loadCafeInfo() {
    try {
      const info = await getInfo();
      if (info?.coverImage) { loadImage($("#cafe-cover"), info.coverImage); $("#cafe-cover").removeClass("shimmer"); }
      if (info?.logoImage)  { loadImage($("#cafe-logo"),  info.logoImage);  $("#cafe-logo").removeClass("shimmer"); }
      if (info?.name) $("#cafe-name").text(info.name);
      if (info?.kitchenCategories) $("#cafe-kitchen-categories").text(info.kitchenCategories);
      if (info?.rating) $("#cafe-rating").text(info.rating);
      if (info?.cookingTime) $("#cafe-cooking-time").text(info.cookingTime);
      if (info?.status) $("#cafe-status").text(info.status);
      $("#cafe-info, #cafe-name, #cafe-kitchen-categories, .cafe-parameters-container").removeClass("shimmer");
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
          tpl.on("click", () => navigateTo("category", JSON.stringify({ id: category.id })));
        }
      );
    } catch (e) {
      console.error("[MainPage] failed to load categories", e);
    }
  }

  async loadPopularMenu() {
    try {
      const items = await getPopularMenu();
      $("#cafe-section-popular-title").removeClass("shimmer");
      // пробуем через template
      if (document.querySelector("#cafe-item-template")) {
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
              navigateTo("details", JSON.stringify({ id: item?.id, categoryId: item?.categoryId || undefined }));
            });
          }
        );
      } else {
        // безопасный фолбэк
        renderPopularRaw(items);
      }
    } catch (e) {
      console.error("[MainPage] failed to load popular menu", e);
      // ещё один фолбэк — если сеть подвела, покажем пустой блок без шимеров
      renderPopularRaw([]);
    }
  }
}