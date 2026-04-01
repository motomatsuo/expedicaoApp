'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../services/auth-service';
import { ROUTES } from '@/shared/constants/routes';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
      document.cookie = 'portal_ui_session=1; path=/; max-age=900; samesite=lax';
      router.push(ROUTES.dashboard);
      router.refresh();
    } catch {
      setError('Nao foi possivel entrar. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-3xl border border-border-default bg-surface p-6 shadow-[0_8px_24px_rgba(15,23,42,0.08)] md:p-8"
    >
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Entrar</h1>
        <p className="mt-2 text-sm text-secondary">
          Acesse o portal da equipe de expedicao.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-primary">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="focus-ring h-11 w-full rounded-xl border border-border-default bg-white px-3 text-sm text-primary placeholder:text-slate-400"
            placeholder="seuemail@motomatsuo.com.br"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-primary">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="focus-ring h-11 w-full rounded-xl border border-border-default bg-white px-3 text-sm text-primary placeholder:text-slate-400"
            placeholder="Digite sua senha"
            required
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="focus-ring mt-6 h-11 w-full rounded-xl bg-brand-primary text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
