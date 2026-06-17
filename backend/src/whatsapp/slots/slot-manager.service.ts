import { Injectable } from '@nestjs/common';
import type { ToolRegistryEntry } from '../tools/tool.registry';
import {
  CONFIRM_NO,
  CONFIRM_YES,
  type SlotFillState,
  type SlotManagerResult,
} from './slot.types';
import {
  hasValidCreateTaskSlots,
  isValidCourseName,
  isValidDeadline,
  isValidTaskTitle,
  sanitizeSlotsForTool,
} from './slot-value-validator';

@Injectable()
export class WhatsAppSlotManagerService {
  evaluate(
    tool: ToolRegistryEntry,
    current: SlotFillState | null,
    extracted: Record<string, unknown>,
    userMessage: string,
  ): SlotManagerResult {
    let flow = current?.toolName === tool.name ? { ...current } : null;

    if (
      flow?.awaitingConfirmation &&
      !CONFIRM_YES.test(userMessage.trim()) &&
      !CONFIRM_NO.test(userMessage.trim()) &&
      userMessage.trim().length > 3
    ) {
      flow = {
        ...flow,
        awaitingConfirmation: false,
        awaitingSlot: undefined,
        slots: sanitizeSlotsForTool(tool.name, flow.slots),
      };
    }

    const baseSlots = flow ? { ...flow.slots } : {};
    let mergedSlots = sanitizeSlotsForTool(tool.name, {
      ...baseSlots,
      ...extracted,
    });

    mergedSlots = this.applyDeterministicReply(
      mergedSlots,
      flow?.awaitingConfirmation ? undefined : flow?.awaitingSlot,
      userMessage,
    );
    mergedSlots = sanitizeSlotsForTool(tool.name, mergedSlots);

    if (flow?.awaitingConfirmation) {
      if (CONFIRM_YES.test(userMessage.trim())) {
        if (tool.name === 'create_task' && !hasValidCreateTaskSlots(flow.slots)) {
          const missing = this.firstMissingSlot(tool.name, sanitizeSlotsForTool(tool.name, flow.slots));
          return {
            action: 'ask',
            missingSlot: missing ?? 'title',
            mergedSlots: sanitizeSlotsForTool(tool.name, flow.slots),
          };
        }
        return {
          action: 'execute',
          mergedSlots: sanitizeSlotsForTool(tool.name, flow.slots),
        };
      }
      if (CONFIRM_NO.test(userMessage.trim())) {
        return {
          action: 'cancel',
          mergedSlots: {},
          message: 'Ok, cancelé. Si quieres, podemos empezar de nuevo.',
        };
      }
    }

    const missingSlot = this.firstMissingSlot(tool.name, mergedSlots, tool);

    if (missingSlot) {
      return { action: 'ask', missingSlot, mergedSlots };
    }

    if (tool.name === 'create_task' && !hasValidCreateTaskSlots(mergedSlots)) {
      const retry = this.firstMissingSlot(tool.name, mergedSlots, tool) ?? 'title';
      return { action: 'ask', missingSlot: retry, mergedSlots };
    }

    const validation = tool.argsSchema.safeParse(mergedSlots);
    if (!validation.success) {
      const path = validation.error.issues[0]?.path?.[0];
      if (typeof path === 'string') {
        return { action: 'ask', missingSlot: path, mergedSlots };
      }
    }

    if (tool.requiresConfirmation) {
      return { action: 'confirm', mergedSlots };
    }

    return { action: 'execute', mergedSlots };
  }

  private firstMissingSlot(
    toolName: string,
    slots: Record<string, unknown>,
    tool?: ToolRegistryEntry,
  ): string | undefined {
    const order = tool?.requiredSlots?.length
      ? tool.requiredSlots
      : this.fallbackSlotOrder(toolName);

    for (const slot of order) {
      if (!this.isSlotFilled(toolName, slot, slots)) return slot;
    }
    return undefined;
  }

  private fallbackSlotOrder(toolName: string): string[] {
    switch (toolName) {
      case 'edit_task':
        return ['task_title', 'field', 'new_value'];
      case 'create_task':
        return ['title', 'course_name', 'deadline'];
      case 'schedule_reminder':
        return ['title', 'remind_at'];
      default:
        return [];
    }
  }

  private isSlotFilled(
    toolName: string,
    slot: string,
    slots: Record<string, unknown>,
  ): boolean {
    const value = slots[slot];
    if (value === undefined || value === null || String(value).trim() === '') {
      return false;
    }

    if (slot === 'title' || slot === 'task_title') return isValidTaskTitle(value);
    if (slot === 'course_name') return isValidCourseName(value);
    if (slot === 'deadline' || slot === 'remind_at') return isValidDeadline(value);
    if (slot === 'field') {
      return ['title', 'deadline', 'course_name'].includes(String(value));
    }
    if (slot === 'new_value') {
      const field = String(slots.field ?? '');
      if (field === 'title') return isValidTaskTitle(value);
      if (field === 'course_name') return isValidCourseName(value);
      if (field === 'deadline') return isValidDeadline(value);
      return String(value).trim().length >= 2;
    }

    if (toolName === 'schedule_reminder' && slot === 'title') {
      return String(value).trim().length >= 3;
    }

    return true;
  }

  /** Solo respuestas deterministas (opciones numeradas en edición). */
  private applyDeterministicReply(
    slots: Record<string, unknown>,
    awaitingSlot: string | undefined,
    userMessage: string,
  ): Record<string, unknown> {
    if (!awaitingSlot) return slots;

    const reply = userMessage.trim();
    if (!reply || CONFIRM_YES.test(reply) || CONFIRM_NO.test(reply)) {
      return slots;
    }

    const merged = { ...slots };

    if (awaitingSlot === 'field') {
      const f = reply.toLowerCase();
      if (/^1\b|t[ií]tulo/.test(f)) merged.field = 'title';
      else if (/^2\b|fecha/.test(f)) merged.field = 'deadline';
      else if (/^3\b|curso|materia/.test(f)) merged.field = 'course_name';
    }

    return merged;
  }
}
