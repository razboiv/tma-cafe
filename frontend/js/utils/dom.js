// frontend/js/utils/dom.js

/**
 * Create items from the provided data and template and append them to container,
 * then replace shimmer-elements with real content.
 *
 * @param {string} containerSelector  Parent container selector.
 * @param {string} templateSelector   Template selector.
 * @param {string} loadableImageSelector Selector for image inside template.
 * @param {Array}  data               Array of items.
 * @param {*}      templateSetup      Callback to fill template with data.
 */
export function replaceShimmerContent(
  containerSelector,
  templateSelector,
  loadableImageSelector,
  data,
  templateSetup
) {
  const templateHtml = $(templateSelector).html();
  if (!templateHtml) {
    console.error("[dom] template not found:", templateSelector);
    return;
  }

  const filledTemplates = [];

  data.forEach((item) => {
    const template = $(templateHtml);

    // Заполняем шаблон данными (текст, src и т.п.)
    templateSetup(template, item);

    // Если в шаблоне есть изображение — грузим его с шиммером
    const imageElement = template.find(loadableImageSelector);
    if (imageElement.length > 0) {
      const url = imageElement.attr("src");
      if (url) {
        loadImage(imageElement, url);
      }
    }

    filledTemplates.push(template);
  });

  fillContainer(containerSelector, filledTemplates);
}

/**
 * Replace existing container elements with the new ones.
 *
 * @param {string} selector  Parent container selector.
 * @param {*}      elements  Elements array, supported by jQuery.append.
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
 * @param {string} imageUrl URL of the image.
 */
export function loadImage(imageElement, imageUrl) {
  if (imageElement == null) {
    return;
  }

  if (!imageElement.hasClass("shimmer")) {
    imageElement.addClass("shimmer");
  }

  imageElement.attr("src", imageUrl);
  imageElement.on("load", () => imageElement.removeClass("shimmer"));
}
