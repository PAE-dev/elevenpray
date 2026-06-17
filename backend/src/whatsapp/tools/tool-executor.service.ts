import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { User } from '../../users/entities/user.entity';
import { WhatsAppToolsService } from '../whatsapp-tools.service';
import {
  createToolRegistry,
  getToolByIntent,
  type ToolRegistryEntry,
} from './tool.registry';
import type { WhatsAppIntent } from '../router/routing.types';

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data: unknown;
  validationErrors?: string[];
}

@Injectable()
export class WhatsAppToolExecutorService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppToolExecutorService.name);
  private registry!: Map<string, ToolRegistryEntry>;

  constructor(private readonly toolsService: WhatsAppToolsService) {}

  onModuleInit(): void {
    this.registry = createToolRegistry({
      listTasks: (ctx) =>
        this.toolsService.listTasks(ctx.user.id, ctx.args),
      createTask: (ctx) =>
        this.toolsService.createTask(ctx.user.id, ctx.args),
      editTask: (ctx) =>
        this.toolsService.editTask(ctx.user.id, ctx.args),
      getCourses: (ctx) =>
        this.toolsService.getCoursesToolPayload(ctx.user.id),
      listCourses: (ctx) =>
        this.toolsService.listCourses(ctx.user.id, ctx.args),
      getCurriculum: (ctx) =>
        this.toolsService.getCurriculum(ctx.user.id),
      scheduleReminder: (ctx) =>
        this.toolsService.scheduleReminder(ctx.user.id, ctx.args),
    });
  }

  getRegistry(): Map<string, ToolRegistryEntry> {
    return this.registry;
  }

  getByName(name: string): ToolRegistryEntry | undefined {
    return this.registry.get(name);
  }

  getByIntent(intent: WhatsAppIntent): ToolRegistryEntry | undefined {
    return getToolByIntent(this.registry, intent);
  }

  getAllTools(): ToolRegistryEntry[] {
    return [...this.registry.values()];
  }

  validateArgs(
    toolName: string,
    args: Record<string, unknown>,
  ): { success: true; data: Record<string, unknown> } | { success: false; missing: string[]; errors: string[] } {
    const tool = this.registry.get(toolName);
    if (!tool) {
      throw new BadRequestException(`Tool desconocida: ${toolName}`);
    }

    const parsed = tool.argsSchema.safeParse(args);
    if (parsed.success) {
      return { success: true, data: parsed.data as Record<string, unknown> };
    }

    const missing: string[] = [];
    const errors: string[] = [];

    for (const slot of tool.requiredSlots) {
      const val = args[slot];
      if (val === undefined || val === null || String(val).trim() === '') {
        missing.push(slot);
      }
    }

    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }

    return { success: false, missing, errors };
  }

  async execute(
    user: User,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const tool = this.registry.get(toolName);
    if (!tool) {
      throw new BadRequestException(`Tool desconocida: ${toolName}`);
    }

    const validation = this.validateArgs(toolName, args);
    if (!validation.success) {
      return {
        toolName,
        success: false,
        data: { missing: validation.missing, errors: validation.errors },
        validationErrors: validation.errors,
      };
    }

    try {
      this.logger.log(`Ejecutando ${toolName} para user ${user.id}`);
      const data = await tool.execute({ user, args: validation.data });
      return { toolName, success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tool ${toolName} falló: ${message}`);
      return { toolName, success: false, data: { error: message } };
    }
  }
}
