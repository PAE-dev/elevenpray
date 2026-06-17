"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  BookOpen,
  Calendar,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Heart,
  Home,
  Menu,
  MessageCircle,
  Moon,
  Sparkles,
  Sun,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarStreakCompact } from "../gamification/components/SidebarStreakCompact";
import { useTheme } from "@/app/providers/theme-provider";
import { MitsyyLogo } from "@/app/components/mitsyy-logo";
import { STUDY_PAGE_ENABLED } from "@/app/lib/feature-flags";

const NAV_ITEMS = [
  { href: "/app", key: "home", icon: Home, exact: true },
  { href: "/app/calendar", key: "calendar", icon: Calendar },
  { href: "/app/malla", key: "malla", icon: GraduationCap },
  { href: "/app/courses", key: "courses", icon: BookOpen },
  { href: "/app/tasks", key: "tasks", icon: ClipboardList },
  { href: "/app/whatsapp", key: "whatsapp", icon: MessageCircle },
  { href: "/app/wellbeing", key: "wellbeing", icon: Heart },
  { href: "/app/logros", key: "achievements", icon: Trophy },
  { href: "/app/study", key: "study", icon: Sparkles },
  { href: "/app/community", key: "community", icon: Users },
  { href: "/app/plan", key: "plan", icon: CreditCard },
] as const;

const VISIBLE_NAV_ITEMS = STUDY_PAGE_ENABLED
  ? NAV_ITEMS
  : NAV_ITEMS.filter((item) => item.href !== "/app/study");

interface StudentSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function StudentSidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}: StudentSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("studentNav");
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r-[0.5px] border-[var(--border)] bg-[var(--bg-surface)]",
        collapsed ? "w-[76px]" : "w-64",
        mobileOpen ? "flex" : "hidden lg:flex",
      )}
    >
      <div
        className={cn(
          "flex min-h-[4.5rem] items-center gap-2 px-3 py-4",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <Link
            href="/app"
            onClick={onCloseMobile}
            className="flex min-w-0 flex-1 items-center"
            aria-label="Mitsyy"
          >
            <MitsyyLogo size="lg" />
          </Link>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-[var(--radius-md)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] lg:flex"
            aria-label={collapsed ? t("expand") : t("collapse")}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-[var(--radius-md)] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] lg:hidden"
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2" aria-label={t("label")}>
        {VISIBLE_NAV_ITEMS.map((item) => {
          const { href, key, icon: Icon } = item;
          const exact = "exact" in item ? item.exact : false;
          const active = isActive(href, exact);

          return (
            <Link
              key={href}
              href={href}
              onClick={onCloseMobile}
              title={collapsed ? t(key) : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 transition-colors",
                active
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
                collapsed && "justify-center px-2",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 2} aria-hidden />
              {!collapsed && (
                <span className="text-sm font-medium">
                  {t(key)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <SidebarStreakCompact collapsed={collapsed} />

      <div className="border-t-[0.5px] border-[var(--border)] px-2 py-3">
        <button
          type="button"
          onClick={toggleTheme}
          title={collapsed ? t(isDark ? "themeLight" : "themeDark") : undefined}
          aria-label={t(isDark ? "themeLight" : "themeDark")}
          className={cn(
            "group flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
            collapsed && "justify-center px-2",
          )}
        >
          {isDark ? (
            <Sun className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <Moon className="h-5 w-5 shrink-0" aria-hidden />
          )}
          {!collapsed && (
            <span className="text-sm font-medium">
              {t(isDark ? "themeLight" : "themeDark")}
            </span>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="border-t-[0.5px] border-[var(--border)] px-3 py-4">
          <Link
            href="/app"
            onClick={onCloseMobile}
            className="flex items-center"
            aria-label="Mitsyy"
          >
            <MitsyyLogo size="sm" />
          </Link>
        </div>
      )}
    </aside>
  );
}
