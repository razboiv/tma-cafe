// В main.js замени целиком функцию loadCategories()
async function loadCategories() {
  try {
    const categories = await getCategories();

    // снять shimmer с заголовка и контейнера
    $("#cafe-section-categories-title").removeClass("shimmer");
    const $cont = $("#cafe-categories");
    $cont.removeClass("shimmer").find(".shimmer").removeClass("shimmer");

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
        if (category.icon) img.attr("src", category.icon);
        tpl.on("click", () => navigateTo("category", JSON.stringify({ id: category.id })));
      }
    );

    // повторно убираем любые оставшиеся шимер-классы
    $cont.removeClass("shimmer").find(".shimmer").removeClass("shimmer");
  } catch (e) {
    console.error("[MainPage] failed to load categories", e);
    $("#cafe-categories").removeClass("shimmer").find(".shimmer").removeClass("shimmer");
  }
}