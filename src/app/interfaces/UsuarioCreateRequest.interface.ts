export interface UsuarioCreateRequest {
  usuario: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  empresa: {
    nombre: string;
    nit: string;
    pais: { id: number | null };
    sector: { id: number | null };
  };
  grupo: {
    nombre: string;
  };
}