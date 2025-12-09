import { MainPage } from "../pages/main.js";
import { CategoryPage } from "../pages/category.js";
import { DetailsPage } from "../pages/details.js";
import { TelegramSDK } from "../telegram/telegram.js";
import { CartPage } from "../pages/cart.js";
import { Snackbar } from "../utils/snackbar.js";

/**
 * List of available routes (pages).
 */
const availableRoutes = [
    new MainPage(),
    new CategoryPage(),
    new DetailsPage(),
    new CartPage()
]

/**
 * Timeout after which Route.load(params) will be executed.
 * This is needed to better feeling of the navigation animation
 * and ability to run function 'cachePageContent' once user quickly goes to the next page
 * before current page content is loaded.
 */
const loadRouteContentTimeout = 200

/**
 * Page cache elements life time in MS.
 * The 'page cache' allows caching page HTML and then load it next time from the cache instead loading
 * from the server. You can configure it on Route level (in the Route child class).
 */
const cacheElementsLifeTime = 1000 * 60 * 60

/**
 * Store of the already loaded Pages' HTML to make the app faster and reduce the app server load.
 * The element of the cache is valid for cacheElementsLifeTime.
 * Items structure:
 *  key     'name' + Page.contentPath. 'name' is a required attribute.
 *  value   CachedPageElement.
 */
class CachedPageElement {
    #html
    #timeStored

    constructor(html, timeStored) {
        this.#html = html
        this.#timeStored = timeStored
    }

    cachedRecently(desireDeleteOlderThan) {
        return this.#timeStored >= desireDeleteOlderThan
    }

    /**
     * @returns HTML of the cached page.
     */
    html() { return this.#html }

    /**
     * @returns time when this cache element was added to the cache.
     */
    storedTime() { return this.#timeStored }
}

/**
 * Page cache store implementation.
 */
class PageContentCache {
    #store
    #orderedElements

    constructor() {
        this.#store = { }
        this.#orderedElements = []
    }

    /**
     *
     * @param {string} key
     * @returns CachedPageElement or null, if not found or obsolete.
     */
    get(key) {
        const now = Date.now();
        const value = this.#store[key]
        if (value != null) {
            if (value.cachedRecently(now - cacheElementsLifeTime)) {
                return value
            } else {
                delete this.#store[key]
                this.#orderedElements = this.#orderedElements.filter((e) => e != key)
            }
        }
        return null
    }

    put(key, html) {
        this.#store[key] = new CachedPageElement(html, Date.now())
        this.#orderedElements.splice(0, 0, key)
    }

    /**
     * Remove the old elements so that totally we keep 'elementsToStore' in the cache.
     * Note: The remaining elements would've the recent time.
     * @param {number} elementsToStore The desired size of the cache.
     */
    reduce(elementsToStore) {
        if (this.#orderedElements.length > elementsToStore) {
            const keysToRemove = this.#orderedElements.slice(elementsToStore)
            keysToRemove.forEach((key) => {
                delete this.#store[key]
            })
            this.#orderedElements = this.#orderedElements.slice(0, elementsToStore)
        }
    }
}

/**
 * The default amount of the elements we'd like to store in page cache.
 */
const DefaultCacheElementsToStore = 3

/**
 * Mhmm. This cache is duplicate of 'PageContentCache'. However in 'DesiredCacheState' it's used directly
 * as hash while in 'PageContentCache' it's wrapped with additional logic. So... just hide it in new function :)
 * @param {*} pageRoutes
 * @returns Map of [(route.contentPath, BaseRoute.cacheElementsToStore)]
 */
function createEmptyPageContentCacheState(pageRoutes) {
    return pageRoutes
        .filter((r) => r.cacheElementsToStore() > 0)
        .reduce((acc, r) => {
            acc[r.contentPath] = r.cacheElementsToStore()
            return acc
        }, {})
}

/**
 * We plan to cache pages for better UX and less app server load.
 * However, while using it, we don't want to load very old pages next time
 * as quite likely the actual content on the page has been changed.
 * This class stores information on the 'desired state' for page cache.
 */
class DesiredCacheState {
    #state

    constructor(pageRoutes) {
        this.#state = createEmptyPageContentCacheState(pageRoutes)
    }

    /**
     * After loading specific page, mark one as 'cached'. It means a user opened this page and
     * it's value in the 'desired state' might be reduced.
     * @param {string} pagePath Page path (e.g. '/pages/main.html')
     */
    markCached(pagePath) {
        const currentValue = this.#state[pagePath]
        if (currentValue != null) {
            this.#state[pagePath] = Math.max(0, currentValue - 1)
        }
    }

    /**
     * Finds route (page) which is **NOT** planned to be recently cached.
     * @returns Route.
     */
    findNonCachedRoute(pageRoutes) {
        return pageRoutes.find((route) => {
            const value = this.#state[route.contentPath]
            return value != null && value > 0
        })
    }
}

/**
 * Cache that hides page content values manipulations and allows to reduce page content
 * once we need to free memory.
 */
const pageContentCacheState = new DesiredCacheState(availableRoutes)
/**
 * Cached page content store.
 */
const pageCache = new PageContentCache()

/**
 * Cancel the executing page load request, preventing from changing HTML on the page
 * with HTML loaded for another page.
 */
function newPageContentLoadRequest() {
    let controller = null
    let canceled = false
    return [
        function load(pageContainerSelector, pagePath, afterLoad) {
            if (controller != null) {
                throw Error('The request already in progress. Probably cancelable function must be created.')
            }

            function loadAndCache(path) {
                controller = new AbortController()
                fetch(path, { signal: controller.signal })
                    .then((response) => response.text())
                    .then((html) => {
                        if (!canceled) {
                            pageCache.put(getCacheElementKey(path), html)
                            $(pageContainerSelector).html(html)
                            afterLoad()
                        }
                    })
            }

            const cached = pageCache.get(getCacheElementKey(pagePath))
            if (cached != null) {
                $(pageContainerSelector).html(cached.html())
                afterLoad()
            } else {
                loadAndCache(pagePath)
            }
        },
        function cancel() {
            canceled = true
            if (controller != null) {
                controller.abort()
            }
        }
    ]
}

/**
 * HTML loading request. The request supports cancelation via function call.
 */
let [loadPage, cancelLoadPage] = newPageContentLoadRequest();

/**
 * Pages, currently present on the page. The previous one (on the left), top and the next one (to the right).
 * 'Z-index' describes order how elements are overlayed on the page.
 */
const previousPageLeft = '-35%';
const nextPageLeftFrom = '100%';
const nextPageLeftTo = '0px';
const currentPageLeftFrom = '0px';
const currentPageLeftTo = '-35%';
const currentPageZIndex = '1';
const nextPageZIndex = '2';

/**
 * Pages cache name is a 'name' + Page.contentPath. We don't know 'name' on this level, however,
 * we know that it's required value - that's why we may use just Page.contentPath as a key.
 * @param {*} pagePath 
 * @returns Full name for cache key.
 */
function getCacheElementKey(pagePath) { return pagePath }

/**
 * Restore the state of the pages (containers).
 * The default state is acceptible for the situation when the app is just
 * opening.
 */
const pageContentCache = { }

/**
 * Currently selected route.
 * Instance of Route class' child, one of the availableRoutes.
 */
let currentRoute

/**
 * Currently executing route (page) content load request.
 * It resets (null) when page is loaded.
 */
let pageContentLoadRequest = null;

/**
 * Indicates that we have one more navigation request we get while
 * navigation animation was running. If true, when navigation animation finish,
 * there will be one more handleLocation() call.
 */
let pendingAnimations = false

/**
 * Indicates currently running navigation animation.
 */
let animationRunning = false

/**
 * Request for navigating to some destination.
 * @param {string} dest Desired destination (e.g. 'root').
 * @param {*} params Params for destination load method in JSON format.
 */
export function navigateTo(dest, params) {
    let url = '?dest=' + dest;
    if (params != null) {
        url += '&params=' + encodeURIComponent(params);
    }
    // Keep URL hash part since it may be filled by Telegram.
    // This is actual, for example, when running the app
    // from Inline Button.
    window.history.pushState({}, '', url + location.hash);
    handleLocation(false);
};

/**
 * Handle location defined in the current URL. The method performs:
 *  - Find desired route or fallback to default ('root').
 *  - Run navigation animation (slid-in/slide-out).
 *  - Load/prepare page in the background to be ready to show it when it comes to user's screen.
 *  - Set Back button.
 * @param {*} reverse Whether animate showing page from right-to-left.
 */
export function handleLocation(reverse = false) {
    const search = window.location.search;
    if (search == '') {
        navigateTo('root')
    } else {
        if (animationRunning) {
            pendingAnimations = true;
            return;
        }

        if (currentRoute != null) {
            currentRoute.onClose();
        }

        const searchParams = new URLSearchParams(search);
        const dest = searchParams.get('dest') || 'root';
        const encodedLoadParams = searchParams.get('params');
        if (encodedLoadParams != null) {
            var loadParams = decodeURIComponent(encodedLoadParams);
        }
        currentRoute = availableRoutes.find((route) => dest === route.dest);

        if (pageContentLoadRequest != null) {
            pageContentLoadRequest.abort();
        }

        if ($('#page-current').contents().length > 0) {
            pageContentLoadRequest = loadPage('#page-next', currentRoute.contentPath, () => { 
                pageContentLoadRequest = null;
                currentRoute.load(loadParams);
            });

            animate(true, reverse);
        } else {
            // In the case when app is just loaded, the '#page-next' is empty.
            // It makes sense just to load content, 'skip' animation and 'convert' id to '#page-current'.
            pageContentLoadRequest = loadPage('#page-current', currentRoute.contentPath, () => {
                pageContentLoadRequest = null;
                currentRoute.load(loadParams);
            });

            animate(false, false);
        }

        if (currentRoute.dest != 'root') {
            TelegramSDK.showBackButton(() => history.back());
        } else {
            TelegramSDK.hideBackButton();
        }
    }
};

/**
 * Load page content (HTML). The content may be load from the server or cache,
 * if previously was already loaded (see pageContentCache).
 * @param {string} pageContainerSelector Selector of the page container (e.g. #page-current).
 * @param {string} pagePath Path of the page content, typically defined in PageRoute.contentPath field (e.g. '/pages/main.html').
 * @param {*} onLoad Function called when content is loaded and attached to page DOM.
 * @returns {AbortController} Controller object allowing to cancel loading of HTML and prevent callbacks execution.
 */
function loadPage(pageContainerSelector, pagePath, onLoad) {
    const cached = pageContentCache[pagePath]
    if (cached != null) {
        $(pageContainerSelector).html(cached)
        // setTimeout(to give control to page to be able to cache '__NEXT__' page)
        setTimeout(() => onLoad(), loadRouteContentTimeout)
        return null
    } else {
        if (pageCache.get(getCacheElementKey(pagePath)) != null) {
            $(pageContainerSelector).html(pageCache.get(getCacheElementKey(pagePath)).html())
            setTimeout(() => onLoad(), loadRouteContentTimeout)
            return null
        } else {
            const [doLoad, cancel] = newPageContentLoadRequest()
            doLoad(pageContainerSelector, pagePath, () => onLoad())
            return cancel
        }
    }
}

/**
 * Animate navigation.
 * @param {*} running Whether the page content is already loaded on '#page-next'.
 * @param {*} reverse Whether animation should be running from right to left (back).
 */
function animate(running, reverse) {
    animationRunning = running;

    const currentPageLeftTo = reverse ? nextPageLeftFrom : previousPageLeft
    const nextPageLeftFrom = reverse ? previousPageLeft : nextPageLeftFrom

    $('#page-current')
        .css({
          transform: '',
            'z-index': currentPageZIndex
        })
        .transition({ x: currentPageLeftTo }, 325);

    $('#page-next')
        .css({
            display: '',
            transform: `translate(${nextPageLeftFrom})`,
            'z-index': nextPageZIndex
        })
        .transition({ x: '0px' }, 325, () => { 
            animationRunning = false;
            restorePagesInitialState();
            if (pendingAnimations) {
                pendingAnimations = false;
                handleLocation(reverse);
            }
        });
}

/**
 * Reset page containers values to default ones.
 * It should be run when navigation animation is finished.
 */
function restorePagesInitialState() {
    const currentPage = $('#page-current');
    const nextPage = $('#page-next');

    currentPage
        .attr('id', 'page-next')
        .css({
            display: 'none',
            transform: '',
            'z-index': '1'
        })
        .empty();

    nextPage
        .attr('id', 'page-current')
        .css({
            display: '',
            transform: '',
            'z-index': '2'
        });
}

/**
 * Show snackbar on top of the page content. It attaches to the top-level '#content' container,
 * so it's available and visible on any page.
 * @param {string} text Snackbar text.
 * @param {string} style The style of the Snackbar. It may be one of: 'success', 'warning', 'error'.
 *                          It also impacts on the Telegram's Haptic Feedback.
 */
export function showSnackbar(text, style) {
    const colorVariable = style == 'success' ? '--success-color'
        : style == 'warning' ? '--warning-color'
        : style == 'error' ? '--error-color'
        : '--accent-color';

    Snackbar.showSnackbar(
        'content',
        text,
        {
            backgroundColor: `var(${colorVariable})`,
            color: '#000000',
            duration: 1500,
            margins: { left: '16px', right: '16px', top: '12px' }
        }
    );

    const hapticStyle = style == 'success' ? 'soft' 
        : style == 'warning' ? 'medium'
        : 'error';
    TelegramSDK.notificationOccured(hapticStyle)
}

/**
 * Boot router on app start: load root route and subscribe on events.
 */
export function handleLocation() {
    // History API (browser's navigation).
    window.addEventListener('popstate', (event) => handleLocation(true));
    window.addEventListener('hashchange', (event) => handleLocation(true));

    // Load root route on app load.
    handleLocation(false);
}

// Debug.
// window.navigateTo = navigateTo;