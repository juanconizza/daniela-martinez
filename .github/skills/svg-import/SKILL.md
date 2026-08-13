---
name: svg-import
description: "Importar iconos SVG desde SVGrepo y convertirlos en componentes Astro. Usar cuando el usuario pide agregar un nuevo ícono, importar un SVG, o crear un componente en src/components/icons/."
argument-hint: "Nombre del ícono o URL de SVGrepo"
---

# Importar SVG desde SVGrepo → Componente Astro

## Cuándo usar este skill

- El usuario pide un nuevo ícono
- Se necesita un SVG de SVGrepo como componente `.astro`
- Se quiere convertir un SVG externo al estándar del proyecto

## Problema común

SVGrepo responde `429` al scrapear `/svg/...` o rutas de download directas.

**Solución**: Usar el endpoint `/show/{id}/{slug}.svg` que devuelve el SVG crudo:

```
https://www.svgrepo.com/show/{ID}/{SLUG}.svg
```

## Procedimiento

1. **Descargar el SVG** a `/tmp` para no copiar manualmente:

```bash
curl -L -A "Mozilla/5.0" -s "https://www.svgrepo.com/show/{ID}/{SLUG}.svg" -o /tmp/{nombre}.svg
```

2. **Leer el SVG** descargado y extraer el contenido del `<svg>`.

3. **Crear el componente Astro** en `src/components/icons/NombreIcono.astro` con esta plantilla:

```astro
---
interface Props {
  width?: string | number;
  height?: string | number;
  stroke?: string;
  fill?: string;
  class?: string;
}

const {
  width = "",
  height = "",
  stroke = "currentColor",
  fill = "currentColor",
  class: className = "",
} = Astro.props;
---

<svg
  viewBox="..."
  width={width}
  height={height}
  xmlns="http://www.w3.org/2000/svg"
  class={className}
>
  <path d="..." fill={fill}></path>
</svg>
```

4. **Estandarizar colores fijos**: reemplazar `#000`, `#0F0F0F`, `black`, `white` por `fill={fill}` o `stroke={stroke}` según corresponda.

5. **Validar** con `get_errors` que no haya errores de sintaxis.

## Convenciones del proyecto

- **Carpeta**: `src/components/icons/`
- **Nombre**: PascalCase → `EmpresaFamiliar.astro`, `FlotaPropia.astro`
- **Props obligatorias**: `width`, `height`, `stroke`, `fill`, `class`
- **Default de fill**: `"currentColor"` (hereda el color del texto padre)

## Descarga múltiple (template)

```bash
mkdir -p /tmp/iconos && \
curl -L -A "Mozilla/5.0" -s "https://www.svgrepo.com/show/{ID1}/{SLUG1}.svg" -o /tmp/iconos/icono1.svg && \
curl -L -A "Mozilla/5.0" -s "https://www.svgrepo.com/show/{ID2}/{SLUG2}.svg" -o /tmp/iconos/icono2.svg
```
