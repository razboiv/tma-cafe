/**
 * Create items from the provided data and template and append them to container,
 * when all child image are loaded. This function was developed specifically for the lists
 * with images.
 * @param {string} containerSelector The selector of the parent container, where items should be placed.
 * @param {string} templateSelector The selector of the item's <template>.
 * @param {string} loadableImageSelector The CSS selector of <img> inside the template.
 * @param {*} data List of data.
 * @param {*} templateSetup Lambda for custom template filling, e.g. setting CSS, text, etc.
 */
export function replaceShimmerContent(containerSelector, templateSelector, loadableImageSelector, data, templateSetup) {
    let templateHtml = $(templateSelector).html();
    var imageLoaded = 0;
    let imageShouldBeLoaded = data.length;
    let filledTemplates = [];
    data.forEach(dataItem => {
        let filledTemplate = $(templateHtml);
        templateSetup(filledTemplate, dataItem);
        filledTemplate.find(loadableImageSelector).on('load', () => {
            imageLoaded++;
            if (imageLoaded == imageShouldBeLoaded) {
                fillContainer(containerSelector, filledTemplates);
            }
        });
        filledTemplates.push(filledTemplate);
    });
}

/**
 * Fill container with child from 'content' list and remove 'shimmer' CSS class.
 * @param {*} containerSelector The selector of the parent container, where items should be placed.
 * @param {*} content Children, probably created by 'replaceShimmerContent' function.
 */
function fillContainer(containerSelector, content) {
    const container = $(containerSelector);
    container.empty();
    container.append(content);
    container.removeClass('shimmer');
}

/**
 * Safe image loading: hide the image while it's loading and show it back
 * when it's loaded. It ensures the image won't be shown with wrong size.
 * @param {*} imageElement HTML <img> element.
 * @param {*} imageUrl Image URL to load.
 */
export function loadImage(imageElement, imageUrl) {
    if (imageElement != null) {
        if (!imageElement.hasClass('shimmer')) {
            imageElement.addClass('shimmer');
        }
        imageElement.attr('src', imageUrl);
        imageElement.on('load', () => imageElement.removeClass('shimmer'));
    }
}