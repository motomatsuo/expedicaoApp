import Link from 'next/link';
import { ROUTES } from '@/shared/constants/routes';

export function Sidebar() {
  return (
    <aside className="hidden w-64 flex-col border-r border-border-default bg-surface p-4 md:flex">
      <div className="mb-8 px-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Moto Matsuo</p>
        <h1 className="text-lg font-semibold text-primary">Expedicao</h1>
      </div>

      <nav className="space-y-2">
        <Link
          href={ROUTES.dashboard}
          className="focus-ring flex h-11 items-center rounded-md bg-brand-primary px-3 text-sm font-medium text-white"
          aria-current="page"
        >
          Dashboard
        </Link>
      </nav>
    </aside>
  );
}
