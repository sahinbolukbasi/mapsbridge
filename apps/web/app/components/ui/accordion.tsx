import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./svg-icon";
import "./ui.css";
export type AccordionItem = { id: string; summary: ReactNode; content: ReactNode };
/**
 * SSS / açılır bölümler (design §4.2): yerel <details>/<summary>, JS gerektirmez ve yerel
 * erişilebilirlik taşır. İkon dönüşü hareket tercihinde geçişlidir.
 */
export function Accordion({ items, className }: { items: AccordionItem[]; className?: string }) {
  return (
    <div className={cx("ui-accordion", className)}>
      {items.map((item) => (
        <details key={item.id} id={item.id} className="ui-accordion__item">
          <summary className="ui-accordion__summary">
            <span className="ui-accordion__title">{item.summary}</span>
            <Icon name="chevron" className="ui-accordion__icon" />
          </summary>
          <div className="ui-accordion__content">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
