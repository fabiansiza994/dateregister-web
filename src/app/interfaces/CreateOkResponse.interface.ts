export interface CreateOkResponse {
  dataResponse: {
    idTx: string | null;
    response: string; // "SUCCESS"
  };
  data: {
    id: number | null;
    usuario: string;
    nombre: string;
    apellido: string;
    password: string;
    email: string;
    grupo: {
      id: number | null;
      nombre: string;
      empresa: any;
      usuarios: any;
    };
    rol: {
      id: number;
      nombre: string;       // "ADMIN"
      descripcion: string;  // "administradores del sistema"
    };
    intentosFallidos: number;
    bloqueado: boolean;
  };
  message: string;
}