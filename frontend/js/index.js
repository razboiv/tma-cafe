import TelegramSDK from "./telegram/telegram.js";
import { handleLocation, navigateTo } from "./routing/router.js";

window.navigateTo   = navigateTo;
window.handleLocation = handleLocation;

TelegramSDK.ready();
TelegramSDK.expand();
handleLocation();
