// 撮影前のスクロール操作。popup は縦に長く 600px で切れるため、見せたい節を先頭へ寄せる。
// 実 Chrome のポップアップでも同じくスクロールして見る UI なので、画像側の加工ではない。
const scrollToSection = (selector) => async ({ page }) => {
  await page.evaluate((sel) => {
    const section = document.querySelector(sel)?.closest("section");
    if (!section) throw new Error(`節が見つかりません: ${sel}`);
    section.scrollIntoView({ block: "start" });
    window.scrollBy(0, -12);
  }, selector);
};

export default {
  "popup-data": scrollToSection("#remove-list"),
  // 共通設定 + 期間を同じ画面に収める
  "popup-period": scrollToSection("#common-settings"),
};
