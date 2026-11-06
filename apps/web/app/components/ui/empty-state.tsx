import type { ReactNode } from "react";
import { Icon, type IconName } from "./svg-icon";
import "./ui.css";
/**
 * Statik boş durum (role yok). Başlık seviyesi bulunduğu Section'a göre `level` ile.
 * contour: kontur illüstrasyonu (direction §3), ikonun arkasında dekoratif. Eylemler gerçek
 * sonraki adımlardır: birincil `action`, isteğe bağlı `secondaryAction`.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  contour = false,
  level = 2,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  contour?: boolean;
  level?: 2 | 3 | 4;
}) {
  const Heading = `h${level}` as "h2" | "h3" | "h4";
  return (
    <div className="ui-empty-state">
      {contour ? (
        <span className="ui-empty-state__art" aria-hidden="true">
          <Icon name="contour" size={96} className="ui-empty-state__contour" />
          {icon && <Icon name={icon} size={24} className="ui-empty-state__icon" />}
        </span>
      ) : (
        icon && <Icon name={icon} size={24} className="ui-empty-state__icon" />
      )}
      <Heading className="ui-empty-state__title">{title}</Heading>
      {description && <p className="ui-empty-state__description">{description}</p>}
      {(action || secondaryAction) && (
        <div className="ui-empty-state__action">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
