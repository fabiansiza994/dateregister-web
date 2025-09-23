interface Paciente {
  id: number;
  nombre: string;
  apellido?: string | null;
  documento?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  estado?: 'ACTIVO' | 'INACTIVO' | string;
}

interface PacientePage {
  size: number;
  last: boolean;
  totalPages: number;
  page: number;
  sort: string;
  items: Paciente[];
  totalElements: number;
  query?: string;
}

interface PacienteSearchOk {
  dataResponse: { idTx: string | null; response: 'SUCCESS' | 'ERROR' };
  data: PacientePage;
  message?: string;
}

interface PacienteDeleteError {
  contextTransaction?: { idTx?: string; codStateTx?: 'PF' | 'PS'; dateTx?: string };
  error?: Array<{ codError?: string; descError?: string; msgError?: string }>;
  message?: string;
}

interface PacienteDeleteOk {
  dataResponse?: { idTx?: string | null; response?: 'SUCCESS' | 'ERROR' };
  data?: { deletedId?: number; message?: string };
  message?: string;
}