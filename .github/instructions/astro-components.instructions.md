---
description: "Convenciones para crear o modificar componentes Astro en este proyecto. Usar cuando se crea un nuevo .astro, se agregan props, se trabaja con íconos SVG, imágenes optimizadas o animaciones."
applyTo: "src/components/**/*.astro"
---

# Convenciones de Componentes Astro

## Props de íconos SVG

Siempre declarar estas cinco props con sus defaults:

```astro
---
interface Props {
  width?: string | number;
  height?: string | number;
  stroke?: string;
  fill?: string;
  class?: string;
}
const { width = "", height = "", stroke = "currentColor", fill = "currentColor", class: className = "" } = Astro.props;
---
```

## Imágenes optimizadas

Usar siempre `<Image>` de `astro:assets` (nunca `<img>` plain):

```astro
---
import { Image } from 'astro:assets';
import miImagen from '../../images/mi-imagen.webp';
---
<Image src={miImagen} alt="Descripción" />
```

Esto genera AVIF automático y aplica lazy loading.

## Sistema de colores — usar nombres semánticos

| Clase Tailwind      | Uso                                       |
|---------------------|-------------------------------------------|
| `color-primary`     | Color principal (headers, botones)        |
| `color-secondary`   | Color secundario (fondos suaves)          |
| `color-cta`         | Verde para WhatsApp y CTAs de acción      |
| `color-text`        | Gris oscuro para texto de cuerpo          |
| `color-accent`      | Dorado para badges y botones alternativos |

Ejemplo: `class="bg-color-primary text-white"` — NO usar `bg-color-1`.

## Animaciones de entrada

Envolver secciones con `<SlideAnimations>`:

```astro
---
import SlideAnimations from '../animations/SlideAnimations.astro';
---
<SlideAnimations direction="up" delay={0}>
  <!-- contenido -->
</SlideAnimations>
```

Opciones: `direction="up|left|right"`, `delay={número en ms}`.

## Tracking en botones CTA

Siempre agregar estos atributos en botones de conversión:

```astro
<AnimatedButton
  trackLead={true}
  data-track-type="whatsapp"   <!-- o "call" -->
  data-button-text="Descripción del botón para analytics"
  whatsappUrl={whatsappUrl}    <!-- solo si type=whatsapp -->
/>
```
