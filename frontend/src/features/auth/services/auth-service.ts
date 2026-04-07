import { ROUTES } from '@/shared/constants/routes';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/** Mesmo nome usado em `login-form` e checado em `src/middleware.ts`. */
const PORTAL_UI_SESSION = 'portal_ui_session';

type LoginInput = {
  email: string;
  password: string;
};

export async function login(input: LoginInput): Promise<void> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Falha ao autenticar.');
  }
}

export function clearPortalUiSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${PORTAL_UI_SESSION}=; path=/; max-age=0; samesite=lax`;
}

/**
 * Logout imediato na UI: remove o cookie que o middleware usa, tenta limpar `access_token` no servidor
 * (keepalive para sobreviver à navegação) e força ir para `/login`.
 */
export function logoutAndRedirectToLogin(): void {
  clearPortalUiSessionCookie();

  try {
    void fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    });
  } catch {
    /* ignore */
  }

  window.location.replace(ROUTES.login);
}
