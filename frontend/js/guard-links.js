// frontend/js/guard-links.js
// Перехватываем клики по карточкам и переводим их на SPA-роутер
import { navigateTo } from "./routing/router.js";

function idFromDetailsPath(href) {
  // ожидаем /menu/details/<id>
  const m = href.match(/\/details\/([^/?#]+)/);
  return m?.[1] || null;
}
function catFromQuery(href) {
  // ожидаем /menu?category=<id> или /category?id=<id>
  try {
    const u = new URL(href, location.origin);
    return (
      u.searchParams.get("category") ||
      u.searchParams.get("id") ||
      null
    );
  } catch {
    return null;
  }
}

function handleAnchor(a) {
  const href = a.getAttribute("href") || "";
  if (!href || /^https?:\/\//i.test(href)) return false; // внешние ссылки не трогаем

  // Детали товара
  const detailsId = idFromDetailsPath(href);
  if (detailsId) {
    navigateTo("details", { id: detailsId });
    return true;
  }

  // Категория
  if (href.startsWith("/menu") || href.startsWith("/category")) {
    const catId =
      catFromQuery(href) ||
      a.dataset.id ||
      a.dataset.catId ||
      a.dataset.categoryId;
    if (catId) {
      navigateTo("category", { id: catId });
      return true;
    }
  }

  // Хэштеги вида #/details?id=...
  if (href.startsWith("#/")) {
    const params = new URLSearchParams(href.split("?")[1] || "");
    const id = params.get("id");
    if (href.startsWith("#/details") && id) {
      navigateTo("details", { id });
      return true;
    }
    if (href.startsWith("#/category") && id) {
      navigateTo("category", { id });
      return true;
    }
  }

  return false;
}

// Делегированный перехват
document.addEventListener("click", (e) => {
  const el = e.target.closest("a,[data-route]");
  if (!el) return;

  // Вёрстка может ставить data-route="details|category" и data-id
  if (el.dataset?.route === "details" && el.dataset?.id) {
    e.preventDefault();
    navigateTo("details", { id: el.dataset.id });
    return;
  }
  if (el.dataset?.route === "category" && el.dataset?.id) {
    e.preventDefault();
    navigateTo("category", { id: el.dataset.id });
    return;
  }

  // Обычный <a href="..."> — переписываем
  if (el.tagName === "A" && handleAnchor(el)) {
    e.preventDefault();
  }
});

// Управляем BackButton Телеграма: на главной скрыт, на внутренних — показан
function syncBackButton() {
  const BB = window.Telegram?.WebApp?.BackButton;
  if (!BB) return;
  const atRoot = !location.hash || location.hash === "#" || location.hash === "#/";
  if (atRoot) {
    BB.hide();
  } else {
    BB.show();
    // один раз повесить — безопасно
    try { BB.onClick(() => history.back()); } catch {}
  }
}
window.addEventListener("hashchange", syncBackButton);
syncBackButton();