<?php
// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

header('Content-Type: application/json');

// Función para loggear en la terminal del PHP server
function logMessage($message) {
  $timestamp = date('Y-m-d H:i:s');
  $fullMessage = "[$timestamp] $message";
  
  // Imprimir en stderr (aparece en la terminal del PHP server)
  file_put_contents('php://stderr', $fullMessage . "\n");
  
  // También intentar guardar en archivo de logs del proyecto
  $logDir = __DIR__ . '/../logs';
  if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
  }
  @file_put_contents($logDir . '/capi.log', $fullMessage . "\n", FILE_APPEND);
}

// Oculta los campos de Advanced Matching (email, teléfono, nombre, localidad)
// antes de loguear — son datos personales, nunca deben quedar en texto plano.
function redactPII($data) {
  if (!is_array($data)) return $data;
  $redacted = $data;
  foreach (['em', 'ph', 'fn', 'ln', 'ct'] as $field) {
    if (isset($redacted[$field])) {
      $redacted[$field] = '[REDACTED]';
    }
  }
  return $redacted;
}

logMessage("=== REQUEST INICIADO ===");
logMessage("Method: " . $_SERVER['REQUEST_METHOD']);
logMessage("From: " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));


if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  logMessage("❌ Error: Method not allowed");
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
logMessage("Datos recibidos: " . json_encode(redactPII($data)));

if (!$data || !isset($data['event_id']) || !isset($data['pixel_id'])) {
  logMessage("❌ Error: Missing required fields");
  http_response_code(400);
  echo json_encode(['error' => 'Missing required fields: event_id, pixel_id']);
  exit;
}

$pixelId = $data['pixel_id'];
$eventId = $data['event_id'];
$testEventCode = $data['test_event_code'] ?? null;

logMessage("📊 Pixel ID: $pixelId");
logMessage("🆔 Event ID: $eventId");
if ($testEventCode) {
  logMessage("🧪 Test Event Code: $testEventCode");
}

// El nombre del evento lo define el botón que dispara el tracking
// (cualquier evento estándar o custom de Meta: Lead, Purchase, Schedule, etc.)
// "Lead" queda solo como fallback si el cliente no lo envía.
$eventName = $data['event_name'] ?? 'Lead';

// "source" lo define el cliente según el origen del evento (web_cta, web_form,
// web_pageview...) — antes quedaba hardcodeado a "web_cta" incluso para forms/PageView.
$customData = [
  'source' => $data['source'] ?? 'web_cta'
];
if (isset($data['button_text'])) {
  $customData['content_name'] = $data['button_text'];
}
if (isset($data['event_type'])) {
  $customData['event_type'] = $data['event_type'];
}
if (isset($data['destination_url'])) {
  $customData['destination_url'] = $data['destination_url'];
}
if (isset($data['value']) && is_numeric($data['value'])) {
  $customData['value'] = (float) $data['value'];
  $customData['currency'] = $data['currency'] ?? 'ARS';
}

// Advanced Matching: la Graph API exige que el hash (SHA-256) lo hagamos
// nosotros — a diferencia del Pixel/gtag del cliente, que hashean solo.
function hashMatchField($value) {
  return hash('sha256', strtolower(trim($value)));
}
function hashPhoneField($value) {
  return hash('sha256', preg_replace('/\D/', '', $value));
}

$userData = [
  'client_ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
  'client_user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
  'fbc' => $data['fbc'] ?? null,
  'fbp' => $data['fbp'] ?? null
];
foreach (['em', 'fn', 'ln', 'ct'] as $field) {
  if (!empty($data[$field])) {
    $userData[$field] = hashMatchField($data[$field]);
  }
}
if (!empty($data['ph'])) {
  $userData['ph'] = hashPhoneField($data['ph']);
}

$event = [
  'event_name' => $eventName,
  'event_id' => $eventId,
  'event_time' => time(),
  'event_source_url' => $_SERVER['HTTP_REFERER'] ?? '',
  'action_source' => 'website',
  'user_data' => $userData,
  'custom_data' => $customData
];

logMessage("🔧 Event payload: " . json_encode($event));

$metaCapiToken = getenv('META_CAPI_TOKEN');
if (!$metaCapiToken) {
  logMessage("❌ Error: META_CAPI_TOKEN no configurado");
  http_response_code(500);
  echo json_encode(['error' => 'Missing META_CAPI_TOKEN']);
  exit;
}

logMessage("✅ Token encontrado: " . substr($metaCapiToken, 0, 10) . "...");

$payload = [
  'data' => [$event],
  'access_token' => $metaCapiToken
];

// Agregar test_event_code si está presente
if ($testEventCode) {
  $payload['test_event_code'] = $testEventCode;
}

$capiUrl = "https://graph.facebook.com/v18.0/{$pixelId}/events";
logMessage("📡 Enviando a: $capiUrl");
$redactedPayload = $payload;
$redactedPayload['access_token'] = substr($metaCapiToken, 0, 10) . '...';
logMessage("📦 Payload: " . json_encode($redactedPayload));

$ch = curl_init($capiUrl);
curl_setopt_array($ch, [
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 10
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

logMessage("📥 Response Status: $httpCode");
logMessage("📥 Response Body: " . $response);
if ($curlError) {
  logMessage("❌ Curl Error: $curlError");
}

if ($httpCode >= 200 && $httpCode < 300) {
  logMessage("✅ SUCCESS - Evento enviado a Meta CAPI");
  echo json_encode(['success' => true, 'status' => $httpCode]);
} else {
  logMessage("❌ FAILED - Meta CAPI retornó: $httpCode");
  http_response_code($httpCode);
  echo json_encode(['error' => 'CAPI request failed', 'status' => $httpCode, 'response' => $response]);
}

logMessage("=== REQUEST FINALIZADO ===\n");
?>
