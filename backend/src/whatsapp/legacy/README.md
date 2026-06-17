# Legacy WhatsApp Agent

`whatsapp-agent.service.ts` fue reemplazado por la arquitectura **Supervisor + registry + subgrafos** (`graph/whatsapp-orchestrator.service.ts`).

- No está registrado en `WhatsAppModule`.
- Mantener solo como referencia histórica hasta el release N+1.
- Rollback: no recomendado; usar `WHATSAPP_SUPERVISOR_ROLLOUT_PERCENT=0` no aplica al agent legacy.
