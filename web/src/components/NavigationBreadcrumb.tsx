import { useLayoutEffect, useRef, useState } from "react";
import { navigationTrail, type ActiveTabGroup } from "./navigationTrail";
import { Icon } from "./Icon";

/** Reads the actual mounted tabs, including conditional and stereo-linked EQ labels. */
export function NavigationBreadcrumb() {
  const ref = useRef<HTMLElement>(null);
  const [path, setPath] = useState<ActiveTabGroup[]>([]);
  useLayoutEffect(() => {
    const panel = ref.current?.closest(".editor-panel");
    if (!panel) return;
    const update = () => {
      const groups = Array.from(panel.querySelectorAll<HTMLElement>('[role="tablist"]'))
        .filter(group => !group.closest('[hidden], [aria-hidden="true"]'))
        .flatMap(group => {
          const active = group.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
          const name = group.getAttribute("aria-label");
          return active && name ? [{ name, selected: active.textContent?.trim() ?? "" }] : [];
        });
      const next = navigationTrail(groups);
      setPath(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(panel, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-selected", "hidden", "aria-hidden"] });
    return () => observer.disconnect();
  }, []);

  function showLevel(index: number) {
    const panel = ref.current?.closest(".editor-panel");
    // Ancestors have no separate overview page: return focus to their existing child tabs.
    const group = Array.from(panel?.querySelectorAll<HTMLElement>('[role="tablist"]') ?? [])
      .find(el => el.getAttribute("aria-label") === path[index + 1]?.name && !el.closest('[hidden], [aria-hidden="true"]'));
    const active = group?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    active?.focus({ preventScroll: true });
    group?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <nav ref={ref} className="navigation-breadcrumb" aria-label="Breadcrumb">
      <ol>
        {path.map((item, index) => (
          <li key={item.name}>
            {index > 0 ? <Icon name="chevronRight" size={13} /> : null}
            {index === path.length - 1 ? <span aria-current="page">{item.selected}</span> : (
              <button type="button" onClick={() => showLevel(index)} title={`Show ${item.selected} tabs`}>{item.selected}</button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
