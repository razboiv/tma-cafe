// frontend/js/pages/cart.js
// Серверный Checkout: отдаём корзину на /order, открываем invoice в Telegram

import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { createOrder } from "../requests/requests.js";

// Нужен только обработчик checkout; остальное в проекте не трогаем.
export default function initCartPage() {
  const checkoutBtn =
    document.querySelector('[data-action="checkout"]') ||
    document.querySelector(".js-checkout") ||
    document.getElementById("checkout") ||
    document.querySelector('button[type="submit"]');

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await handleCheckout(checkoutBtn);
    });
  }
}

async function handleCheckout(btn) {
  try {
    btn?.setAttribute("disabled", "disabled");

    const items = Cart.getItems();
    if (!items || !items.length) {
      (TelegramSDK.showAlert && TelegramSDK.showAlert("Cart is empty")) || alert("Cart is empty");
      btn?.removeAttribute("disabled");
      return;
    }

    // Строим payload как ждёт /order
    const payload = {
      _auth:
        (TelegramSDK.getInitData && TelegramSDK.getInitData()) ||
        (window.Telegram?.WebApp?.initData ?? ""),
      cartItems: items.map((it) => ({
        cafeItem: { id: it.cafeItem.id, name: it.cafeItem.name },
        variant: { name: it.variant.name, cost: Number(it.variant.cost) }, // cost в центах
        quantity: Number(it.quantity),
      })),
    };

    // Вызываем бекенд
    const res = await createOrder(payload);
    if (!res || !res.invoiceUrl) throw new Error("No invoiceUrl in response");

    // Открываем счёт в Telegram
    if (typeof TelegramSDK.openInvoice === "function") {
      TelegramSDK.openInvoice(res.invoiceUrl, (status) => console.log("invoice:", status));
    } else if (window.Telegram?.WebApp?.openInvoice) {
      window.Telegram.WebApp.openInvoice(res.invoiceUrl, (status) => console.log("invoice:", status));
    } else {
      // крайний случай
      window.location.href = res.invoiceUrl;
    }

    // Очищаем корзину после попытки открыть инвойс
    Cart.clear();
  } catch (err) {
    console.error("Checkout error:", err);
    (TelegramSDK.showAlert && TelegramSDK.showAlert("Не удалось создать оплату. Попробуйте ещё раз.")) ||
      alert("Не удалось создать оплату. Попробуйте ещё раз.");
  } finally {
    btn?.removeAttribute("disabled");
  }
}
