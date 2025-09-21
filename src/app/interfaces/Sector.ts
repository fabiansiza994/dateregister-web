export interface Sector {
  id: number;
  nombre: string;
}

export interface SectorListOk {
  dataResponse: { idTx: string | null; response: string };
  data: Sector[];
  message: string;
}