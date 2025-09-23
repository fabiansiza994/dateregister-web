export interface ClientCreateRequest {
    nombre: string;
    apellido?: string;
    email?: string;
    direccion?: string;
    telefono?: string;
    identificacion?: string;
    empresa: { id: number };
    usuario: { id: number };
    pacientes: any[]; // ajusta si luego defines un tipo
}

export interface ClientCreateOk {
    dataResponse: { idTx: string | null; response: 'SUCCESS' | 'ERROR' };
    data: {
        id: number;
        nombre: string;
        apellido?: string;
        email?: string;
        direccion?: string;
        telefono?: string;
        identificacion?: string;
        estado: 'ACTIVO' | 'INACTIVO';
        pacientes: any[];
    };
    message: string;
}

export interface ClientCreateError {
    dataResponse: { idTx: string | null; response: 'ERROR' | 'SUCCESS' };
    error?: Array<{
        codError?: string;     // p.e. E400
        descError?: string;    // p.e. "el nombre es requerido"
        msgError?: string;     // p.e. "nombre" (campo)
    }>;
    message?: string;
}
