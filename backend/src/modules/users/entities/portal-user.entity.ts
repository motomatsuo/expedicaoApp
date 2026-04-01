export type PortalUser = {
  id: number;
  email_vend: string | null;
  senha_vend: string | null;
  funcao: string | null;
  nome: string | null;
  status: string | null;
  foto_perfil: string | null;
  online: boolean | null;
  grupo: string[] | null;
  id_hubla: string | null;
  id_protheus: string | null;
  disponivel: string;
};

export type PublicPortalUser = Omit<PortalUser, 'senha_vend'>;

export function toPublicPortalUser(user: PortalUser): PublicPortalUser {
  const sanitized = { ...user };
  delete (sanitized as { senha_vend?: string | null }).senha_vend;
  return sanitized;
}
