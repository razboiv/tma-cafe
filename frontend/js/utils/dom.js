// frontend/js/utils/dom.js

/**
 * Create items from the provided data and template and append them to container.
 * This function was developed specifically for the lists with images.
 *
 * @param {string} containerSelector The selector of the parent container,
 * where items should be placed.
 * @param {string} templateSelector The selector of the item's <template>.
 * @param {string} loadableImageSelector The selector for the image
 * placed somewhere in template.
 * @param {Array}  data Array of items.
 * @param {*}      templateSetup Lambda for custom template filling,
 * e.g. setting CSS, text, etc.
 */
export function replaceShimmerContent(
  containerSelector,
  templateSelector,
  loadableImageSelector,
  data,
  templateSetup,
) {
  const templateHtml = $(templateSelector).html();
  const filledTemplates = [];

  data.forEach((dataItem) => {
    const template = $(templateHtml);

    // Заполняем шаблон данными
    templateSetup(template, dataItem);

    // Как только картинка загрузится – убираем shimmer с неё
    const img = template.find(loadableImageSelector);
    if (img && img.length) {
      img.on("load", () => img.removeClass("shimmer"));
    }

    filledTemplates.push(template);
  });

  // Главное – ПОДМЕНИТЬ содержимое контейнера
  fillContainer(containerSelector, filledTemplates);
}

/**
 * Replace existing container elements with the new ones.
 *
 * @param {string} selector Parent container selector.
 * @param {*}      elements Instances of elements in any format,
 * supported by jQuery.append() method.
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
  if (!imageElement  !imageElement.length  !imageUrl) {
    return;
  }

  // Пока грузится – пусть будет shimmer
  if (!imageElement.hasClass("shimmer")) {
    imageElement.addClass("shimmer");
  }

  imageElement.attr("src", imageUrl);

  imageElement.on("load", () => {
    imageElement.removeClass("shimmer");
  });
}
