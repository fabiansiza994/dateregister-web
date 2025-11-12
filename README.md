# Inventra

Proyecto Angular 17 (standalone) para un sistema de inventario.

Características principales:
- Módulos: Productos, Categorías, Clientes, Ventas.
- Login de demostración con guard de rol.
- Soporte de imágenes en Productos (carga, vista previa, miniatura en listado).
- Campo de icono en Categorías con selector de Bootstrap Icons y vista en el listado.
- UX refinada: ítems de categorías clicables para editar, botón flotante para crear, y en vistas de edición se usa botón “Cancelar” (se eliminó el “Volver” superior que se solapaba con el badge de usuario).

## Requisitos
- Node.js LTS reciente
- Angular CLI 17

## Instalación y ejecución

```powershell
# Instalar dependencias
npm install

# Ejecutar (abre en http://localhost:4200 por defecto)
npm start

# Si el puerto 4200 está ocupado, ejecutar en otro puerto
npx ng serve --port 4300
```

## Construcción

```powershell
npm run build
```

La salida se genera en `dist/inventra`.

## Estilos y UI

- Tailwind CSS: configurado con `tailwind.config.js` y `postcss.config.js`.
  - Directivas en `src/styles.css`: `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`.
  - Si tu editor muestra “Unknown at rule @tailwind”, instala la extensión “Tailwind CSS IntelliSense” o ignora el warning (la compilación funciona vía PostCSS).
- Bootstrap Icons: disponible vía import en `src/styles.css` y paquete `bootstrap-icons`.
  - Para usar un icono en plantilla: `<i class="bi bi-tv"></i>`.
- Estilos base: tarjetas, badges, inputs y utilidades ligeras en `src/styles.css`.

## Productos: imágenes

- El formulario de producto admite carga de imagen por input y drag & drop.
- Se muestra vista previa; en el listado aparece una miniatura.
- En el payload al servicio, la imagen se envía como base64 sin prefijo `data:` (el preview usa `data:image/*;base64,` cuando hace falta).

## Categorías: iconos

- Campo `icon` en DTO de Categoría.
- Páginas de crear/editar incluyen un grid de Bootstrap Icons para seleccionar (o escribir una clase personalizada, p.ej. `bi bi-box`).
- El listado de categorías muestra el icono; si el valor no es una clase de Bootstrap Icons, se renderiza como texto.
- Acciones UX:
  - Ítem de la lista completo es clicable y navega a editar.
  - Botón flotante en la esquina inferior derecha para crear nueva categoría.
  - En editar se muestra “Cancelar” (el botón superior “Volver” fue removido para evitar solaparse con el badge del usuario).

## Rutas relevantes

- Productos: `/productos`, `/productos/nuevo`, `/productos/:id/editar`
- Categorías: `/categorias`, `/categorias/nueva`, `/categorias/:id/editar`
- Clientes: `/clientes`, `/clientes/nuevo`, `/clientes/:id/editar`
- Login: `/login`

## Estructura (resumen)
```
src/
  main.ts            # bootstrap con router y http
  index.html         # app shell
  styles.css         # Tailwind layers + estilos base + Bootstrap Icons
  app/
    root.component.ts
    routes.ts
    core/
      auth.service.ts
      role.guard.ts
      product.service.ts
      category.service.ts
      client.service.ts
    auth/
      login.component.ts
    layout/
      topbar.component.ts
    productos/
      productos.component.ts
      producto-create.page.ts
      producto-edit.page.ts
      producto-form.component.ts
    categorias/
      categorias.component.ts
      categoria-create.page.ts
      categoria-edit.page.ts
    clientes/
      clientes.component.ts
      cliente-create.page.ts
      cliente-edit.page.ts
    ventas/
      ventas.component.ts
```

## Solución de problemas

- Puerto en uso (4200):
  ```powershell
  npx ng serve --port 4300
  ```
- Editor marca `@tailwind` como desconocido: es un warning del editor, no de la build. Instalar “Tailwind CSS IntelliSense” o ignorar.
- Iconos no se ven: confirma que el import de Bootstrap Icons está en `src/styles.css` y que la clase usada comienza con `bi` y `bi-...`.

## Próximos pasos sugeridos
- Integrar API real para CRUD.
- Añadir paginación server-side.
- Componentes de confirmación y notificaciones.
- Sistema de roles granular.
- Tests unitarios.
