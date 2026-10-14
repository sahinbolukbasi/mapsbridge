"use client";

import { useEffect } from "react";

// Existing modal cards share keyboard behavior without rewriting their content.
export function DialogFocus() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let previous: HTMLElement | null = null;
    let oldOverflow = "";
    let knownCards = new Set<HTMLElement>();
    const disabledBackground = new Map<HTMLElement, boolean>();
    const restoreBackground = () => { disabledBackground.forEach((wasInert, element) => { element.inert = wasInert; }); disabledBackground.clear(); };
    const closeSelector = '.modal-close, .close-btn, .modal-close-btn, .public-modal-close, .auth-modal-close-btn';
    const focusable = (node: HTMLElement) => Array.from(node.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]'
    )).filter(element => element.getClientRects().length > 0 && !element.closest("[inert]"));
    const sync = () => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.dialog-overlay > .dialog-card, .modal-backdrop > .lookup-card, .share-modal-overlay > .share-modal, .modal-overlay > .modal-card-dialog, .public-modal-overlay > .public-modal-card, .auth-modal-overlay > .auth-modal-card'))
        .filter(element => element.getClientRects().length > 0);
      const next = cards.filter(card => !knownCards.has(card)).at(-1) || (active && cards.includes(active) ? active : cards.at(-1)) || null;
      knownCards = new Set(cards);
      if (next === active) return;
      restoreBackground();
      if (next) cards.filter(card => card !== next).forEach(card => card.querySelector<HTMLButtonElement>(closeSelector)?.click());
      if (!active && next) {
        previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        oldOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      }
      active = next;
      if (next) {
        next.setAttribute("role", "dialog");
        next.setAttribute("aria-modal", "true");
        if (!next.hasAttribute("aria-label") && !next.hasAttribute("aria-labelledby")) {
          next.setAttribute("aria-label", next.querySelector("h2,h3")?.textContent || "İşlem penceresi");
        }
        let branch: HTMLElement = next;
        while (branch.parentElement) {
          const parent = branch.parentElement;
          Array.from(parent.children).forEach(sibling => {
            if (sibling !== branch && sibling instanceof HTMLElement && !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) {
              disabledBackground.set(sibling, sibling.inert);
              sibling.inert = true;
            }
          });
          if (parent === document.body) break;
          branch = parent;
        }
        next.tabIndex = -1;
        if (!next.contains(document.activeElement)) (focusable(next)[0] || next).focus();
      } else {
        document.body.style.overflow = oldOverflow;
        if (previous?.isConnected) previous.focus();
        previous = null;
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (!active) return;
      if (event.key === "Escape") {
        const close = active.querySelector<HTMLButtonElement>(closeSelector);
        if (close && !close.disabled) { event.preventDefault(); event.stopPropagation(); close.click(); }
      }
      if (event.key === "Tab") {
        const items = focusable(active);
        const first = items[0] || active;
        const last = items.at(-1) || active;
        if (!active.contains(document.activeElement) || document.activeElement === active || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", keydown);
    sync();
    return () => {
      observer.disconnect(); document.removeEventListener("keydown", keydown);
      restoreBackground();
      if (active) document.body.style.overflow = oldOverflow;
    };
  }, []);
  return null;
}
