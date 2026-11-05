import type { ReactNode } from "react";
import { Icon, type IconName } from "./svg-icon";
import "./ui.css";

/** Statik boş durum (role yok). Başlık seviyesi bulunduğu Section'a göre `level` ile. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  level = 2,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  level?: 2 | 3 | 4;
}) {
  const Heading = `h${level}` as "h2" | "h3" | "h4";
  return (
    <div className="ui-empty-state">
      {icon && <Icon name={icon} size={24} className="ui-empty-state__icon" />}
      <Heading className="ui-empty-state__title">{title}</Heading>
      {description && <p className="ui-empty-state__description">{description}</p>}
      {action && <div className="ui-empty-state__action">{action}</div>}
    </div>
  );
}
