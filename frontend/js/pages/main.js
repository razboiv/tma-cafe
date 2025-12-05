// Главная: аккуратные блоки, картинки категорий/популярного, клики

import TelegramSDK from "../telegram/telegram.js";
import * as API from "../requests/requests.js";

const esc = (s) =>
  (s ?? "").toString().replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

async function getInfo() {
  if (API.getInfo) return API.getInfo();
  const r = await fetch("/menu/info"); return r.json();
}
async function getCategories() {
  if (API.getCategories) return API.getCategories();
  const r = await fetch("/menu/categories"); return r.json();
}
async function getPopularMenu() {
  if (API.getPopularMenu) return API.getPopularMenu();
  const r = await fetch("/menu/popular"); return r.json();
}

export default async function MainPage() {
  const [info, categories, popular] = await Promise.all([
    getInfo(), getCategories(), getPopularMenu()
  ]);

  const hero = (info?.coverImage)
    ? `<div class="hero"><img class="hero__img" src="${esc(info.coverImage)}" alt=""></div>`
    : "";

  const catsHtml = (categories || []).map(c => `
    <button class="cat-chip" data-id="${esc(c.id)}">
      <img class="cat-chip__icon" src="${esc(c.icon)}" alt="">
      <span>${esc(c.title || c.name)}</span>
    </button>
  `).join("");

  const cardsHtml = (popular || []).map(p => {
    const img = p.photo || p.image || p.cover || p.picture;
    const title = p.title || p.name || "Item";
    const price =
      p.price ?? p.cost ?? p.amount ??
      (p.prices && p.prices[0] && p.prices[0].price) ??
      (p.small && p.small.price);

    return `
      <div class="card" data-id="${esc(p.id)}">
        ${img ? `<img class="card__img" src="${esc(img)}" alt="${esc(title)}">` : ""}
        <div class="card__title">${esc(title)}</div>
        ${price != null ? `<div class="card__price">$${Number(price).toFixed(2)}</div>` : ""}
      </div>
    `;
  }).join("");

  const html = `
  <style>
    .hero{margin:-8px -8px 12px -8px;border-radius:16px;overflow:hidden}
    .hero__img{width:100%;display:block}
    .cafe{padding:8px 0 16px}
    .cafe__title{font-size:28px;font-weight:700;margin:4px 0}
    .cafe__meta{opacity:.8;font-size:14px;display:flex;gap:12px}
    .section-title{font-size:20px;font-weight:700;margin:18px 0 10px}
    .cat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .cat-chip{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}
    .cat-chip__icon{width:22px;height:22px}
    .popular{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .card{border-radius:16px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
    .card__img{width:100%;height:130px;object-fit:cover;display:block}
    .card__title{font-weight:600;padding:10px 12px 0}
    .card__price{opacity:.85;font-size:14px;padding:0 12px 12px}
  </style>

  ${hero}
  <div class="cafe">
    <div class="cafe__title">${esc(info?.name || "Cafe")}</div>
    <div class="cafe__meta">
      ${info?.rating ? `⭐ ${esc(info.rating)} (${esc(info.votes ?? "212")})` : ""}
      ${info?.cookingTime ? `⏱ ${esc(info.cookingTime)}` : ""}
    </div>
  </div>

  <div class="section-title">Categories</div>
  <div class="cat-grid">${catsHtml}</div>

  <div class="section-title">Popular</div>
  <div class="popular">${cardsHtml}</div>
  `;

  // Навешиваем события после вставки HTML
  setTimeout(() => {
    document.querySelectorAll(".cat-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        import("../routing/router.js").then(r => r.navigateTo("category", { id: btn.dataset.id }));
      });
    });
    document.querySelectorAll(".card").forEach(card => {
      card.addEventListener("click", () => {
        import("../routing/router.js").then(r => r.navigateTo("details", { id: card.dataset.id }));
      });
    });

    // Кнопки Telegram — уберём лишнее на главной
    try {
      TelegramSDK.hideMainButton();
      TelegramSDK.hideSecondaryButton();
      TelegramSDK.setBackButton(false);
    } catch {}
  }, 0);

  return html;
}