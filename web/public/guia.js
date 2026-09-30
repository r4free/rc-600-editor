(() => {
  const storageKey = "rc600.guideTheme";
  const themeButton = document.getElementById("theme");
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const isLight = theme === "light";
    themeButton.textContent = isLight ? "Dark mode" : "Light mode";
    themeButton.setAttribute("aria-pressed", String(isLight));
    themeButton.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
  }
  let initialTheme = "dark";
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark") initialTheme = stored;
  } catch { /* Keep the default when browser storage is unavailable. */ }
  applyTheme(initialTheme);
  themeButton.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(storageKey, next); } catch { /* The switch still works without storage. */ }
  });
  document.getElementById("print").addEventListener("click", () => window.print());
})();

