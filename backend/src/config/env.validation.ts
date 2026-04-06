type Env = {
  PORT?: string;
  FRONTEND_URL?: string;
  JWT_SECRET?: string;
  SESSION_TTL_HOURS?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_HOMOLOG_URL?: string;
  SUPABASE_HOMOLOG_SERVICE_ROLE_KEY?: string;
};

export function validateEnv(config: Env): Env {
  const requiredKeys: Array<keyof Env> = [
    'JWT_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_HOMOLOG_URL',
    'SUPABASE_HOMOLOG_SERVICE_ROLE_KEY',
  ];

  for (const key of requiredKeys) {
    if (!config[key]) {
      throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}`);
    }
  }

  if (config.SESSION_TTL_HOURS) {
    const ttlHours = Number(config.SESSION_TTL_HOURS);
    if (!Number.isInteger(ttlHours) || ttlHours <= 0) {
      throw new Error('SESSION_TTL_HOURS deve ser um inteiro positivo.');
    }
  }

  return config;
}
