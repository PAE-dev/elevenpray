import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { Assignment } from '../study-university/entities/assignment.entity';
import { Course } from '../study-university/entities/course.entity';
import { Reminder } from '../study-university/entities/reminder.entity';
import { StudyUniversityModule } from '../study-university/study-university.module';
import { UserUiState } from '../workspace-preferences/entities/user-ui-state.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { User } from '../users/entities/user.entity';
import whatsappConfig from './config/whatsapp.config';
import { ChatDomainHandler } from './domains/chat/chat.handler';
import { CoursesDomainHandler } from './domains/courses/courses.handler';
import { CurriculumDomainHandler } from './domains/curriculum/curriculum.handler';
import { RemindersDomainHandler } from './domains/reminders/reminders.handler';
import { TasksDomainHandler } from './domains/tasks/tasks.handler';
import { WhatsAppOrchestratorService } from './graph/whatsapp-orchestrator.service';
import { WhatsAppLlmService } from './llm/whatsapp-llm.service';
import { WhatsAppContextResolverService } from './memory/context-resolver.service';
import { WhatsAppConversationState } from './memory/entities/whatsapp-conversation-state.entity';
import { WhatsAppSessionPolicyService } from './memory/session-policy.service';
import { WhatsAppGraphCheckpointerService } from './memory/graph-checkpointer.service';
import { WhatsAppHistorySummarizerService } from './memory/history-summarizer.service';
import { WhatsAppMetricsService } from './observability/whatsapp-metrics.service';
import { WhatsAppTraceService } from './observability/whatsapp-trace.service';
import { WhatsAppResponsePresenter } from './presentation/whatsapp-response.presenter';
import { TaskFlowPresenter } from './presentation/task-flow.presenter';
import { ReminderQueueMetricsService } from './queue/queue.metrics';
import { ReminderQueueService } from './queue/reminder-queue.service';
import { WhatsAppFlowGuardService } from './router/flow-guard.service';
import { WhatsAppSupervisorRouterService } from './router/supervisor-router.service';
import { WhatsAppSlotExtractorService } from './slots/slot-extractor.service';
import { WhatsAppSlotManagerService } from './slots/slot-manager.service';
import { WhatsAppSlotStoreService } from './slots/slot-store.service';
import { WhatsAppToolExecutorService } from './tools/tool-executor.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppGraphService } from './whatsapp-graph.service';
import { WhatsAppMetaClient } from './whatsapp-meta.client';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppStudentDataService } from './whatsapp-student-data.service';
import { WhatsAppToolsService } from './whatsapp-tools.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

@Module({
  imports: [
    ConfigModule.forFeature(whatsappConfig),
    TypeOrmModule.forFeature([
      User,
      Reminder,
      Course,
      Assignment,
      UserUiState,
      WhatsAppConversationState,
    ]),
    AuthModule,
    WorkspacesModule,
    StudyUniversityModule,
    CurriculumModule,
  ],
  controllers: [WhatsAppController, WhatsAppWebhookController],
  providers: [
    WhatsAppService,
    WhatsAppMetaClient,
    WhatsAppGraphService,
    WhatsAppOrchestratorService,
    WhatsAppSupervisorRouterService,
    WhatsAppFlowGuardService,
    WhatsAppSessionPolicyService,
    WhatsAppLlmService,
    WhatsAppToolExecutorService,
    WhatsAppToolsService,
    WhatsAppStudentDataService,
    WhatsAppSlotManagerService,
    WhatsAppSlotExtractorService,
    WhatsAppSlotStoreService,
    WhatsAppResponsePresenter,
    TaskFlowPresenter,
    WhatsAppContextResolverService,
    WhatsAppHistorySummarizerService,
    WhatsAppGraphCheckpointerService,
    WhatsAppMetricsService,
    WhatsAppTraceService,
    TasksDomainHandler,
    CoursesDomainHandler,
    CurriculumDomainHandler,
    RemindersDomainHandler,
    ChatDomainHandler,
    ReminderQueueService,
    ReminderQueueMetricsService,
  ],
})
export class WhatsAppModule {}
