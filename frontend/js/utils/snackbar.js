// frontend/js/utils/snackbar.js
import { TelegramSDK } from "../telegram/telegram.js";

/**
 * Util-класс для показа Snackbar.
 */
class Snackbar {
  // id → timeoutId
  static #snackbarIds = {};

  /**
   * Показать snackbar в контейнере parentId (без #).
   */
  static showSnackbar(parentId, text, params) {
    const key = `${parentId}-snackbar`;
    const currentSnackbarId = this.#snackbarIds[key];

    // если уже есть snackbar — просто обновляем текст/стили
    if (currentSnackbarId != null) {
      clearTimeout(currentSnackbarId);

      const snackbar = $(`#${key}`);

      if (params != null) {
        snackbar.css(params);
      }

      snackbar.text(text);
      this.#hideSnackbarWithDelay(key, snackbar);
      return;
    }

    // создаём новый
    const snackbar = $(
      `<div id="${key}" class="snackbar">${text}</div>`
    );

    if (params != null) {
      snackbar.css(params);
    }

    $("#content").append(snackbar);
    this.#hideSnackbarWithDelay(key, snackbar);
  }

  static #hideSnackbarWithDelay(key, $snackbar) {
    const timeoutId = setTimeout(() => {
      $snackbar.fadeOut(150, () => $snackbar.remove());
      delete this.#snackbarIds[key];
    }, 2000);

    this.#snackbarIds[key] = timeoutId;
  }
}

// одновременно экспортируем и как default, и как именованный
export default Snackbar;
export { Snackbar };
