import { ErrorDetail } from "./ErrorDetail.interface";

export interface CreateErrorResponse {
  dataResponse: {
    idTx: string | null;
    response: string; // "UNAUTHORIZED", etc.
  };
  error: ErrorDetail[];
}