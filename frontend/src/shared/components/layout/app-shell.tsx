'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { logout } from '@/features/auth/services/auth-service';
import { GlobalHeaderBipagemSearch } from '@/shared/components/layout/global-header-bipagem-search';
import { ROUTES } from '@/shared/constants/routes';

type AppShellProps = {
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  title: string;
  icon: 'dashboard' | 'bipagem' | 'listaBipagem' | 'acompanhamentoRte';
};

const NAV_ITEMS: NavItem[] = [
  { href: ROUTES.dashboard, label: 'Dashboard', title: 'Dashboard', icon: 'dashboard' },
  { href: ROUTES.bipagem, label: 'Bipagem', title: 'Bipagem', icon: 'bipagem' },
  {
    href: ROUTES.listaBipagem,
    label: 'Lista bipagem',
    title: 'Lista bipagem',
    icon: 'listaBipagem',
  },
  {
    href: ROUTES.acompanhamentoRte,
    label: 'Acomp. RTE',
    title: 'Acompanhamento RTE',
    icon: 'acompanhamentoRte',
  },
];

function NavIcon({ name }: { name: NavItem['icon'] }) {
  const cls = 'h-6 w-6 shrink-0';
  if (name === 'acompanhamentoRte') {
    return (
      <svg
        className={cls}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    );
  }
  if (name === 'listaBipagem') {
    return (
      <svg
        className={cls}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    );
  }
  if (name === 'dashboard') {
    return (
      <svg
        className={cls}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 3v18h18" />
        <rect x="6" y="12" width="3" height="6" />
        <rect x="11" y="9" width="3" height="9" />
        <rect x="16" y="6" width="3" height="12" />
      </svg>
    );
  }
  return (
    <svg
      className={cls}
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      className="h-7 w-7 shrink-0"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97L2.46 14.6c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.31.61.22l2.49-1c.52.39 1.06.73 1.69.98l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.25 1.17-.59 1.69-.98l2.49 1c.22.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z" />
    </svg>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const [userName, setUserName] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle = pathname.startsWith(ROUTES.listaBipagem)
    ? 'Lista bipagem'
    : pathname.startsWith(ROUTES.bipagem)
      ? 'Bipagem'
      : pathname.startsWith(ROUTES.acompanhamentoRte)
        ? 'Acomp. RTE'
        : pathname.startsWith(ROUTES.dashboard)
          ? 'Dashboard'
          : 'Expedição';

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { user?: { nome?: string | null } };
        if (data.user?.nome) {
          setUserName(data.user.nome);
        }
      } catch {
        /* silencioso */
      }
    }
    void loadUser();
  }, [apiUrl]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.push(ROUTES.login);
  }, [router]);

  const isBipagemFullscreen = pathname.startsWith(ROUTES.bipagem);
  const hideGlobalSearch = pathname.startsWith(ROUTES.acompanhamentoRte);

  const asideClass = [
    'sidebar',
    'sidebar--collapsed',
    mobileMenuOpen ? 'sidebar--mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fa] transition-colors duration-300">
      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <aside className={asideClass} aria-label="Navegação principal">
        <header className="sidebar-header">
          <Link
            href={ROUTES.dashboard}
            className="sidebar-logo-button"
            title="Ir para o Dashboard"
            aria-label="Ir para o Dashboard"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img
              src="/img/icon-matsuo.svg"
              alt="Logo Matsuo"
              width={36}
              height={36}
              className="sidebar-logo sidebar-logo--collapsed"
            />
          </Link>
        </header>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.title}
                aria-label={item.title}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={[
                  'sidebar-menu-item',
                  active ? 'sidebar-menu-item--active' : '',
                ].join(' ')}
              >
                <div
                  className={[
                    'sidebar-menu-item-icon',
                    active ? 'sidebar-menu-item-icon--active' : '',
                  ].join(' ')}
                >
                  <NavIcon name={item.icon} />
                </div>
                <div className="sidebar-menu-item-text-wrapper sidebar-menu-item-text-wrapper--clip">
                  <span className="sidebar-menu-item-text">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <footer className="sidebar-footer">
          <button
            type="button"
            className="sidebar-menu-item cursor-not-allowed opacity-50"
            title="Configurações"
            aria-label="Configurações"
            disabled
          >
            <div className="sidebar-menu-item-icon">
              <SettingsIcon />
            </div>
            <div className="sidebar-menu-item-text-wrapper sidebar-menu-item-text-wrapper--clip">
              <span className="sidebar-menu-item-text">Configurações</span>
            </div>
          </button>
        </footer>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!isBipagemFullscreen ? (
          <header
            className={`relative z-10 grid min-w-0 items-center gap-4 border-b border-gray-200 bg-white px-4 py-4 sm:px-6 ${hideGlobalSearch ? 'grid-cols-[1fr_auto]' : 'grid-cols-[1fr_auto_1fr]'}`}
          >
            <div className="flex min-w-0 items-center space-x-2 sm:space-x-4">
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700 transition-colors hover:bg-gray-100 md:hidden"
                aria-label="Abrir menu"
                onClick={() => setMobileMenuOpen(true)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              </button>
              <h1 className="hidden truncate text-lg font-bold text-gray-900 sm:block sm:text-2xl">
                {pageTitle}
              </h1>
              <span className="hidden text-sm text-gray-500 sm:inline">|</span>
              <span className="hidden truncate text-sm text-gray-600 sm:inline sm:text-base">
                {userName ? `Bem-vindo, ${userName}` : 'Bem-vindo'}
              </span>
            </div>

            {!hideGlobalSearch ? (
              <div className="relative mx-auto flex min-w-0 w-[min(42vw,13rem)] justify-center sm:w-full sm:max-w-2xl">
                <GlobalHeaderBipagemSearch />
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="whitespace-nowrap rounded-lg bg-red-600 px-2 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-red-700 sm:px-4 sm:py-2 sm:text-sm"
              >
                Sair
              </button>
            </div>
          </header>
        ) : (
          <button
            type="button"
            className="fixed left-3 top-3 z-[60] inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-black/50 text-white shadow-md backdrop-blur-sm md:hidden"
            aria-label="Abrir menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <main
          className={`min-h-0 flex-1 ${isBipagemFullscreen ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}
        >
          <div
            className={`flex min-h-0 flex-1 flex-col bg-gray-50 ${isBipagemFullscreen ? 'overflow-hidden' : 'min-h-full'}`}
          >
            <div
              id="main-content"
              className={`outline-none ${isBipagemFullscreen ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-h-0 flex-1 overflow-y-auto'}`}
              tabIndex={-1}
            >
              <div
                className={
                  isBipagemFullscreen
                    ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                    : 'h-full w-full p-6 md:p-8'
                }
              >
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
