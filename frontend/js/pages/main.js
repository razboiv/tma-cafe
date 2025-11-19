// ===== инфо о кафе =====
async #loadCafeInfo() {
  try {
    const info = await getInfo();
    console.log("[MainPage] info", info);

    // убираем скелет-анимацию с верхнего блока
    $("#cafe-logo").removeClass("shimmer");
    $("#cafe-cover").removeClass("shimmer");
    $("#cafe-info").removeClass("shimmer");
    $("#cafe-name").removeClass("shimmer");
    $("#cafe-kitchen-categories").removeClass("shimmer");
    $("#cafe-parameters-container").removeClass("shimmer");

    if (info?.title) {
      $("#cafe-name").text(info.title);
    }

    if (info?.description) {
      $("#cafe-description").text(info.description);
    }

    if (info?.coverImage) {
      loadImage($("#cafe-cover"), info.coverImage);
    }

    if (info?.kitchenCategories) {
      $("#cafe-kitchen-categories").text(info.kitchenCategories);
    }

    if (info?.cookingTime) {
      $("#cafe-cooking-time").text(info.cookingTime);
    }

    if (info?.status) {
      $("#cafe-status").text(info.status);
    }

    if (info?.rating) {
      $("#cafe-rating").text(info.rating);
    }
  } catch (e) {
    console.error("[MainPage] failed to load info", e);
  }
}
