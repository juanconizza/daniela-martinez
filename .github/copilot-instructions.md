# Instrucciones para GitHub Copilot — astro-landing-template

## Stack y tecnologías

- **Framework**: Astro 5 con TypeScript
- **Estilos**: Tailwind CSS 3 (configuración en `tailwind.config.js`)
- **Fuente**: Outfit (local, en `public/fonts/`)
- **Tracking**: Meta Pixel + Meta CAPI (PHP) + Google Ads
- **Build**: `npm run build` → salida en `dist/`

## Estructura del proyecto

```
src/
  pages/
    index.astro                  ← Página "En construcción" del dominio principal
    landing-[slug]/index.astro   ← Una carpeta por landing (URL: /landing-slug/)
    404.astro
    politicas-de-privacidad.astro
    terminos-y-condiciones.astro
  components/
    sections/                    ← Secciones específicas de cada landing (vacío en el template base)
    icons/                       ← Componentes SVG reutilizables
    animations/                  ← SlideAnimations.astro
    AnimatedButton.astro         ← CTA con tracking integrado
    WhatsAppButton.astro         ← Botón flotante WhatsApp
    CallButton.astro             ← Botón flotante llamada
    PhotoGallerySlider.astro     ← Slider de galería
    TestimoniosSlider.astro      ← Slider de testimonios
    VimeoVideo.astro             ← Player de video Vimeo
    MetaPixel.astro              ← Tracking Meta
    GoogleAdsPixel.astro         ← Tracking Google Ads
    TrackingManager.astro        ← Gestión de eventos de conversión
  layouts/
    MainLayout.astro             ← Layout principal con head, tracking, og tags
  styles/
    global.css                   ← Variables de color + Tailwind imports
    fonts.css                    ← Import de Outfit
  images/
    favicon.png
    galeria/                     ← Imágenes de galería para PhotoGallerySlider
    servicios/                   ← Imágenes de tarjetas de servicios
api/
  capi-track.php                 ← Endpoint PHP para conversiones server-side Meta
public/
  fonts/Outfit.ttf
  images/testimonios/            ← Fotos de clientes para TestimoniosSlider
```

## Sistema de colores

Las variables se definen en `src/styles/global.css` y se exponen como clases de Tailwind.

| Variable CSS           | Clase Tailwind          | Uso                                      |
|------------------------|-------------------------|------------------------------------------|
| `--color-primary`      | `color-primary`         | Azul principal, headers, botones primarios |
| `--color-secondary`    | `color-secondary`       | Azul claro, fondos suaves                |
| `--color-cta`          | `color-cta`             | Verde, WhatsApp, acciones principales    |
| `--color-text`         | `color-text`            | Gris oscuro, texto de cuerpo             |
| `--color-accent`       | `color-accent`          | Dorado, badges, botones alternativos     |

**Usar los nombres semánticos** (`color-primary`, `color-text`, etc.) en componentes nuevos.
Los nombres numéricos (`color-1` a `color-5`) existen por compatibilidad con componentes anteriores.

## Convenciones de código

- **Componentes Astro**: PascalCase → `MiComponente.astro`
- **Props de íconos SVG**: siempre `width`, `height`, `stroke`, `fill`, `class`
- **Imágenes**: usar `<Image>` de `astro:assets` para optimización automática (AVIF, lazy load)
- **Tracking en botones**: agregar `trackLead={true}`, `data-track-type="whatsapp"|"call"`, `data-button-text="Descripción"`
- **Animaciones**: envolver secciones con `<SlideAnimations direction="up|left|right" delay={ms}>`
- **Variables de entorno**: las que empiezan con `PUBLIC_` son accesibles en el cliente; las demás solo en el servidor

## Cómo crear una nueva landing

1. Copiar la carpeta `src/pages/landing-ejemplo/` y renombrarla con el slug del cliente
2. Completar todos los `[PLACEHOLDERS]` en el archivo `index.astro` de la nueva carpeta
3. Configurar `.env` con el teléfono y los IDs de tracking del cliente
4. Agregar imágenes del cliente en `src/images/galeria/` y `src/images/servicios/`
5. Ejecutar `npm run dev` para previsualizar

## Comandos

| Comando           | Acción                                |
|-------------------|---------------------------------------|
| `npm run dev`     | Servidor local en `localhost:4321`    |
| `npm run build`   | Build de producción en `dist/`        |
| `npm run preview` | Preview del build                     |
