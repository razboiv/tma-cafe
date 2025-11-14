// frontend/js/utils/dom.js

/**
 * Create items from the provided data and template and append them to container,
 * without waiting for all images to be loaded.
 *
 * Мы больше не держим скелетон, пока не загрузятся ВСЕ картинки.
 * Скелетон убираем сразу, а shimmer-класс с картинок снимаем по событию load.
 *
 * @param {string} containerSelector The selector of the parent container, where items should be placed.
 * @param {string} templateSelector The selector of the item's <template>.
 * @param {string} loadableImageSelector The selector for the image placed somewhere in <template>.
 * @param {Array}  data Array of items.
 * @param {*}      templateSetup Lambda for custom template filling, e.g. setting CSS, text, etc.
 */
export function replaceShimmerContent(
  containerSelector,
  templateSelector,
  loadableImageSelector,
  data,
  templateSetup
) {
  const templateHtml = $(templateSelector).html();
  const filledTemplates = [];

  data.forEach((dataItem) => {
    // создаём DOM из шаблона
    const $template = $(templateHtml);

    // наполняем данными (текст, src и т.п.)
    templateSetup($template, dataItem);

    // находим картинку и снимаем shimmer после загрузки
    const $img = $template.find(loadableImageSelector);
    if ($img.length > 0) {
      // если в шаблоне по умолчанию есть класс shimmer — оставляем,
      // и уберём его, когда картинка загрузится
      $img.on("load", () => {
        $img.removeClass("shimmer");
      });
    }

    filledTemplates.push($template);
  });

  // сразу заменяем скелетон реальными элементами
  fillContainer(containerSelector, filledTemplates);
}

/**
 * Replace existing container elements with the new ones.
 *
 * @param {string} selector Parent container selector.
 * @param {*}      elements Instances of elements in any format,
 *                          supported by jQuery.append() method.
 */
export function fillContainer(selector, elements) {
  const container = $(selector);
  container.empty();
  elements.forEach((el) => container.append(el));
}

/**
 * Load image with shimmer effect while loading.
 *
 * @param {*} imageElement jQuery element of the image.
 * @param {*} imageUrl     Image URL to load.
 */
export function loadImage(imageElement, imageUrl) {
  if (imageElement != null) {
    if (!imageElement.hasClass("shimmer")) {
      imageElement.addClass("shimmer");
    }

    imageElement.attr("src", imageUrl);
    imageElement.on("load", () => imageElement.removeClass("shimmer"));
  }
}
