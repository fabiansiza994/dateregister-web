export interface Pais {
  id: number;
  nombre: string;
  codigoPais: string;
}

export interface PaisListOk {
  dataResponse: { idTx: string | null; response: string };
  data: Pais[];
  message: string;
}