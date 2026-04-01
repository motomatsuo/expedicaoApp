'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ROUTES } from '@/shared/constants/routes';

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pageTitle = pathname.startsWith(ROUTES.bipagem) ? 'Bipagem' : 'Dashboard';

  return (
    <div className="min-h-screen bg-app p-3 md:p-4">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1600px] rounded-3xl border border-border-default bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.08)] md:min-h-[calc(100vh-2rem)] md:grid-cols-[272px_1fr] md:gap-3 md:p-3">
        <aside className="hidden flex-col rounded-2xl border border-border-default bg-white p-5 md:flex">
          <div className="mb-8 rounded-2xl bg-brand-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              Moto Matsuo
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-primary">Expedicao</h1>
            <p className="mt-1 text-xs text-secondary">Painel operacional</p>
          </div>

          <nav className="space-y-2">
            <Link
              href={ROUTES.dashboard}
              className={`focus-ring flex h-11 items-center rounded-xl px-3 text-sm font-medium transition-all ${
                pathname === ROUTES.dashboard
                  ? 'bg-brand-soft text-brand-primary'
                  : 'text-primary hover:bg-slate-50'
              }`}
            >
              Dashboard
            </Link>
          </nav>

          <div className="mt-auto rounded-2xl border border-border-default p-3">
            <p className="text-xs font-medium text-secondary">Conectado</p>
            <p className="mt-1 text-sm font-semibold text-primary">Portal Moto Matsuo</p>
          </div>
        </aside>

        {mobileMenuOpen ? (
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-30 w-72 transform border-r border-border-default bg-white p-4 transition-transform duration-200 md:hidden ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-8 rounded-2xl bg-brand-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              Moto Matsuo
            </p>
            <h1 className="mt-1 text-lg font-semibold text-primary">Expedicao</h1>
          </div>
          <nav className="space-y-2">
            <Link
              href={ROUTES.dashboard}
              onClick={() => setMobileMenuOpen(false)}
              className={`focus-ring flex h-11 items-center rounded-xl px-3 text-sm font-medium transition-all ${
                pathname === ROUTES.dashboard
                  ? 'bg-brand-soft text-brand-primary'
                  : 'text-primary hover:bg-slate-50'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href={ROUTES.bipagem}
              onClick={() => setMobileMenuOpen(false)}
              className={`focus-ring flex h-11 items-center rounded-xl px-3 text-sm font-medium transition-all ${
                pathname === ROUTES.bipagem
                  ? 'bg-brand-soft text-brand-primary'
                  : 'text-primary hover:bg-slate-50'
              }`}
            >
              Bipagem
            </Link>
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col md:min-h-full md:gap-3">
          <header className="sticky top-3 z-10 flex h-16 items-center justify-between rounded-2xl border border-border-default bg-white/90 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
                className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-white text-lg text-primary md:hidden"
              >
                ☰
              </button>
              <div>
                <p className="text-lg font-semibold tracking-tight text-primary">{pageTitle}</p>
                <p className="text-xs text-secondary">Moto Matsuo</p>
              </div>
            </div>
            <button
              type="button"
              className="focus-ring inline-flex h-10 items-center rounded-full border border-border-default bg-white px-4 text-sm font-medium text-primary transition hover:bg-slate-50"
            >
              Perfil
            </button>
          </header>

          <main className="flex-1 rounded-2xl bg-app p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
