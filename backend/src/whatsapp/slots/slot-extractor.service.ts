import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { ToolRegistryEntry } from '../tools/tool.registry';
import { WhatsAppLlmService } from '../llm/whatsapp-llm.service';

const SlotExtractionSchema = z.object({
  slots: z.record(z.string(), z.unknown()),
  reasoning: z.string(),
});

export interface SlotExtractionContext {
  userMessage: string;
  existingSlots: Record<string, unknown>;
  recentTurns: Array<{ role: string; content: string }>;
  awaitingSlot: string | null;
  awaitingConfirmation: boolean;
  conversationSummary: string | null;
}

const SLOT_EXTRACTION_SYSTEM_PROMPT = `Eres un extractor de argumentos para herramientas de un asistente universitario por WhatsApp.

Tu trabajo es extraer SOLO los valores semánticos correctos de slots a partir del mensaje actual y el historial reciente.
NO copies fragmentos literales del mensaje si no son el valor real del slot.
NO inventes datos que el usuario no haya dicho.

Reglas:
- Usa el historial para rellenar slots mencionados en turnos anteriores aunque el mensaje actual solo traiga un dato nuevo.
- Si el bot preguntó por un slot específico (esperando_slot), interpreta la respuesta del usuario como valor de ese slot.
- Para fechas, normaliza a formato ISO-8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm) cuando sea posible.
- Para títulos de tarea, extrae solo el nombre de la tarea, no verbos ni frases completas de comando.
- Para nombres de curso, extrae solo el nombre/código del curso, no frases como "crea una tarea".
- Devuelve slots vacíos {} si no hay información nueva o corregida.

Responde en JSON: { "slots": { ... }, "reasoning": "breve explicación en español" }`;

@Injectable()
export class WhatsAppSlotExtractorService {
  private readonly logger = new Logger(WhatsAppSlotExtractorService.name);

  constructor(private readonly llmService: WhatsAppLlmService) {}

  async extract(
    tool: ToolRegistryEntry,
    context: SlotExtractionContext,
  ): Promise<Record<string, unknown>> {
    if (tool.kind !== 'write') {
      return {};
    }

    const llm = this.llmService.createChat('fast', 0);
    const extractor = llm.withStructuredOutput(SlotExtractionSchema, {
      name: 'whatsapp_slot_extraction',
      strict: true,
    });

    const slotFields = tool.requiredSlots.length
      ? tool.requiredSlots.join(', ')
      : Object.keys(tool.slotPrompts).join(', ');

    const userPayload = JSON.stringify(
      {
        herramienta: tool.name,
        slots_requeridos: slotFields,
        mensaje_actual: context.userMessage,
        slots_existentes: context.existingSlots,
        historial_reciente: context.recentTurns,
        esperando_slot: context.awaitingSlot,
        esperando_confirmacion: context.awaitingConfirmation,
        resumen_conversacion: context.conversationSummary,
      },
      null,
      2,
    );

    const result = await extractor.invoke([
      { role: 'system', content: SLOT_EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: userPayload },
    ]);

    const merged = { ...context.existingSlots, ...result.slots };

    this.logger.debug(
      `Slots ${tool.name}: ${JSON.stringify(merged)} — ${result.reasoning}`,
    );

    return merged;
  }
}
