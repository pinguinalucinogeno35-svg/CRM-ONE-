import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { NavLink } from "./nav-link";
import { IconAccount, IconClients, IconPanel, IconSignOut, LogoMark } from "./icons";

export async function Sidebar() {
  const ctx = await requireUser();
  const scope = ctx.isAdmin ? "Equipe ONE" : (ctx.organization?.name ?? "Sem cliente ativo");

  return (
    <aside className="flex shrink-0 flex-col gap-6 border-b border-line bg-surface p-4 md:min-h-dvh md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2.5 px-1">
        <LogoMark width={24} height={24} />
        <span className="font-semibold tracking-tight">CRM ONE</span>
      </div>

      <nav aria-label="Principal" className="flex gap-1 md:flex-col">
        {ctx.isAdmin ? (
          <NavLink href="/admin">
            <IconClients /> Clientes
          </NavLink>
        ) : (
          <NavLink href="/painel">
            <IconPanel /> Painel
          </NavLink>
        )}
        <NavLink href="/conta">
          <IconAccount /> Conta
        </NavLink>
      </nav>

      <div className="mt-auto hidden border-t border-line pt-4 md:block">
        <p className="truncate px-1 text-sm font-medium">{ctx.fullName || ctx.email}</p>
        <p className="truncate px-1 text-xs text-muted">{scope}</p>
        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-line/60 hover:text-ink"
          >
            <IconSignOut /> Sair
          </button>
        </form>
      </div>
      <form action={signOut} className="md:hidden">
        <button type="submit" className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-muted">
          <IconSignOut /> Sair
        </button>
      </form>
    </aside>
  );
}

export function SidebarSkeleton() {
  return (
    <aside className="shrink-0 border-b border-line bg-surface p-4 md:min-h-dvh md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2.5 px-1">
        <LogoMark width={24} height={24} />
        <span className="font-semibold tracking-tight">CRM ONE</span>
      </div>
    </aside>
  );
}
