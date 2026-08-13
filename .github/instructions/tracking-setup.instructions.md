---
description: "Configuración del sistema de tracking: Meta Pixel, Meta CAPI (server-side), Google Ads. Usar cuando se configura tracking, se agregan conversiones, se depura eventos o se modifica TrackingManager."
applyTo: "src/components/tracking/**,src/components/MetaPixel.astro,src/components/GoogleAdsPixel.astro,src/components/TrackingManager.astro,api/**"
---

# Configuración de Tracking

## Variables de entorno requeridas

Copiar `.env.example` como `.env` y completar:

```env
# Meta Pixel (cliente)
PUBLIC_META_PIXEL_ID=123456789
PUBLIC_ENABLE_META_TRACKING=true

# Meta CAPI (servidor — NUNCA exponer con PUBLIC_)
META_CAPI_TOKEN=token_secreto_aqui

# Google Ads
PUBLIC_GOOGLE_ADS_ID=AW-123456789
PUBLIC_ENABLE_GOOGLE_TRACKING=true
PUBLIC_GOOGLE_ADS_CONVERSIONS=[{"key":"whatsapp","sendTo":"AW-123456789/abcDEFghi"},{"key":"call","sendTo":"AW-123456789/xyzABCdef"}]
```

## Cómo obtener los tokens

| Variable | Dónde obtenerla |
|---|---|
| `PUBLIC_META_PIXEL_ID` | Meta Ads Manager → Events Manager → tu Pixel → Settings |
| `META_CAPI_TOKEN` | Meta Ads Manager → Settings → Data Sources → Web → Tokens |
| `PUBLIC_GOOGLE_ADS_ID` | Google Ads → herramienta (ícono llave) → Conversiones → ID de etiqueta |
| `PUBLIC_GOOGLE_ADS_CONVERSIONS` (cada `sendTo`) | Google Ads → Herramientas → Medición → Conversiones → etiqueta específica |

## Flujo de conversión

1. Usuario hace clic en un botón con `trackLead={true}` (o `data-track-lead="true"` en cualquier elemento HTML)
2. `src/components/tracking/trackingClient.js` captura el evento por delegación en `document`
3. **Navegador**: dispara `fbq('track', <evento>)` + `gtag('event', <evento>)` — SIEMPRE ambos si están habilitados
4. **Servidor**: hace POST a `api/capi-track.php` con los mismos datos (mismo `event_id` que el Pixel, para deduplicación)
5. PHP reenvía el evento a la Meta Conversions API con el `event_name` real recibido (no hardcodeado)

`PageView` sigue el mismo esquema (Pixel + CAPI con el mismo `event_id`), pero se dispara aparte:
`trackingClient.js` lo engancha al evento `astro:page-load`, que Astro dispara tanto en la carga
inicial como en cada navegación con `<ClientRouter />` (SPA) — por eso NO vive en `MetaPixel.astro`,
donde un script suelto en `<head>` no está garantizado que se re-ejecute en cada cambio de página.

`fbp`/`fbc` (cookies `_fbp`/`_fbc`) **no hace falta pasarlos manualmente al Pixel** — `fbq('track', ...)`
los adjunta solo desde las cookies del navegador. Sí hay que leerlos a mano para la CAPI (`getCookie()`
en `trackingClient.js`), porque esa llamada es servidor-a-servidor y no tiene acceso directo a ellas.

### `init()` solo se ejecuta una vez por sesión de navegador

`TrackingManager.astro` vive en `<body>`, así que con `<ClientRouter />` el `<body>` se swapea en
cada navegación y su `<script>import "./tracking/trackingClient.js";</script>` (módulo inline, sin
`src`) se vuelve a insertar y re-ejecutar. Sin el guard `if (window.__trackingClientInitialized) return;`
al principio de `init()`, cada navegación sumaría un listener más de `click`/`submit`/`astro:page-load`
en `document` (nunca se saca el anterior), duplicando progresivamente los eventos de PageView y de
conversión cuantas más páginas navegue el usuario en la sesión. No toques ese guard.

### Meta Pixel: PageView duplicado en Events Manager al navegar (limitación conocida, no un bug)

Con `<ClientRouter />`, `fbevents.js` (el SDK de Meta) detecta por su cuenta los cambios de URL vía
History API (`pushState`/`replaceState`, que es justo lo que usa ClientRouter) y dispara su propio
PageView interno **sin `event_id` propio** — nunca deduplica con el que manda `trackingClient.js`.
Confirmado con Playwright que nuestro código dispara PageView una sola vez por navegación; el
duplicado es enteramente del SDK. No hay forma conocida de apagarlo — ni por dashboard (con
"Configuración automática" desactivada sigue pasando) ni por código (`fbq('set', 'autoConfig', false, pixelId)`
en `MetaPixel.astro` es buena práctica igual, mejora Advanced Matching, pero no resuelve esto). Es
una limitación aceptada del SDK — no perder tiempo reinvestigándola.

## Arquitectura del tracking (refactorizada)

- `src/components/MetaPixel.astro` / `GoogleAdsPixel.astro` → cargan los scripts base de cada plataforma (una vez por página)
- `src/components/TrackingManager.astro` → resuelve la config desde `.env` y la inyecta como JSON (`<script type="application/json" id="tracking-config">`)
- `src/components/tracking/trackingClient.js` → TODA la lógica de tracking vive acá (funciones puras, bien nombradas, comentadas). Leer este archivo para entender o extender el comportamiento.

## Usar CUALQUIER conversión de Meta (no solo Lead/Contact)

Cada botón puede especificar su propio evento, sin tocar código ni agregar variables de entorno nuevas:

```astro
<AnimatedButton
  trackLead={true}
  trackMetaEvent="Purchase"       <!-- cualquier evento estándar o custom de Meta -->
  trackGoogleEvent="purchase"     <!-- cualquier evento de Google Ads/GA4 -->
  trackValue={49.99}              <!-- opcional: valor monetario -->
  trackCurrency="USD"             <!-- opcional: default en PUBLIC_TRACKING_CURRENCY -->
/>
```

Eventos estándar de Meta disponibles: `Lead`, `Contact`, `Schedule`, `Purchase`, `CompleteRegistration`,
`InitiateCheckout`, `AddToCart`, `AddToWishlist`, `AddPaymentInfo`, `Search`, `StartTrial`,
`SubmitApplication`, `Subscribe`, `ViewContent`, `Donate`, `FindLocation`, `CustomizeProduct` — o cualquier
nombre custom que hayas configurado en Meta Events Manager.

Si no especificás `trackMetaEvent`/`trackGoogleEvent`, se usan los defaults globales de `.env`
(`PUBLIC_META_EVENT_DEFAULT` / `PUBLIC_GOOGLE_EVENT_DEFAULT`). `WhatsAppButton` y `CallButton`
(botones flotantes) ya traen sus propios defaults razonables hardcodeados como props
(`metaEvent="Lead"`/`"Contact"`, `googleEvent="whatsapp_contact"`/`"phone_call"`) — sobreescribibles
si los necesitás distintos.

## Conversiones de Google Ads (array configurable, sin límite de cantidad)

`PUBLIC_GOOGLE_ADS_CONVERSIONS` es un array JSON en `.env`, no hay límite a 1 o 2 conversiones:

```env
PUBLIC_GOOGLE_ADS_CONVERSIONS=[
  {"key":"whatsapp","sendTo":"AW-123456789/abcDEFghi"},
  {"key":"call","sendTo":"AW-123456789/xyzABCdef"},
  {"key":"purchase","sendTo":"AW-123456789/qqqRRRsss"}
]
```

Cada botón busca su conversión por `key`, en este orden de prioridad:

1. `trackGoogleSendTo` / `data-track-google-send-to` — label pegado directo, máxima prioridad
2. `trackGoogleConversion` / `data-track-google-conversion` — busca la `key` en el array
3. `data-track-type` ("whatsapp"/"call") — fallback automático si coincide con una `key` existente

```astro
<AnimatedButton trackLead={true} trackGoogleConversion="purchase" trackValue={99.9} />
```

## Valor de la conversión (`value`/`currency`)

Si un botón no especifica `trackValue`, se envía `value=1.0` igual (a Meta, Google y CAPI) con la
moneda de `PUBLIC_TRACKING_CURRENCY`. Para conversiones con valor real (`Purchase`,
`InitiateCheckout`), especificá `trackValue`/`trackCurrency` en el botón.

## Formularios con Advanced Matching (Meta + Google)

Además de botones, cualquier `<form data-track-form="true">` puede capturar datos del usuario
(nombre, teléfono, email, localidad) para mejorar el "matching" de las conversiones — más allá
de disparar el evento, Meta y Google usan estos datos para reconocer mejor al usuario real detrás
del clic. Ejemplo de referencia: `src/sections/landing-ejemplo/ContactForm.astro`.

```astro
<form
  data-track-form="true"
  data-track-meta-event="Lead"
  data-track-google-event="generate_lead"
  data-track-google-conversion="contacto_form"
  data-whatsapp-number="+5493512452068"
  data-message-template="Hola! Soy {fn}, de {ct}. Mi teléfono es {ph}."
>
  <input data-track-field="fn" name="fn" required />        <!-- nombre -->
  <input data-track-field="ph" name="ph" type="tel" required />   <!-- teléfono -->
  <input data-track-field="em" name="em" type="email" required /> <!-- email -->
  <input data-track-field="ct" name="ct" required />         <!-- localidad -->
  <button type="submit">Contactanos por WhatsApp</button>
</form>
```

Al enviar el form (el submit se intercepta, no navega solo):

1. Se arma la URL de `wa.me` reemplazando `{fn}`/`{ln}`/`{em}`/`{ph}`/`{ct}` en `data-message-template`
   con lo que tipeó el usuario.
2. **Meta Pixel**: se reinicializa con `fbq('init', pixelId, {em, ph, fn, ct})` — el pixel hashea
   automáticamente, no hay que hacerlo a mano.
3. **Google**: `gtag('set', 'user_data', {...})` (Enhanced Conversions) — también hashea solo.
4. **Meta CAPI**: los datos viajan normalizados pero SIN hashear hasta `api/capi-track.php`, porque
   la Graph API (a diferencia del Pixel/gtag del cliente) exige que el hash SHA-256 lo hagamos
   nosotros del lado del servidor.

Agregá la key de Google Ads correspondiente (ej. `contacto_form`) a `PUBLIC_GOOGLE_ADS_CONVERSIONS`
si querés que el form dispare una conversión de Google Ads específica (ver ejemplo en `.env.example`).

## GA4 (Analytics), independiente de Google Ads

`PUBLIC_GA4_ID` es opcional e independiente de `PUBLIC_GOOGLE_ADS_ID` — un sitio puede tener uno
solo de los dos, o ambos a la vez. `GoogleAdsPixel.astro` carga el script de `gtag.js` con
cualquiera de los dos ids que exista, y configura los que estén presentes.

- **PageView**: `trackPageView` (en `astro:page-load`) dispara un `page_view` manual de GA4 con
  `send_to: config.ga4Id`. El `gtag('config', ga4Id, ...)` en `GoogleAdsPixel.astro` se inicializa
  con `send_page_view: false` a propósito — si no, el auto-pageview de gtag solo dispararía en la
  carga inicial (no en cada navegación de `<ClientRouter />`), y además duplicaría el manual.
  - **Enhanced Measurement de GA4** (Admin → Flujos de datos → Web → engranaje junto a "Vistas de
    página") manda SU PROPIO `page_view` automático, aparte de `gtag('config', ...)`. Tiene dos partes:
    el sub-toggle "Cambios de página según eventos del historial del navegador" (desactivalo desde la
    UI de GA4 — soluciona el duplicado en navegaciones SPA) y el toggle padre "Vistas de página" (NO
    se puede desactivar desde la UI, y sigue mandando su propio `page_view` en la carga INICIAL de
    cada sesión sin importar `send_page_view:false`). Por eso `trackPageView(config, isInitialLoad)`
    NO manda su `page_view` de GA4 cuando `isInitialLoad` es `true` — evita duplicar ese automático
    que no se puede apagar. En navegaciones SPA sí lo manda (ahí Enhanced Measurement ya está
    desactivado vía el sub-toggle). Este guard es específico de Google (GA4 + Ads, ver abajo) — Meta
    no lo necesita, su PageView se manda siempre, en todas las cargas.
  - **Google Ads** tiene el problema inverso: `gtag('config', googleAdsId)` en `GoogleAdsPixel.astro`
    SÍ manda su propio hit de remarketing (`page_view`) en la carga inicial (a diferencia del config
    de GA4, no lleva `send_page_view:false`) — pero como ese script vive en `<head>` y no se
    re-ejecuta en navegaciones SPA, ese auto-hit también queda limitado a la primera página. Mismo
    guard `!isInitialLoad`, mismo `trackPageView`: en cada navegación SPA se manda un `page_view`
    explícito con `send_to: config.googleAdsId` además del de GA4 — así Google Ads también se entera
    de las navegaciones internas para remarketing/audiencias, no solo de la primera página vista.
- **Conversiones**: cada evento de un botón/formulario se manda con un `gtag('event', ...)` **por
  destino** (`sendGoogleConversionEvents` en `trackingClient.js`) — uno con `send_to` la conversión
  de Google Ads (si el botón matchea una `key` en `PUBLIC_GOOGLE_ADS_CONVERSIONS`) y otro con
  `send_to` el GA4 id (si está configurado). gtag no permite un solo evento con dos destinos a la vez.

## Sufijo de tráfico en WhatsApp (Google/Meta Ads)

Opt-in, sin tocar código. Con `PUBLIC_APPEND_TRAFFIC_SOURCE=true` en `.env`, cualquier link de
WhatsApp trackeado (botón o formulario) le agrega al final del mensaje un sufijo según de dónde
vino el visitante:

- `?gclid=...` en la URL de la página (vino de un anuncio de Google Ads) → agrega
  `PUBLIC_TRAFFIC_SOURCE_GOOGLE_SUFFIX` (default: `" Los encontré por Google."`)
- `?fbclid=...` en la URL (vino de un anuncio de Meta Ads) → agrega
  `PUBLIC_TRAFFIC_SOURCE_META_SUFFIX` (default: `" Lo vi en las redes."`)
- Si no hay ninguno de los dos (tráfico orgánico/directo), el mensaje queda sin cambios.

Apagado por default (`PUBLIC_APPEND_TRAFFIC_SOURCE=false`) — no cambia nada en ninguna landing hasta
que lo actives explícitamente. Ver `.env.example` para personalizar los textos.

## Testear eventos

En `.env` configurar `PUBLIC_TEST_EVENT_CODE` con el código del Test Events Manager de Meta.
Esto envía los eventos como "prueba" sin contaminar datos reales.

## Endpoint CAPI — `api/capi-track.php`

- Acepta POST con: `event_id`, `pixel_id`, `button_text`, `event_type`, y opcionalmente `em`/`ph`/`fn`/`ln`/`ct`
  (Advanced Matching, ver arriba) — llegan normalizados pero sin hashear
- Hashea `em`/`ph`/`fn`/`ln`/`ct` con SHA-256 antes de mandarlos a la Graph API (la API no lo hace por vos)
- Lee `META_CAPI_TOKEN` desde variables de servidor
- Loguea en `logs/capi.log`
- Requiere que `META_CAPI_TOKEN` esté configurado — sin él no envía nada

### Deploy en hosting compartido (Hostinger, cPanel, VPS sin panel de env vars)

`getenv('META_CAPI_TOKEN')` necesita la variable disponible a nivel de proceso de PHP, pero en
hosting compartido normalmente no hay dónde setear env vars fuera del código. Solución: `api/.htaccess`
con `mod_env` de Apache:

```apache
SetEnv META_CAPI_TOKEN el_token_real_aca
```

Copiar `api/.htaccess.example` → `api/.htaccess` (ya está en `.gitignore`, nunca se commitea con el
token real) y reemplazar el placeholder.

## Seguridad

- `META_CAPI_TOKEN` **NUNCA** debe tener el prefijo `PUBLIC_`
- No loguear tokens ni datos personales (`em`/`ph`/`fn`/`ln`/`ct`) en texto plano en `logs/capi.log` —
  `capi-track.php` ya redacta ambos antes de escribir el log
- Revisar permisos del archivo `logs/capi.log` en producción
