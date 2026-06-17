import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { WhatsAppConfig } from '../config/whatsapp.config';
import type {
  ActiveFlow,
  FlowGuardDecision,
  IntentClassification,
  WhatsAppIntent,
} from './routing.types';
import {
  activeFlowToIntent,
  isReadIntent,
  isWriteIntent,
} from './routing.types';

@Injectable()
export class WhatsAppFlowGuardService {
  private readonly confidenceThreshold: number;
  private readonly cancellationConfidenceThreshold: number;
  private readonly topicChangeConfidenceThreshold: number;

  constructor(config: ConfigService) {
    const wa = config.get<WhatsAppConfig>('whatsapp');
    this.confidenceThreshold = wa?.confidenceThreshold ?? 0.55;
    this.cancellationConfidenceThreshold =
      wa?.cancellationConfidenceThreshold ?? 0.7;
    this.topicChangeConfidenceThreshold =
      wa?.topicChangeConfidenceThreshold ?? 0.8;
  }

  evaluate(
    classification: IntentClassification,
    activeFlow: ActiveFlow,
  ): FlowGuardDecision {
    const { intent, confidence, reasoning } = classification;

    if (intent === 'cancelar_reiniciar') {
      if (confidence >= this.cancellationConfidenceThreshold) {
        return {
          action: 'reset_session',
          intent,
          confidence,
          reasoning,
        };
      }
      if (activeFlow !== 'none') {
        return {
          action: 'continue_flow',
          intent: activeFlowToIntent(activeFlow) ?? 'unknown',
          confidence: 1,
          reasoning: 'Cancelación ambigua; se mantiene el flujo activo.',
        };
      }
    }

    if (intent === 'saludo_inicio' && activeFlow === 'none') {
      return {
        action: 'reset_session',
        intent,
        confidence,
        reasoning,
      };
    }

    if (activeFlow !== 'none') {
      const flowIntent = activeFlowToIntent(activeFlow);

      if (
        intent === flowIntent ||
        (intent === 'unknown' && confidence < this.confidenceThreshold)
      ) {
        return {
          action: 'continue_flow',
          intent: flowIntent ?? 'unknown',
          confidence: Math.max(confidence, 0.85),
          reasoning:
            reasoning ||
            'Mensaje interpretado como continuación del flujo activo.',
        };
      }

      if (
        this.isClearTopicChange(intent, confidence) &&
        intent !== 'cancelar_reiniciar' &&
        intent !== 'saludo_inicio'
      ) {
        return {
          action: 'route_new_intent',
          intent,
          confidence,
          reasoning,
        };
      }

      if (confidence < this.confidenceThreshold) {
        return {
          action: 'needs_clarification',
          intent: flowIntent ?? 'unknown',
          confidence,
          reasoning,
        };
      }

      return {
        action: 'continue_flow',
        intent: flowIntent ?? 'unknown',
        confidence,
        reasoning:
          'Flujo activo tiene precedencia sobre intención nueva ambigua.',
      };
    }

    if (
      confidence < this.confidenceThreshold &&
      intent !== 'general_chat' &&
      intent !== 'unknown' &&
      intent !== 'saludo_inicio'
    ) {
      return {
        action: 'needs_clarification',
        intent,
        confidence,
        reasoning,
      };
    }

    return {
      action: 'route_new_intent',
      intent,
      confidence,
      reasoning,
    };
  }

  private isClearTopicChange(intent: WhatsAppIntent, confidence: number): boolean {
    if (confidence < this.topicChangeConfidenceThreshold) return false;
    return isReadIntent(intent) || isWriteIntent(intent) || intent === 'general_chat';
  }
}
