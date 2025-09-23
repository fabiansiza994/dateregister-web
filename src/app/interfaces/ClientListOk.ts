interface ClientListOk {
  dataResponse: { idTx: string | null; response: string };
  data: {
    size: number;
    last: boolean;
    totalPages: number;
    page: number;          // 0-based
    sort: string;          // ej: "nombre: ASC"
    items: Cliente[];
    totalElements: number;
  };
  message: string;
}