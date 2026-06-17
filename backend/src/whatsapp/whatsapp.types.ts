export interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

export interface WhatsAppWebhookChange {
  value?: {
    messaging_product?: string;
    metadata?: { phone_number_id?: string };
    messages?: WhatsAppWebhookMessage[];
    statuses?: unknown[];
  };
}

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: WhatsAppWebhookChange[];
  }>;
}
