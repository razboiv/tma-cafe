// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { getMenuItem } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

export default class DetailsPage extends Route { ... }
  constructor() {
    super("details", "/pages/details.html");
  }

  async load(params) {
    console.log("[DetailsPage] load", params);
    TelegramSDK.expand();

    let itemId = null;
    try {
      const parsed = JSON.parse(params || "{}");
      itemId = parsed.id;
    } catch (e) {
      console.error("[DetailsPage] failed to parse params", e);
    }

    if (!itemId) {
      console.error("[DetailsPage] no itemId");
      return;
    }

    try {
      const item = await getMenuItem(itemId);
      this.#fillItem(item);
    } catch (err) {
      console.error("[DetailsPage] failed to load item", err);
    }
  }

  #fillItem(item) {
    loadImage($("#details-image"), item.image);
    $("#details-name").text(item.name);
    $("#details-description").text(item.description);

    const variantsContainer = $("#details-variants");
    variantsContainer.empty();

    item.variants.forEach((variant) => {
      const templateHtml = $("#details-variant-template").html();
      const el = $(templateHtml);

      el.attr("id", variant.id);
      el.find("#details-variant-name").text(variant.name);
      el.find("#details-variant-cost").text(variant.cost);
      el.find("#details-variant-weight").text(variant.weight);

      el.on("click", () => {
        Cart.add(item, variant);
      });

      variantsContainer.append(el);
    });
  }
}
