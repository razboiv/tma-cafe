import { getMenuItem } from '../requests/requests.js';
import TelegramSDK from '../telegram/telegram.js';
import { navigateTo } from '../routing/router.js';

export default async function DetailsPage({ id }) {
  if (!id) {
    return `<div style="padding:16px">Item not found</div>`;
  }
  const item = await getMenuItem(id);

  // UI
  const html = `
  <article class="details">
    <div class="details__photo"><img src="${item.photo}" alt=""></div>
    <h1 class="details__title">${item.name}</h1>
    <p class="details__desc">${item.description || ''}</p>

    <div class="details__row">
      <div class="details__price">$${item.price} <span class="details__weight">${item.weight||''}</span></div>
      <div class="details__qty">
        <button class="qty__btn" data-a="dec">−</button>
        <span class="qty__val">1</span>
        <button class="qty__btn" data-a="inc">+</button>
      </div>
    </div>

    <button class="btn btn--primary" data-a="add">ADD TO CART</button>
  </article>`;

  // поведение
  setTimeout(() => {
    const $root = document.querySelector('.details');
    const $val  = $root.querySelector('.qty__val');
    let qty = 1;

    $root.querySelector('[data-a="inc"]').onclick = () => { qty++; $val.textContent = qty; };
    $root.querySelector('[data-a="dec"]').onclick = () => { qty = Math.max(1, qty-1); $val.textContent = qty; };

    $root.querySelector('[data-a="add"]').onclick = async () => {
      await TelegramSDK.cart.add({ id: item.id, qty, name: item.name, price: item.price, photo: item.photo });
      // просто показываем главную кнопку — НО НЕ переходим сами
      TelegramSDK.showMainButton(`MY CART · ${TelegramSDK.cart.count()}`);
    };
  });

  return html;
}