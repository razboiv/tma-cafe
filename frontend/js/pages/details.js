// frontend/js/pages/details.js
// Детальная карточка блюда: загрузка данных, варианты, qty, MainButton

import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";

// ---- helpers ---------------------------------------------------------------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const formatPrice = (n) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
};

async function fetchDetails(id) {
  const url = `/menu/details/${encodeURIComponent(id)}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load details (${res.status})`);
  return res.json();
}

function safeText(el, text) {
  if (el) el.textContent = text ?? "";
}

function setActive(btn, on) {
  if (!btn) return;
  btn.classList.toggle("active", !!on);
  btn.setAttribute("aria-pressed", on ? "true" : "false");
}

function getCartCount() {
  try {
    if (typeof Cart?.getPortionCount === "function") return Cart.getPortionCount();
    if (typeof Cart?.getCount === "function") return Cart.getCount();
    if (typeof Cart?.count === "function") return Cart.count();
    if (typeof Cart?.items === "function") return Cart.items().length;
    return 0;
  } catch {
    return 0;
  }
}

function addToCartUniversal(item, qty) {
  // Пытаемся попасть в любой из распространённых API корзины
  if (typeof Cart?.add === "function") return Cart.add(item, qty);
  if (typeof Cart?.plus === "function") return Cart.plus(item, qty);
  if (typeof Cart?.set === "function") return Cart.set(item, qty);
  // Фолбэк: складываем примитивно
  const list = JSON.parse(localStorage.getItem("__tmp_cart") || "[]");
  list.push({ ...item, qty });
  localStorage.setItem("__tmp_cart", JSON.stringify(list));
}

// ---- страница --------------------------------------------------------------

export default class DetailsPage extends Route {
  constructor() {
    super("root", "/pages/details.html");
  }

  async load(params) {
    TelegramSDK.expand?.();

    const id = (params?.id || "").toString();
    console.log("[Details] open", id);

    const page = document; // шаблон уже отрендерен роутером
    const els = {
      coverWrap: $("#details-cover", page),
      coverImg: $("#details-image", page),
      title: $("#details-title", page),
      desc: $("#details-desc", page),
      grams: $("#details-grams", page),
      price: $("#details-price", page),

      optSmall: $("#opt-small", page),
      optLarge: $("#opt-large", page),

      qtyMinus: $("#qty-minus", page),
      qtyPlus: $("#qty-plus", page),
      qtyValue: $("#qty-value", page),
    };

    // Состояние выбора
    let data = null;
    let selectedOption = "Small";
    let qty = 1;

    // Изначально показываем кнопку добавления
    document.body.dataset.mainbutton = "";
    TelegramSDK.showMainButton?.("ADD TO CART", onAddToCart);

    // Загрузка данных
    try {
      data = await fetchDetails(id);

      // Заполнение текста
      safeText(els.title, data?.title || data?.name || "");
      safeText(els.desc, data?.description || "");
      safeText(els.grams, data?.weight ? `${data.weight}g` : (data?.portion || ""));
      safeText(els.price, formatPrice(data?.price ?? data?.smallPrice ?? 0));

      // Картинка
      const imgUrl = data?.image || data?.coverImage || data?.photo || "";
      if (els.coverImg && imgUrl) {
        els.coverImg.style.opacity = "0";
        els.coverImg.onload = () => (els.coverImg.style.opacity = "1");
        els.coverImg.src = imgUrl;
      } else if (els.coverWrap) {
        els.coverWrap.style.display = "none";
      }

      // Варианты
      if (els.optSmall) {
        els.optSmall.addEventListener("click", () => {
          selectedOption = "Small";
          setActive(els.optSmall, true);
          setActive(els.optLarge, false);
          safeText(els.price, formatPrice(data?.smallPrice ?? data?.price ?? 0));
        });
      }
      if (els.optLarge) {
        els.optLarge.addEventListener("click", () => {
          selectedOption = "Large";
          setActive(els.optSmall, false);
          setActive(els.optLarge, true);
          safeText(els.price, formatPrice(data?.largePrice ?? (data?.priceLarge ?? 0)));
        });
      }
      // Активируем Small по умолчанию
      setActive(els.optSmall, true);

      // Количество
      const syncQty = () => safeText(els.qtyValue, String(qty));
      els.qtyMinus?.addEventListener("click", () => {
        qty = Math.max(1, qty - 1);
        syncQty();
      });
      els.qtyPlus?.addEventListener("click", () => {
        qty = Math.min(99, qty + 1);
        syncQty();
      });
      syncQty();
    } catch (e) {
      console.error("Details load error:", e);
      TelegramSDK.showAlert?.("Не удалось загрузить блюдо. Попробуйте позже.");
    }

    // --- handlers -----------------------------------------------------------

    function onAddToCart() {
      if (!data) return;

      const price =
        selectedOption === "Large"
          ? (data?.largePrice ?? data?.priceLarge ?? data?.price ?? 0)
          : (data?.smallPrice ?? data?.price ?? 0);

      const item = {
        id: data?.id || id,
        title: data?.title || data?.name || "",
        image: data?.image || data?.coverImage || "",
        option: selectedOption,
        price,
      };

      addToCartUniversal(item, qty);

      // Переключаем MainButton на «MY CART …»
      const count = getCartCount() || qty;
      const postfix = count === 1 ? "POSITION" : "POSITIONS";
      document.body.dataset.mainbutton = "cart"; // наш persist-mb.js перехватит клик
      TelegramSDK.showMainButton?.(`MY CART · ${count} ${postfix}`, () => navigateTo("cart"));
    }
  }

  destroy() {
    // Скрываем MainButton, когда уходим со страницы
    document.body.dataset.mainbutton = "";
    TelegramSDK.hideMainButton?.();
  }
}