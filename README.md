# Inventra

Proyecto base Angular (standalone) para sistema de inventario:
- Módulos: Productos, Categorías, Clientes, Ventas.
- Login simple con guard de rol (demo).
- Estilos heredados simplificados de dataregister (responsive básico + listas y cards).

## Ejecutar

```powershell
npm install
npm start
```

## Estructura
```
src/
  main.ts            # bootstrap con router y http
  index.html         # shell
  styles.css         # estilos base heredados
  app/
    root.component.ts
    routes.ts        # definición de rutas
    core/
      auth.service.ts
      role.guard.ts
    auth/
      login.component.ts
    layout/
      topbar.component.ts
    productos/
      productos.component.ts
    categorias/
      categorias.component.ts
    clientes/
      clientes.component.ts
    ventas/
      ventas.component.ts
```

## Próximos pasos sugeridos
- Integrar API real para CRUD.
- Añadir paginación server-side.
- Componentes de confirmación y notificaciones.
- Sistema de roles granular.
- Tests unitarios.
