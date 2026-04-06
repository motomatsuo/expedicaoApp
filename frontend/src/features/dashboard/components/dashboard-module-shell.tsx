import { ReactNode } from 'react';

type DashboardModuleShellProps = {
  moduleTitle: string;
  moduleDescription: string;
  headerRight?: ReactNode;
  children: ReactNode;
};

export function DashboardModuleShell({
  moduleTitle,
  moduleDescription,
  headerRight,
  children,
}: DashboardModuleShellProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-gray-50/70 p-4 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.45)] sm:p-6">
      <header className="mb-5 border-b border-gray-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex rounded-full bg-[#980F0F]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#980F0F]">
              Modulo
            </div>
            <h2 className="mt-2 text-xl font-semibold text-gray-900 sm:text-2xl">{moduleTitle}</h2>
            <p className="mt-1 text-sm text-gray-600">{moduleDescription}</p>
          </div>
          {headerRight ? <div className="sm:pt-0.5">{headerRight}</div> : null}
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}
