interface ClientDeleteOk {
  dataResponse: { idTx: string | null; response: 'SUCCESS' | 'ERROR' };
  data?: { deletedId?: number; message?: string };
  message?: string;
}

interface ClientDeleteError {
  dataResponse?: { idTx?: string | null; response?: 'ERROR' | 'SUCCESS' };
  error?: Array<{ codError?: string; descError?: string; msgError?: string }>;
  message?: string;
}