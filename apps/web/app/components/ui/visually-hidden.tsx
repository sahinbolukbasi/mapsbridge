import type { ElementType, ReactNode } from "react";

/** Görsel olarak gizli, ekran okuyucuya açık metin (.ui-visually-hidden base.css'te). */
export function VisuallyHidden({
  as: Tag = "span",
  focusable = false,
  id,
  children,
}: {
  as?: ElementType;
  focusable?: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      id={id}
      className={
        focusable ? "ui-visually-hidden ui-visually-hidden--focusable" : "ui-visually-hidden"
      }
    >
      {children}
    </Tag>
  );
}
