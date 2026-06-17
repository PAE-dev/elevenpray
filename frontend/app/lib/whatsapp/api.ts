import { getAuthHeaders, getBaseUrl } from "../api";

export interface WhatsAppStatus {
  connected: boolean;
  phone: string | null;
}

export interface ConnectWhatsAppResponse {
  success: true;
  phone: string;
}

function parseApiError(body: Record<string, unknown>, fallback: string): string {
  if (typeof body.error === "string" && body.error) return body.error;
  if (typeof body.message === "string" && body.message) return body.message;
  if (Array.isArray(body.message) && body.message.length > 0) {
    return body.message.join(", ");
  }
  return fallback;
}

export async function getWhatsAppStatus(token: string): Promise<WhatsAppStatus> {
  const res = await fetch(`${getBaseUrl()}/whatsapp/status`, {
    headers: getAuthHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseApiError(err, "Error al cargar el estado de WhatsApp"));
  }
  return res.json();
}

export async function connectWhatsApp(
  token: string,
  phone: string,
): Promise<ConnectWhatsAppResponse> {
  const res = await fetch(`${getBaseUrl()}/whatsapp/connect`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseApiError(err, "No se pudo activar el asistente"));
  }
  return res.json();
}

export async function disconnectWhatsApp(token: string): Promise<{ success: true }> {
  const res = await fetch(`${getBaseUrl()}/whatsapp/disconnect`, {
    method: "POST",
    headers: getAuthHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(parseApiError(err, "No se pudo desconectar"));
  }
  return res.json();
}
