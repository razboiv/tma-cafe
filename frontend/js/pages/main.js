// frontend/js/pages/main.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getInfo, getCategories, getPopularMenu } from "../requests/requests.js";
import { TelegramSDK } from "../telegram/telegram.js";
import { loadImage, replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/**
 * Главная страница: инфо о кафе, категории, популярное меню.
 */
export class MainPage extends Route {
  constructor() {
    super("root", "/pages/main.html");
  }

  async load(params) {
    // основная кнопка
    const portionCount = Cart.getPortionCount();
    if (portionCount > 0) {
      TelegramSDK.showMainButton(
        `MY CART • ${this.#getDisplayPositionCount(portionCount)}`,
        () => navigateTo("cart")
      );
    } else {
      TelegramSDK.hideMainButton();
    }

    // грузим блоки параллельно
    await Promise.allSettled([
      this.#loadCafeInfo(),
      this.#loadCategories(),
      this.#loadPopularMenu()
    ]);
  }

  // ------- data loading -------

  async #loadCafeInfo() {
    try {
      const cafeInfo = await getInfo();
      this.#fillCafeInfo(cafeInfo);
    } catch (e) {
      console.error("Failed to load /info:", e);
    }
  }

  async #loadCategories() {
    try {
      const categories = await getCategories();
      this.#fillCategories(categories);
    } catch (e) {
      console.error("Failed to load /categories:", e);
    }
  }

  async #loadPopularMenu() {
    try {
      const popularMenu = await getPopularMenu();
      this.#fillPopularMenu(popularMenu);
    } catch (e) {
      console.error("Failed to load /menu/popular:", e);
    }
  }

  // ------- fill UI -------

  #fillCafeInfo(cafeInfo) {
    loadImage($("#cafe-logo"), cafeInfo.logoImage);
    loadImage($("#cafe-cover"), cafeInfo.coverImage);

    const cafeInfoTemplate = $("#cafe-info-template").html();
    const filledCafeInfoTemplate = $(cafeInfoTemplate);

    filledCafeInfoTemplate.find("#cafe-name").text(cafeInfo.name);
    filledCafeInfoTemplate.find("#cafe-kitchen-categories").text(cafeInfo.kitchenCategories);
    filledCafeInfoTemplate.find("#cafe-rating").text(cafeInfo.rating);
    filledCafeInfoTemplate.find("#cafe-cooking-time").text(cafeInfo.cookingTime);
    filledCafeInfoTemplate.find("#cafe-status").text(cafeInfo.status);

    $("#cafe-info").empty();
    $("#cafe-info").append(filledCafeInfoTemplate);
  }

  #fillCategories(categories) {
    $("#cafe-section-categories-title").removeClass("shimmer");

    replaceShimmerContent(
      "#cafe-categories",
      "#cafe-category-template",
      "#cafe-category-icon",
      categories,
      (template, cafeCategory) => {
        template.attr("id", cafeCategory.id);
        template.css("background-color", cafeCategory.backgroundColor);
        template.find("#cafe-category-icon").attr("src", cafeCategory.icon);
        template.find("#cafe-category-name").text(cafeCategory.name);

        template.on("click", () => {
          const params = JSON.stringify({ id: cafeCategory.id });
          navigateTo("category", params);
        });
      }
    );
  }

  #fillPopularMenu(popularMenu) {
    $("#cafe-section-popular-title").removeClass("shimmer");

    replaceShimmerContent(
      "#cafe-section-popular",
      "#cafe-item-template",
      "#cafe-item-image",
      popularMenu,
      (template, cafeItem) => {
        template.attr("id", cafeItem.name);
        template.find("#cafe-item-image").attr("src", cafeItem.image);
        template.find("#cafe-item-name").text(cafeItem.name);
        template.find("#cafe-item-description").text(cafeItem.description);

        template.on("click", () => {
          const params = JSON.stringify({ id: cafeItem.id });
          navigateTo("details", params);
        });
      }
    );
  }

  #getDisplayPositionCount(positionCount) {
    return positionCount === 1 ? `${positionCount} POSITION` : `${positionCount} POSITIONS`;
  }
}
