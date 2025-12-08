// frontend/js/telegram/telegram.js
/**
 * Wrapper for simplifying usage of Telegram.WebApp class and its methods.
 */
export class TelegramSDK {
  static #mainButtonClickCallback;
  static #secondaryButtonClickCallback;
  static #backButtonClickCallback;

  static getInitData() {
    return (window.Telegram && Telegram.WebApp && Telegram.WebApp.initData) || "";
  }

  // -------- MainButton --------
  static showMainButton(text, onClick) {
    Telegram.WebApp.MainButton
      .setParams({ text, is_active: true, is_visible: true })
      .offClick(this.#mainButtonClickCallback)
      .onClick(onClick)
      .show();
    this.#mainButtonClickCallback = onClick;
  }

  static setMainButtonLoading(isLoading) {
    if (!Telegram.WebApp.MainButton) return;
    if (isLoading) Telegram.WebApp.MainButton.showProgress(false);
    else Telegram.WebApp.MainButton.hideProgress();
  }

  static hideMainButton() {
    if (Telegram.WebApp.MainButton) Telegram.WebApp.MainButton.hide();
  }

  // -------- SecondaryButton (новое) --------
  static showSecondaryButton(text, onClick) {
    const SB = Telegram?.WebApp?.SecondaryButton;
    if (!SB) return; // на старых клиентах просто ничего не делаем
    SB.setParams({ text, is_visible: true, is_active: true })
      .offClick(this.#secondaryButtonClickCallback)
      .onClick(onClick)
      .show();
    this.#secondaryButtonClickCallback = onClick;
  }

  static setSecondaryButtonLoading(isLoading) {
    const SB = Telegram?.WebApp?.SecondaryButton;
    if (!SB) return;
    if (isLoading) SB.showProgress(false);
    else SB.hideProgress();
  }

  static hideSecondaryButton() {
    const SB = Telegram?.WebApp?.SecondaryButton;
    if (!SB) return;
    SB.offClick(this.#secondaryButtonClickCallback);
    SB.hide();
  }

  // -------- BackButton --------
  static showBackButton(onClick) {
    Telegram.WebApp.BackButton
      .offClick(this.#backButtonClickCallback)
      .onClick(onClick)
      .show();
    this.#backButtonClickCallback = onClick;
  }

  static hideBackButton() {
    Telegram.WebApp.BackButton.hide();
  }

  // -------- Misc --------
  static notificationOccured(style) {
    try { Telegram.WebApp.HapticFeedback?.notificationOccurred?.(style); } catch (_) {}
  }

  static openInvoice(url, callback) { Telegram.WebApp.openInvoice(url, callback); }
  static expand() { Telegram.WebApp.expand(); }
  static close() { Telegram.WebApp.close(); }
  static sendData(data) { try { Telegram.WebApp.sendData(data); } catch (_) {} }
}

export default TelegramSDK;