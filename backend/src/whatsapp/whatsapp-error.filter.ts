import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch(HttpException)
export class WhatsAppErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let errorMessage = 'Error desconocido';
    if (typeof exceptionResponse === 'string') {
      errorMessage = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const body = exceptionResponse as {
        message?: string | string[];
        error?: string;
      };
      if (body.message) {
        errorMessage = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message;
      } else if (body.error && body.error !== 'Bad Request') {
        errorMessage = body.error;
      }
    }

    response.status(status).json({ error: errorMessage });
  }
}
