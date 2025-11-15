// frontend/js/utils/dom.js

/**
 * Create items from the provided data and template and append them to container,
 * when all child images are loaded. This function was developed specifically
 * for the lists with images.
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
  const total = data.length;

  // Если данных нет — просто очищаем контейнер и выходим
  if (total === 0) {
    fillContainer(containerSelector, filledTemplates);
    return;
  }

  let handled = 0;

  const markHandled = () => {
    handled += 1;
    if (handled === total) {
      // Как только обработали все элементы (успешно или с ошибкой) —
      // подменяем шиммеры реальными карточками.
      fillContainer(containerSelector, filledTemplates);
    }
  };

  data.forEach((dataItem) => {
    const template = $(templateHtml);
    templateSetup(template, dataItem);

    const $img = template.find(loadableImageSelector);

    if ($img.length === 0) {
      // В шаблоне нет картинки — считаем элемент готовым сразу
      markHandled();
    } else {
      // Считаем элемент готовым как при успешной загрузке, так и при ошибке
      $img.on("load", markHandled);
      $img.on("error", markHandled);
    }

    filledTemplates.push(template);
  });
}

/**
 * Replace existing container elements with the new ones.
 * @param {string} selector Parent container selector.
 * @param {*}      elements Instances of elements in any format, supported by jQuery.append() method.
 */
export function fillContainer(selector, elements) {
  const container = $(selector);
  container.empty();
  elements.forEach((el) => container.append(el));
}

/**
 * Load image with shimmer effect while loading.
 * @param {*} imageElement jQuery element of the image.
 * @param {string} imageUrl Image URL to load.
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
