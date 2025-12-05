// минимальный и надёжный hash-роутер

const $cur  = document.getElementById('page-current');
const $next = document.getElementById('page-next');

function parseHash() {
  // "#/details?id=burger-1" -> { path:"details", params:{id:"burger-1"} }
  const raw = (location.hash || '#/').replace(/^#\//, '');
  const [path, query = ''] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return { path: path || '', params };
}

async function mount(html) {
  // рендерим во "временную" страницу и затем свапаем — не будет миганий/пустоты
  $next.innerHTML = html;
  $next.style.display = '';
  $cur.style.display = 'none';
  $cur.innerHTML = $next.innerHTML;
  $next.innerHTML = '';
  $next.style.display = 'none';
  $cur.style.display = '';
}

async function pageMain() {
  const { default: MainPage } = await import('../pages/main.js');
  const html = await MainPage();      // MainPage возвращает готовый HTML строки
  await mount(html);
}

async function pageCategory(params) {
  const { default: CategoryPage } = await import('../pages/category.js');
  const html = await CategoryPage(params);
  await mount(html);
}

async function pageDetails(params) {
  const { default: DetailsPage } = await import('../pages/details.js');
  const html = await DetailsPage(params);
  await mount(html);
}

async function pageCart() {
  const { default: CartPage } = await import('../pages/cart.js');
  const html = await CartPage();
  await mount(html);
}

const routes = {
  '': pageMain,
  'category': pageCategory,
  'details': pageDetails,
  'cart': pageCart,
};

export async function navigateTo(path, params = {}) {
  const q = new URLSearchParams(params).toString();
  const hash = `#/${path}${q ? `?${q}` : ''}`;
  if (location.hash === hash) {
    return handleLocation(); // уже тут — просто перерисуем
  }
  location.hash = hash;
}

export async function handleLocation() {
  try {
    const { path, params } = parseHash();
    (routes[path] || routes['']) (params);
  } catch (e) {
    console.error('[router] fail', e);
    await mount(`<div style="padding:16px">Unexpected error: ${e?.message || e}</div>`);
  }
}

window.addEventListener('hashchange', handleLocation);