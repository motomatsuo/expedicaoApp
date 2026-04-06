import { BipagemModule } from '@/features/dashboard/modules/bipagem/bipagem-module';

export default function DashboardPage() {
  return (
    <section className="mx-auto min-h-[62vh] max-w-7xl space-y-4 pb-2">
      <header className="overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-[#980F0F]/5 p-4 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.45)] sm:p-6">
        <p className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 ring-1 ring-gray-200">
          Dashboard
        </p>
        <h1 className="mt-2 text-xl font-semibold text-gray-900 sm:text-3xl">
          Expedição Moto Matsuo
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-[15px]">
          Painel de controle da expedição Moto Matsuo.
        </p>
      </header>
      <BipagemModule />
    </section>
  );
}
