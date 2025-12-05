import { navigateTo } from '../routing/router.js';
import { getInfo, getCategories, getPopularMenu } from '../requests/requests.js';

function cardHtml(item) {
  // карточка популярного блюда — НИКАКОГО текстового узла вне разметки
  return `
    <a class="popular-card" href="#/details?id=${encodeURIComponent(item.id)}" title="${item.name}">
      <div class="popular-card__img" style="background-image:url('${item.photo}')"></div>
      <div class="popular-card__footer">
        <div class="popular-card__name">${item.name}</div>
        <div class="popular-card__price">$${item.price}</div>
      </div>
    </a>`;
}

export default async function MainPage() {
  const [info, cats, popular] = await Promise.all([
    getInfo(), getCategories(), getPopularMenu()
  ]);

  const catsHtml = cats.map(c => `
    <button class="cat" data-id="${c.id}">
      <span class="cat__icon">${c.icon || ''}</span>
      <span class="cat__name">${c.name}</span>
    </button>`).join('');

  const popularHtml = popular.map(cardHtml).join('');

  // готовая страница
  const html = `
  <section class="cafe">
    <img class="cafe__cover" src="${info.coverImage}" alt="">
    <div class="cafe__title">${info.name}</div>
    <div class="cafe__meta">
      <span>${info.rating || '4.5'} ★</span>
      <span>${info.cookingTime}</span>
    </div>
  </section>

  <section class="cats">
    <h2>Categories</h2>
    <div class="cats__list">${catsHtml}</div>
  </section>

  <section class="popular">
    <h2>Popular</h2>
    <div class="popular__list">${popularHtml}</div>
  </section>`;

  // навешиваем события сразу после монтирования
  setTimeout(() => {
    document.querySelectorAll('.cats__list .cat').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        navigateTo('category', { id });
      });
    });
    document.querySelectorAll('.popular__list .popular-card').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const url = new URL(a.getAttribute('href'), location.href);
        navigateTo('details', Object.fromEntries(url.searchParams));
      });
    });
  });

  return html;
}