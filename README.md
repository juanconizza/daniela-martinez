# astro-landing-template

Template base para crear landing pages con Astro 7, Tailwind CSS, tracking avanzado (Meta Pixel + CAPI + Google Ads) y soporte para múltiples landings por proyecto.

## Stack

- **Astro 7** + TypeScript
- **Tailwind CSS 3** (vía PostCSS, sin la integración `@astrojs/tailwind` — deprecada/incompatible con Astro 7)
- **Fuente**: Outfit (local)
- **Tracking**: Meta Pixel, Meta CAPI (PHP), Google Ads
- **View Transitions**: `<ClientRouter />` habilitado globalmente en `MainLayout.astro`

## Requisitos

- **Node >= 22.12.0** (Astro 7 no corre en Node 20 o menor)
- El repo incluye `.nvmrc` (fijado en Node 24) — correr `nvm use` antes de instalar/buildear

## Comandos

| Comando           | Acción                             |
|-------------------|------------------------------------|
| `nvm use`         | Usa la versión de Node fijada en `.nvmrc` |
| `npm install`     | Instalar dependencias              |
| `npm run dev`     | Servidor local en `localhost:4321` |
| `npm run build`   | Build de producción en `dist/`     |
| `npm run preview` | Preview del build                  |

## Estructura

```
src/
  pages/
    index.astro                  ← "En construcción" (dominio principal)
    landing-[slug]/index.astro   ← Una carpeta por landing (/landing-slug/)
    404.astro
    politicas-de-privacidad.astro
    terminos-y-condiciones.astro
  sections/
    landing-[slug]/               ← Secciones de cada landing (Hero, Servicios, Stats, etc.)
  components/                     ← Solo UI reutilizable (NO secciones de página)
    icons/                        ← Componentes SVG reutilizables
    animations/SlideAnimations.astro
    tracking/trackingClient.js    ← Lógica de tracking (leer para extender/depurar)
    AnimatedButton.astro
    WhatsAppButton.astro
    CallButton.astro
    PhotoGallerySlider.astro
    TestimoniosSlider.astro
    VimeoVideo.astro
    TrackingManager.astro
    MetaPixel.astro
    GoogleAdsPixel.astro
  layouts/MainLayout.astro
  styles/global.css
api/
  capi-track.php                 ← Conversiones server-side Meta CAPI
  .htaccess.example              ← Copiar a .htaccess en hosting compartido sin panel de env vars
public/
  fonts/Outfit.ttf
  images/testimonios/
.github/
  copilot-instructions.md        ← Reglas del proyecto para GitHub Copilot
  instructions/                  ← Guías específicas (componentes, tracking)
  skills/svg-import/              ← Workflow para importar íconos SVG
```

## Cómo crear una nueva landing

1. Copiar `src/pages/landing-ejemplo/` y `src/sections/landing-ejemplo/`, renombrar ambas con el slug del cliente
2. Completar todos los `[PLACEHOLDERS]` en cada sección
3. Configurar `.env` (copiar `.env.example`)
4. Agregar imágenes en `src/images/galeria/` y `src/images/servicios/`
5. `npm run dev` para previsualizar

**Tip para landings "hermanas"** (mismo cliente, distintos procedimientos/productos, ej. varias
cirugías de un mismo centro estético): suelen compartir secciones completas sin cambios (grilla de
servicios, tecnología, testimonios, proceso) y solo varía el Hero/FAQ/Footer con el copy específico
del anuncio. Antes de escribir una sección desde cero, diffeá contra la misma sección de una landing
hermana ya migrada — si el diff es vacío o casi vacío, copiarla ahorra tiempo (ya trae sus fixes de
clases/color aplicados) y solo hay que ajustar imágenes + la key de tracking.

## Colores del proyecto

Cambiar los valores hex en `src/styles/global.css`:

| Variable CSS        | Clase Tailwind    | Uso                          |
|---------------------|-------------------|------------------------------|
| `--color-primary`   | `color-primary`   | Color principal              |
| `--color-secondary` | `color-secondary` | Color secundario             |
| `--color-cta`       | `color-cta`       | WhatsApp, CTAs               |
| `--color-text`      | `color-text`      | Texto de cuerpo              |
| `--color-accent`    | `color-accent`    | Badges, botones alternativos |

## Configuración de tracking

Cada botón puede trackear CUALQUIER conversión de Meta/Google (no solo Lead/Contact), con `value`/`currency`
opcionales (default `1.0` / `PUBLIC_TRACKING_CURRENCY`). Las conversiones de Google Ads se configuran como
un array JSON (`PUBLIC_GOOGLE_ADS_CONVERSIONS`), sin límite de cantidad.

Ver `.env.example` para todas las variables disponibles.
Ver `.github/instructions/tracking-setup.instructions.md` para la guía completa.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
