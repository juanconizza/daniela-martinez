/**
 * Tracking Client — lógica de conversión (Meta Pixel + Google Ads + Meta CAPI)
 * =============================================================================
 * Este script escucha clics en CUALQUIER elemento con [data-track-lead="true"]
 * y dispara la conversión simultáneamente en:
 *
 *   1. Meta Pixel (navegador)       → fbq('track', ...)
 *   2. Google Ads / GA4 (navegador) → gtag('event', ...)
 *   3. Meta CAPI (servidor)         → POST a api/capi-track.php
 *
 * Los eventos 1 y 3 comparten el mismo `event_id` para que Meta los deduplique
 * automáticamente (mismo evento reportado por dos canales distintos).
 *
 * PageView sigue el mismo esquema de dedup (Pixel + CAPI, mismo event_id) pero
 * se dispara solo desde acá, en "astro:page-load" (ver trackPageView/init) —
 * NO desde MetaPixel.astro, porque con ClientRouter (SPA) un script suelto en
 * <head> no está garantizado que se re-ejecute en cada navegación interna.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CÓMO TRACKEAR UN BOTÓN
 * ─────────────────────────────────────────────────────────────────────────
 * Usando AnimatedButton.astro (recomendado):
 *
 *   <AnimatedButton
 *     trackLead={true}
 *     trackMetaEvent="Purchase"        // cualquier evento de Meta (ver lista abajo)
 *     trackGoogleEvent="purchase"      // cualquier evento de Google Ads/GA4
 *     trackValue={49.99}               // opcional: valor monetario
 *     trackCurrency="USD"              // opcional: default configurado en .env
 *   />
 *
 * O agregando los atributos directamente a cualquier elemento HTML:
 *
 *   data-track-lead="true"                (obligatorio, activa el tracking)
 *   data-track-type="whatsapp"|"call"     (opcional, metadata para reportes y para
 *                                           matchear una conversión de Google por key)
 *   data-track-meta-event="Lead"          (cualquier evento estándar o custom de Meta)
 *   data-track-google-event="generate_lead"
 *   data-track-google-send-to="AW-XXX/YYY"      (override directo, máxima prioridad)
 *   data-track-google-conversion="purchase"     (busca el sendTo en PUBLIC_GOOGLE_ADS_CONVERSIONS por key)
 *   data-track-value="49.99"              (opcional, default 1.0 si no se especifica)
 *   data-track-currency="USD"
 *   data-button-text="Descripción para reportes"
 *
 * Eventos estándar de Meta disponibles (o usá cualquier nombre custom):
 *   Lead, Contact, Schedule, Purchase, CompleteRegistration, InitiateCheckout,
 *   AddToCart, AddToWishlist, AddPaymentInfo, Search, StartTrial,
 *   SubmitApplication, Subscribe, ViewContent, Donate, FindLocation,
 *   CustomizeProduct
 *
 * Las conversiones de Google Ads se configuran en .env como un array JSON
 * (PUBLIC_GOOGLE_ADS_CONVERSIONS), no hay límite de cantidad. Cada botón las
 * referencia por "key" (data-track-google-conversion, o el propio data-track-type
 * si coincide con una key existente — asi funcionan WhatsAppButton/CallButton).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FORMULARIOS CON ADVANCED MATCHING (Meta + Google)
 * ─────────────────────────────────────────────────────────────────────────
 * Cualquier <form data-track-form="true"> es interceptado en el submit (no
 * navega solo — armamos nosotros la URL de WhatsApp con los datos cargados).
 * Los inputs que tengan [data-track-field="em|ph|fn|ln|ct"] se leen, se
 * normalizan y se usan para:
 *
 *   1. Reinicializar el Meta Pixel (fbq('init', pixelId, userData)) → hashea
 *      automáticamente, mejora el matching de las conversiones del navegador.
 *   2. gtag('set', 'user_data', ...) → Enhanced Conversions de Google, también
 *      hasheado automáticamente por el tag.
 *   3. Enviarse (sin hashear) a api/capi-track.php, que SÍ tiene que hashear
 *      manualmente (la Graph API no lo hace por vos).
 *
 *   <form
 *     data-track-form="true"
 *     data-track-meta-event="Lead"
 *     data-track-google-event="generate_lead"
 *     data-track-google-conversion="contacto_form"
 *     data-whatsapp-number="+5493512452068"
 *     data-message-template="Hola! Soy {fn}, de {ct}. Mi teléfono es {ph}."
 *   >
 *     <input data-track-field="fn" name="fn" required />
 *     <input data-track-field="ph" name="ph" type="tel" required />
 *     <input data-track-field="em" name="em" type="email" required />
 *     <input data-track-field="ct" name="ct" required />
 *     <button type="submit">Contactanos por WhatsApp</button>
 *   </form>
 *
 * data-message-template soporta {fn}/{ln}/{em}/{ph}/{ct} y se reemplaza con
 * los valores tal cual los tipeó el usuario (sin normalizar) para armar el
 * mensaje de wa.me.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GA4 (Analytics) — independiente de Google Ads
 * ─────────────────────────────────────────────────────────────────────────
 * Con PUBLIC_GA4_ID configurado (ver .env.example), cada conversión se manda
 * también a GA4 además de a la conversión de Google Ads (un gtag('event', ...)
 * por destino, ver sendGoogleConversionEvents) y el PageView dispara un
 * page_view manual con send_to al GA4 id — con send_page_view:false en el
 * config de gtag (GoogleAdsPixel.astro) para no duplicarlo con el auto-pageview,
 * que además con ClientRouter solo dispararía en la carga inicial.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SUFIJO DE TRÁFICO (Google/Meta Ads) EN WHATSAPP — opt-in, sin código
 * ─────────────────────────────────────────────────────────────────────────
 * Con PUBLIC_APPEND_TRAFFIC_SOURCE=true en .env, cualquier link de WhatsApp
 * trackeado (botón o form) le agrega al mensaje un sufijo según de dónde vino
 * el visitante: ?gclid=... en la URL → viene de Google Ads; ?fbclid=... → de
 * Meta Ads. Ver PUBLIC_TRAFFIC_SOURCE_GOOGLE_SUFFIX / _META_SUFFIX en
 * .env.example para personalizar el texto. Apagado por default.
 * =============================================================================
 */

/** Lee la config inyectada por TrackingManager.astro en el <script type="application/json"> */
function readConfig() {
  const el = document.getElementById("tracking-config");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function generateEventId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getCapiEndpoint() {
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return isLocalhost ? "http://localhost:8080/api/capi-track.php" : "/api/capi-track.php";
}

// ── Resolución de datos del botón clickeado ────────────────────────────────

function getEventType(btn) {
  return btn.getAttribute("data-track-type") || "default";
}

/** data-track-meta-event tiene prioridad; si no está, usa el default global */
function resolveMetaEvent(btn, config) {
  return btn.getAttribute("data-track-meta-event") || config.defaultMetaEvent;
}

/** data-track-google-event tiene prioridad; si no está, usa el default global */
function resolveGoogleEvent(btn, config) {
  return btn.getAttribute("data-track-google-event") || config.defaultGoogleEvent;
}

/**
 * Prioridad: data-track-google-send-to (label pegado directo) > búsqueda en
 * config.googleConversions por key (data-track-google-conversion, o el propio
 * data-track-type si coincide con una key existente).
 */
function resolveGoogleSendTo(btn, config) {
  const explicit = btn.getAttribute("data-track-google-send-to");
  if (explicit) return explicit;

  const key = btn.getAttribute("data-track-google-conversion") || getEventType(btn);
  const conversion = config.googleConversions.find((item) => item.key === key);
  return conversion ? conversion.sendTo : "";
}

function resolveValue(btn) {
  const raw = btn.getAttribute("data-track-value");
  const parsed = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveCurrency(btn, config) {
  return btn.getAttribute("data-track-currency") || config.defaultCurrency;
}

function resolveNavigationUrl(btn) {
  return (
    btn.getAttribute("data-track-href") ||
    btn.getAttribute("data-whatsapp-url") ||
    (btn.tagName === "A" ? btn.getAttribute("href") : null)
  );
}

/** Si el botón no es un <a> (ej. un <button>), abre la URL manualmente */
function maybeNavigate(btn, url) {
  if (!url || btn.tagName === "A") return;
  const target = btn.getAttribute("data-track-target") || "_blank";
  window.open(url, target);
}

// ── Advanced Matching (formularios) ─────────────────────────────────────────

/** Lee los [data-track-field] de un form y devuelve los valores tal cual los tipeó el usuario */
function collectRawUserData(form) {
  const raw = {};
  form.querySelectorAll("[data-track-field]").forEach((el) => {
    const key = el.getAttribute("data-track-field");
    const value = (el.value || "").trim();
    if (key && value) raw[key] = value;
  });
  return raw;
}

/** Normaliza los campos de Advanced Matching como exige Meta/Google (lowercase, sin espacios, teléfono solo dígitos) */
function normalizeUserData(raw) {
  const normalized = {};
  if (raw.em) normalized.em = raw.em.trim().toLowerCase();
  if (raw.ph) normalized.ph = raw.ph.replace(/\D/g, "");
  if (raw.fn) normalized.fn = raw.fn.trim().toLowerCase();
  if (raw.ln) normalized.ln = raw.ln.trim().toLowerCase();
  if (raw.ct) normalized.ct = raw.ct.trim().toLowerCase();
  return normalized;
}

/** Mapea los campos normalizados al shape que espera gtag('set', 'user_data', ...) */
function toGoogleUserData(userData) {
  const out = {};
  if (userData.em) out.email = userData.em;
  if (userData.ph) out.phone_number = `+${userData.ph}`;
  const address = {};
  if (userData.fn) address.first_name = userData.fn;
  if (userData.ln) address.last_name = userData.ln;
  if (userData.ct) address.city = userData.ct;
  if (Object.keys(address).length) out.address = address;
  return out;
}

/** Reemplaza {campo} en el template del mensaje con los valores crudos (sin normalizar) del form */
function buildMessageFromTemplate(template, raw) {
  return template.replace(/\{(\w+)\}/g, (_, key) => raw[key] ?? "");
}

// ── Sufijo de tráfico (Google/Meta Ads) en WhatsApp ─────────────────────────

function isWhatsAppUrl(url) {
  return typeof url === "string" && /^https:\/\/wa\.me\//.test(url);
}

/** gclid → vino de Google Ads; fbclid → vino de Meta Ads; si no hay ninguno, null */
function getTrafficSource() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("gclid")) return "google";
  if (params.get("fbclid")) return "meta";
  return null;
}

/** Le agrega al final del mensaje de un link wa.me un sufijo según de dónde
 * vino el visitante. Si no hay traffic source detectable, devuelve la url tal cual. */
function appendTrafficSourceSuffix(url, config) {
  const source = getTrafficSource();
  if (!source) return url;

  // OJO: el teléfono puede venir con "+" adelante (wa.me/+549...) — el regex
  // tiene que contemplarlo, si no nunca matchea y el sufijo no se agrega nunca.
  const match = url.match(/^(https:\/\/wa\.me\/\+?\d+)(?:\?text=(.*))?$/);
  if (!match) return url;

  const base = match[1];
  const existingText = match[2] ? decodeURIComponent(match[2]) : "";
  const suffix = source === "google" ? config.trafficSourceGoogleSuffix : config.trafficSourceMetaSuffix;

  return `${base}?text=${encodeURIComponent(existingText + suffix)}`;
}

/** Los <a> navegan solos vía href; para poder inyectarles el sufijo hay que
 * interceptar el click y navegar nosotros. Respeta target="_blank" del link. */
function navigateAnchorManually(btn, url) {
  const target = btn.getAttribute("target");
  if (target === "_blank") {
    window.open(url, "_blank");
  } else {
    window.location.href = url;
  }
}

// ── Envío de eventos a cada canal ───────────────────────────────────────────

function sendMetaPixelEvent(eventName, eventId, params) {
  if (!window.fbq) return;
  window.fbq("track", eventName, params, { eventID: eventId });
}

function sendGoogleEvent(eventName, params) {
  if (!window.gtag) return;
  window.gtag("event", eventName, params);
}

/**
 * gtag necesita un send_to por destino — no se puede mandar un solo evento a
 * la vez a una conversión de Google Ads y a GA4. Manda una llamada por cada
 * destino configurado (la conversión de Ads si hay, más GA4 si está seteado).
 */
function sendGoogleConversionEvents(eventName, params, googleSendTo, config) {
  const destinations = [googleSendTo, config.ga4Id].filter(Boolean);
  if (destinations.length === 0) {
    sendGoogleEvent(eventName, params);
    return;
  }
  destinations.forEach((sendTo) => {
    sendGoogleEvent(eventName, { ...params, send_to: sendTo });
  });
}

function sendCapiEvent(payload) {
  const body = JSON.stringify(payload);
  const endpoint = getCapiEndpoint();

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

// ── Orquestación al hacer clic ──────────────────────────────────────────────

function trackClick(btn, config, event) {
  const buttonText = btn.getAttribute("data-button-text") || btn.textContent.trim() || "CTA Button";
  const eventType = getEventType(btn);
  let navigationUrl = resolveNavigationUrl(btn);
  // Default 1.0 para ambos canales si el botón no especifica data-track-value
  const value = resolveValue(btn) ?? 1.0;
  const currency = resolveCurrency(btn, config);

  const metaEventName = resolveMetaEvent(btn, config);
  const googleEventName = resolveGoogleEvent(btn, config);
  const googleSendTo = resolveGoogleSendTo(btn, config);

  const eventId = generateEventId();

  if (config.appendTrafficSource && isWhatsAppUrl(navigationUrl)) {
    navigationUrl = appendTrafficSourceSuffix(navigationUrl, config);
    if (btn.tagName === "A") {
      event?.preventDefault();
      navigateAnchorManually(btn, navigationUrl);
    }
  }

  // Navegación inmediata (solo si el elemento no es un <a> con href propio)
  maybeNavigate(btn, navigationUrl);

  // 1) Meta Pixel — navegador
  if (config.shouldTrackMeta && metaEventName) {
    sendMetaPixelEvent(metaEventName, eventId, {
      content_name: buttonText,
      source: "web_cta",
      event_type: eventType,
      destination: navigationUrl || undefined,
      value,
      currency,
    });
  }

  // 2) Google Ads / GA4 — navegador
  if (config.enableGoogleTracking && googleEventName) {
    // Un evento por destino: la conversión de Google Ads (si hay) y/o GA4 (si está seteado).
    sendGoogleConversionEvents(
      googleEventName,
      { event_category: eventType, event_label: buttonText, value, currency },
      googleSendTo,
      config
    );
  }

  // 3) Meta CAPI — servidor (deduplicado con el Pixel vía el mismo event_id)
  if (config.shouldTrackMeta && metaEventName) {
    sendCapiEvent({
      event_name: metaEventName,
      event_id: eventId,
      pixel_id: config.pixelId,
      button_text: buttonText,
      source: "web_cta",
      event_type: eventType,
      destination_url: navigationUrl,
      value,
      currency,
      fbp: getCookie("_fbp"),
      fbc: getCookie("_fbc"),
      ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
    });
  }
}

/**
 * Orquestación al enviar un <form data-track-form="true">: arma la URL de
 * WhatsApp con los datos cargados, dispara Advanced Matching en Meta Pixel +
 * Google (gtag), y manda los datos crudos a la CAPI para que los hashee.
 */
function trackFormSubmit(form, config) {
  const raw = collectRawUserData(form);
  const userData = normalizeUserData(raw);

  const whatsappNumber = form.getAttribute("data-whatsapp-number");
  const messageTemplate = form.getAttribute("data-message-template") || "";
  const message = buildMessageFromTemplate(messageTemplate, raw);
  let navigationUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : undefined;

  if (config.appendTrafficSource && isWhatsAppUrl(navigationUrl)) {
    navigationUrl = appendTrafficSourceSuffix(navigationUrl, config);
  }

  const buttonText = form.getAttribute("data-button-text") || "Formulario de Contacto";
  const eventType = getEventType(form);
  const value = resolveValue(form) ?? 1.0;
  const currency = resolveCurrency(form, config);

  const metaEventName = resolveMetaEvent(form, config);
  const googleEventName = resolveGoogleEvent(form, config);
  const googleSendTo = resolveGoogleSendTo(form, config);

  const eventId = generateEventId();
  const hasUserData = Object.keys(userData).length > 0;

  // Advanced Matching — Meta Pixel: reinicializar con los datos del usuario
  // ANTES de trackear. fbq hashea automáticamente lo que se le pasa acá.
  if (config.shouldTrackMeta && hasUserData && window.fbq) {
    window.fbq("init", config.pixelId, userData);
  }

  // Advanced Matching — Google Enhanced Conversions: gtag también hashea solo.
  if (config.enableGoogleTracking && hasUserData && window.gtag) {
    window.gtag("set", "user_data", toGoogleUserData(userData));
  }

  if (config.shouldTrackMeta && metaEventName) {
    sendMetaPixelEvent(metaEventName, eventId, {
      content_name: buttonText,
      source: "web_form",
      event_type: eventType,
      destination: navigationUrl || undefined,
      value,
      currency,
    });
  }

  if (config.enableGoogleTracking && googleEventName) {
    // Un evento por destino: la conversión de Google Ads (si hay) y/o GA4 (si está seteado).
    sendGoogleConversionEvents(
      googleEventName,
      { event_category: eventType, event_label: buttonText, value, currency },
      googleSendTo,
      config
    );
  }

  // Meta CAPI — va con los datos crudos normalizados (sin hashear): la Graph
  // API exige que el hash lo hagamos nosotros, así que lo hace capi-track.php.
  if (config.shouldTrackMeta && metaEventName) {
    sendCapiEvent({
      event_name: metaEventName,
      event_id: eventId,
      pixel_id: config.pixelId,
      button_text: buttonText,
      source: "web_form",
      event_type: eventType,
      destination_url: navigationUrl,
      value,
      currency,
      fbp: getCookie("_fbp"),
      fbc: getCookie("_fbc"),
      ...userData,
      ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
    });
  }

  if (navigationUrl) {
    window.location.href = navigationUrl;
  }
}

/**
 * PageView — Pixel + CAPI deduplicados con el mismo event_id. Se llama desde
 * "astro:page-load" (ver init()), que dispara tanto en la carga inicial como
 * en cada navegación con ClientRouter (a diferencia de un script suelto en
 * <head>, que con SPA routing no está garantizado que se re-ejecute).
 *
 * @param {boolean} isInitialLoad true solo en el primer astro:page-load de la
 * sesión — lo usa Google Ads para no duplicar el hit de remarketing
 * automático que manda solo en esa primera carga (ver el guard más abajo).
 * GA4 y Meta lo ignoran, se mandan siempre.
 */
function trackPageView(config, isInitialLoad) {
  if (config.enableGoogleTracking) {
    const pageViewParams = { page_location: window.location.href, page_title: document.title };

    // GA4: se manda siempre, también en la carga inicial. En teoría "Enhanced
    // Measurement" de GA4 ya manda su propio page_view automático en esa
    // primera carga, pero eso depende de una config del lado de GA4 que no
    // controlamos desde acá (si está apagada, ese primer page_view se pierde
    // del todo) — mandarlo siempre a mano es lo único confiable. Si GA4 tiene
    // Enhanced Measurement activo vas a ver el page_view de la carga inicial
    // duplicado (uno de cada lado); en ese caso, en GA4 Admin → Flujos de
    // datos → Web → engranaje de "Vistas de página" desactivá el evento
    // automático de page_view (dejando el resto de Enhanced Measurement
    // intacto) para quedarte solo con el nuestro.
    if (config.ga4Id) {
      sendGoogleEvent("page_view", { ...pageViewParams, send_to: config.ga4Id });
    }

    // Google Ads: gtag('config', googleAdsId) en <head> (sin send_page_view
    // false) SÍ manda su propio hit de remarketing en la carga inicial, así
    // que acá solo mandamos el nuestro en navegaciones SPA subsiguientes
    // (ese script no se re-ejecuta con ClientRouter).
    if (!isInitialLoad && config.googleAdsId) {
      sendGoogleEvent("page_view", { ...pageViewParams, send_to: config.googleAdsId });
    }
  }

  if (!config.shouldTrackMeta) return;

  const eventId = generateEventId();

  sendMetaPixelEvent("PageView", eventId, {});

  sendCapiEvent({
    event_name: "PageView",
    event_id: eventId,
    pixel_id: config.pixelId,
    source: "web_pageview",
    fbp: getCookie("_fbp"),
    fbc: getCookie("_fbc"),
    ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
  });
}

function init() {
  // TrackingManager.astro vive en <body>, así que con ClientRouter este script
  // (módulo inline, sin "src") se vuelve a insertar y re-ejecutar en cada
  // navegación — sin este guard, cada navegación suma un listener más de
  // "click"/"submit"/"astro:page-load" (nunca se saca el anterior), duplicando
  // progresivamente los eventos de PageView y de conversión.
  if (window.__trackingClientInitialized) return;
  window.__trackingClientInitialized = true;

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-track-lead]");
    if (!btn) return;

    // Se relee la config en cada clic (defensivo ante navegación con ClientRouter)
    const config = readConfig();
    if (!config) return;

    trackClick(btn, config, event);
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-track-form]");
    if (!form) return;
    event.preventDefault();

    const config = readConfig();
    if (!config) return;

    trackFormSubmit(form, config);
  });

  // astro:page-load dispara en la carga inicial Y en cada navegación con
  // ClientRouter (SPA) — a diferencia de DOMContentLoaded, que con view
  // transitions solo ocurre una vez por sesión.
  let isInitialPageLoad = true;
  document.addEventListener("astro:page-load", () => {
    const config = readConfig();
    if (!config) return;

    trackPageView(config, isInitialPageLoad);
    isInitialPageLoad = false;
  });
}

init();
