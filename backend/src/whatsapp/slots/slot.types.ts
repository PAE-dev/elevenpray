export interface SlotFillState {
  toolName: string;
  intent: string;
  slots: Record<string, unknown>;
  awaitingConfirmation: boolean;
  /** Slot que el bot acaba de preguntar — solo esa respuesta se asigna al turno siguiente. */
  awaitingSlot?: string;
}

export interface SlotManagerResult {
  action: 'ask' | 'confirm' | 'execute' | 'cancel';
  missingSlot?: string;
  mergedSlots: Record<string, unknown>;
  message?: string;
}

export const CONFIRM_YES = /^(s[ií]|confirmo|ok|dale|yes|y|guardar|listo)$/i;
export const CONFIRM_NO = /^(no|cancelar|cancel|n)$/i;

export const CREATE_TASK_SLOT_ORDER = ['title', 'course_name', 'deadline'] as const;
export const EDIT_TASK_SLOT_ORDER = ['task_title', 'field', 'new_value'] as const;
