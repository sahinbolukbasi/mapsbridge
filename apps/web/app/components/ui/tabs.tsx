"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { firstEnabledIndex, nextTabIndex } from "./logic/tabs-keyboard";
import { useUrlParam } from "./use-url-param";
import "./ui.css";

export type TabItem = {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
  panel: ReactNode;
  disabled?: boolean;
};

type TabsProps = {
  items: TabItem[];
  label: string;
  value?: string;
  onChange?: (id: string) => void;
  activation?: "automatic" | "manual";
  className?: string;
};

function TabsView({
  items,
  label,
  selected,
  select,
  activation = "automatic",
  className,
}: Omit<TabsProps, "value" | "onChange"> & { selected: string; select: (id: string) => void }) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const disabled = items.map((i) => Boolean(i.disabled));
  const selectedIndex = Math.max(
    0,
    items.findIndex((i) => i.id === selected),
  );
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const tabStop = focusIndex ?? selectedIndex;

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (activation === "manual" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      select(items[index].id);
      return;
    }
    const next = nextTabIndex(index, e.key, disabled);
    if (next === null) return;
    e.preventDefault();
    setFocusIndex(next);
    refs.current[next]?.focus();
    if (activation === "automatic") select(items[next].id);
  }

  return (
    <div className={cx("ui-tabs", className)}>
      <div className="ui-tabs__list" role="tablist" aria-label={label} data-surface="default">
        {items.map((item, k) => (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[k] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${item.id}`}
            className="ui-tabs__tab"
            aria-selected={k === selectedIndex}
            aria-controls={`${base}-panel-${item.id}`}
            aria-disabled={item.disabled || undefined}
            tabIndex={k === tabStop ? 0 : -1}
            onClick={() => {
              if (item.disabled) return;
              setFocusIndex(k);
              select(item.id);
            }}
            onKeyDown={(e) => onKeyDown(e, k)}
          >
            {item.label}
            {item.badge}
          </button>
        ))}
      </div>
      {items.map((item, k) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          tabIndex={0}
          hidden={k !== selectedIndex}
          className="ui-tabs__panel"
        >
          {k === selectedIndex && item.panel}
        </div>
      ))}
    </div>
  );
}

function UrlTabs(props: TabsProps & { urlParam: string }) {
  const ids = props.items.map((i) => i.id);
  const fallback = props.items[firstEnabledIndex(props.items.map((i) => Boolean(i.disabled)))]?.id;
  const [value, setValue] = useUrlParam(props.urlParam, {
    allowed: ids,
    fallback: fallback ?? ids[0] ?? "",
    history: "replace",
  });
  return (
    <TabsView
      {...props}
      selected={value}
      select={(id) => {
        setValue(id);
        props.onChange?.(id);
      }}
    />
  );
}

function StateTabs(props: TabsProps) {
  const fallback =
    props.items[firstEnabledIndex(props.items.map((i) => Boolean(i.disabled)))]?.id ?? "";
  const [inner, setInner] = useState(fallback);
  const selected = props.value ?? inner;
  return (
    <TabsView
      {...props}
      selected={selected}
      select={(id) => {
        if (props.value === undefined) setInner(id);
        props.onChange?.(id);
      }}
    />
  );
}

/**
 * role=tablist/tab/tabpanel, roving tabindex, ok tuşları/Home/End (logic/tabs-keyboard.ts).
 * urlParam → useUrlParam (useSearchParams yok; prerender'da ilk etkin sekme).
 */
export function Tabs(props: TabsProps & { urlParam?: string }) {
  return props.urlParam ? (
    <UrlTabs {...props} urlParam={props.urlParam} />
  ) : (
    <StateTabs {...props} />
  );
}
