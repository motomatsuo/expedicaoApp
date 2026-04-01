import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-app p-4 md:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="hidden rounded-3xl border border-red-100 bg-gradient-to-br from-brand-soft via-white to-white p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-primary">
              Moto Matsuo
            </p>
            <h2 className="mt-4 max-w-md text-4xl font-semibold tracking-tight text-primary">
              Portal de Expedicao com foco total em produtividade.
            </h2>
            <p className="mt-4 max-w-md text-base text-secondary">
              Acompanhe sua operacao com um layout moderno, rapido e preparado para uso em
              desktop e mobile.
            </p>
          </div>
          <div className="card-surface rounded-3xl p-6">
            <p className="text-sm font-medium text-secondary">Pronto para iniciar</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-primary">
              Login seguro com Supabase
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-md">
            <p className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.16em] text-brand-primary lg:hidden">
              Moto Matsuo
            </p>
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
