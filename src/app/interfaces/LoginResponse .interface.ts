export interface LoginResponse {
  dataResponse: {
    idTx: string | null;
    response: string;
  };
  data: {
    token: string;
    username: string;
    role: string;
  };
  message: string;
}