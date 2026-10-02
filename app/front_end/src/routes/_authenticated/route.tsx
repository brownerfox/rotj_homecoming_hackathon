import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Home, LogOut } from "lucide-react";
import { tokenStore } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { USE_MOCKS } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    if (!tokenStore.get()) throw redirect({ to: "/auth" });
  },
  component: AppShell,
});

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/jobs/new", label: "New job", icon: ClipboardList },
] as const;

function AppShell() {
  const { user, loading, signOut } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <BrandLogo to="/" inverted imgClassName="h-9" />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link key={to} to={to}
                className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60")}>
                <Icon className={cn("h-4 w-4", active && "text-sidebar-primary")} />
                {label}
              </Link>
            );
          })}
        </nav>
        {USE_MOCKS && (
          <div className="m-3 rounded-md border border-sidebar-border p-3 text-xs text-sidebar-foreground/80">
            Demo mode: sample data, not connected to the server.
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-3 text-sm">
            <BrandLogo to="/" className="md:hidden" imgClassName="h-7" />
            <span className="text-muted-foreground">Company</span>
            <span className="font-medium">{user?.company_name ?? (loading ? "..." : "")}</span>
          </div>
          <nav className="flex gap-3 text-sm md:hidden">
            {NAV.map(({ to, label }) => <Link key={to} to={to} className="text-muted-foreground">{label}</Link>)}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 rounded-md px-2 py-1 text-sm hover:bg-muted">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {(user?.name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block font-medium leading-tight">{user?.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {user?.role === "hiring_manager" ? "Hiring Manager" : user?.role === "recruiter" ? "Recruiter" : ""}
                </span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="font-medium">{user?.name}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8"><Outlet /></main>
      </div>
    </div>
  );
}
