"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./site-footer.css";
import { useLocale, localeRootPath } from "../lib/locale-context";
import { footerRoutes, routeLabel, type FooterGroup } from "../lib/route-registry";
import { switchLocale } from "../lib/navigation/switch-locale";
import { Icon } from "./ui";

/** Sütun başlıkları (i18n footer.*); bağlantılar yalnızca registry `footer` alanından (F29, R5). */
const GROUPS: readonly { group: FooterGroup; titleKey: string }[] = [
  { group: "product", titleKey: "footer.product" },
  { group: "resources", titleKey: "footer.resources" },
  { group: "legal", titleKey: "footer.legal" },
];

export function SiteFooter() {
  const pathname = usePathname() ?? "/";
  const { t, locale, isEnglish } = useLocale();
  // Ayrı bir tercih diyaloğu yok: "Çerez tercihleri" bugünkü gibi çerez politikası sayfasına gider.
  const cookiePolicy = footerRoutes("legal").find((r) => r.path === "/cookies/");

  return (
    <footer className="global-site-footer" data-surface="inverse">
      <div className="global-footer-inner">
        <div className="global-footer-brand">
          <Link href={localeRootPath(locale)} className="global-footer-brand-link" prefetch={false}>
            <span className="global-footer-brand-mark" aria-hidden="true">
              <Icon name="compass" size={20} />
            </span>
            <span className="global-footer-brand-name">MapsBridge</span>
          </Link>
          <p className="global-footer-tagline">{t("footer.tagline")}</p>
        </div>

        <nav className="global-footer-groups" aria-label={t("ui.footerLinks")}>
          {GROUPS.map(({ group, titleKey }) => {
            const titleId = `global-footer-${group}`;
            return (
              <div key={group} className="global-footer-group">
                <span className="global-footer-group-title" id={titleId}>
                  {t(titleKey)}
                </span>
                <ul className="global-footer-links" aria-labelledby={titleId}>
                  {footerRoutes(group).map((route) => (
                    <li key={route.path}>
                      <Link href={route.path} className="global-footer-link" prefetch={false}>
                        {routeLabel(route, locale)}
                      </Link>
                    </li>
                  ))}
                  {group === "legal" && cookiePolicy && (
                    <li>
                      <Link
                        href={cookiePolicy.path}
                        className="global-footer-link"
                        prefetch={false}
                      >
                        {t("footer.cookiePrefs")}
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="global-footer-bottom">
        <p className="global-footer-copyright">{t("footer.copyright")}</p>
        <button
          type="button"
          className="global-footer-locale"
          lang={isEnglish ? "tr" : "en"}
          onClick={() => switchLocale(pathname, isEnglish)}
        >
          <Icon name="globe" size={16} />
          {isEnglish ? "Türkçe" : "English"}
        </button>
      </div>
    </footer>
  );
}
