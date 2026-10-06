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

  const viewer = document.createElement("dialog");
  viewer.className = "image-viewer";
  viewer.setAttribute("aria-label", "Enlarged guide screenshot");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close image";
  const picture = document.createElement("img");
  const caption = document.createElement("p");
  caption.id = "image-viewer-caption";
  viewer.setAttribute("aria-describedby", caption.id);
  viewer.append(close, picture, caption);
  document.body.append(viewer);
  let returnFocus;
  close.addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (event) => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener("close", () => { returnFocus?.focus(); });
  document.querySelectorAll(".guide-figure a").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      returnFocus = link;
      const source = link.querySelector("img");
      picture.src = source.src;
      picture.alt = source.alt;
      caption.textContent = link.closest("figure").querySelector("figcaption").firstChild.textContent;
      viewer.showModal();
    });
  });
})();

