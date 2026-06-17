import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { RoutineTemplatesModule } from './routine-templates/routine-templates.module';
import { SpacesModule } from './spaces/spaces.module';
import { PagesModule } from './pages/pages.module';
import { ContainersModule } from './containers/containers.module';
import { BlocksModule } from './blocks/blocks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WorkspaceTypesModule } from './workspace-types/workspace-types.module';
import { WorkspaceSubtypesModule } from './workspace-subtypes/workspace-subtypes.module';
import { WorkspacePreferencesModule } from './workspace-preferences/workspace-preferences.module';
import { WorkspaceProductsModule } from './workspace-products/workspace-products.module';
import { WorkspaceCheckinsModule } from './workspace-checkins/workspace-checkins.module';
import { WorkspacePhotosModule } from './workspace-photos/workspace-photos.module';
import { ExpertConsultationModule } from './expert-consultation/expert-consultation.module';
import { CatalogProductsModule } from './catalog-products/catalog-products.module';
import { IngredientConflictsModule } from './ingredient-conflicts/ingredient-conflicts.module';
import { PromptsModule } from './prompts/prompts.module';
import { SkinFaceMappingModule } from './skin-face-mapping/skin-face-mapping.module';
import { LearningModule } from './learning/learning.module';
import { StudyUniversityModule } from './study-university/study-university.module';
import { S3Module } from './s3/s3.module';
import { CommunityModule } from './community/community.module';
import { StudyAiModule } from './study-ai/study-ai.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { StudentActivityModule } from './student-activity/student-activity.module';
import { EmotionalCheckinsModule } from './emotional-checkins/emotional-checkins.module';
import { DayEntriesModule } from './day-entries/day-entries.module';
import { InternalResourcesModule } from './internal-resources/internal-resources.module';
import { ReferralsModule } from './referrals/referrals.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ...(process.env.DATABASE_URL?.includes('supabase.co')
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
      autoLoadEntities: true,
      synchronize: false,
    }),
    UsersModule,
    S3Module,
    AuthModule,
    WorkspaceTypesModule,
    WorkspaceSubtypesModule,
    WorkspacesModule,
    WorkspacePreferencesModule,
    WorkspaceProductsModule,
    WorkspaceCheckinsModule,
    WorkspacePhotosModule,
    ExpertConsultationModule,
    CatalogProductsModule,
    IngredientConflictsModule,
    PromptsModule,
    SkinFaceMappingModule,
    LearningModule,
    StudyUniversityModule,
    RoutineTemplatesModule,
    SpacesModule,
    PagesModule,
    ContainersModule,
    BlocksModule,
    DashboardModule,
    CommunityModule,
    StudyAiModule,
    CurriculumModule,
    StudentActivityModule,
    EmotionalCheckinsModule,
    DayEntriesModule,
    InternalResourcesModule,
    ReferralsModule,
    WhatsAppModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
