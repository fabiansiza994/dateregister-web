export interface ErrorDetail {
  codError: string;
  descError: string;
  msgError: string;
}

export interface LoginErrorResponse {
  dataResponse: {
    idTx: string | null;
    response: string;
  };
  error: ErrorDetail[];
}