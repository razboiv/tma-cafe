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

  // Telegram сообщает, что WebApp готов к показу
  static ready() {
    try { Telegram?.WebApp?.ready?.(); } catch (_) {}
  }

  // -------- MainButton --------
  static showMainButton(text, onClick) {
    const MB = Telegram?.WebApp?.MainButton;
    if (!MB) return;
    MB.setParams({ text, is_active: true, is_visible: true })
      .offClick?.(this.#mainButtonClickCallback)
      .onClick?.(onClick);
    MB.show?.();
    this.#mainButtonClickCallback = onClick;
  }

  static setMainButtonLoading(isLoading) {
    const MB = Telegram?.WebApp?.MainButton;
    if (!MB) return;
    if (isLoading) MB.showProgress?.(false);
    else MB.hideProgress?.();
  }

  static hideMainButton() {
    const MB = Telegram?.WebApp?.MainButton;
    MB?.hide?.();
  }

  // -------- SecondaryButton --------
  static showSecondaryButton(text, onClick) {
    const SB = Telegram?.WebApp?.SecondaryButton;
    if (!SB) return; // нет на старых клиентах — просто игнор
    SB.setParams?.({ text, is_visible: true, is_active: true });
    SB.offClick?.(this.#secondaryButtonClickCallback);
    SB.onClick?.(onClick);
    SB.show?.();
    this.#secondaryButtonClickCallback = onClick;
  }

  static setSecondaryButtonLoading(isLoading) {
    const SB = Telegram?.WebApp?.SecondaryButton;
    if (!SB) return;
    if (isLoading) SB.showProgress?.(false);
    else SB.hideProgress?.();
  }

  static hideSecondaryButton() {
    const SB = Telegram?.WebApp?.SecondaryButton;
    SB?.offClick?.(this.#secondaryButtonClickCallback);
    SB?.hide?.();
  }

  // -------- BackButton --------
  static showBackButton(onClick) {
    const BB = Telegram?.WebApp?.BackButton;
    if (!BB) return;
    BB.offClick?.(this.#backButtonClickCallback);
    BB.onClick?.(onClick);
    BB.show?.();
    this.#backButtonClickCallback = onClick;
  }

  static hideBackButton() {
    Telegram?.WebApp?.BackButton?.hide?.();
  }

  // -------- Misc --------
  static notificationOccured(style) {
    try { Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(style); } catch (_) {}
  }

  static openInvoice(url, callback) { Telegram?.WebApp?.openInvoice?.(url, callback); }
  static expand() { try { Telegram?.WebApp?.expand?.(); } catch (_) {} }
  static close() { try { Telegram?.WebApp?.close?.(); } catch (_) {} }
  static sendData(data) { try { Telegram?.WebApp?.sendData?.(data); } catch (_) {} }
}

export default TelegramSDK;