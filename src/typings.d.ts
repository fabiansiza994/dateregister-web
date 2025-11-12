// Loose module declarations to satisfy TS about lazy-loaded pages
declare module '*.page' {
  export const ClienteCreatePage: any;
  export const ClienteEditPage: any;
  export const CategoriaCreatePage: any;
  export const CategoriaEditPage: any;
  const mod: any;
  export default mod;
}

declare module './clientes/cliente-create.page' {
  export const ClienteCreatePage: any;
  const mod: any;
  export default mod;
}

declare module './clientes/cliente-edit.page' {
  export const ClienteEditPage: any;
  const mod: any;
  export default mod;
}
