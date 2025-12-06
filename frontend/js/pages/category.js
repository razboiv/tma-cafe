const root = document.getElementById('cafe-category');
const tpl  = document.getElementById('cafe-item-template');

// 1) Убираем скелеты
root.innerHTML = "";

// 2) Рисуем карточки
items.forEach(item => {
  const node = tpl.content.cloneNode(true);
  const card = node.querySelector('.cafe-item-container');
  card.dataset.id = item.id;

  node.querySelector('[data-role="image"]').src = item.photo;
  node.querySelector('[data-role="name"]').textContent = item.name;
  node.querySelector('[data-role="desc"]').textContent = item.description;

  root.appendChild(node);
});

// 3) Делегируем клики по карточкам
root.addEventListener('click', (e) => {
  const card = e.target.closest('.cafe-item-container');
  if (!card) return;
  navigateTo('details', { id: card.dataset.id }); // ваш роутер уже сериализует
});