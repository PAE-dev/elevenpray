import {
  Body,
  Controller,
  Get,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConnectWhatsAppDto } from './dto/connect-whatsapp.dto';
import { WhatsAppErrorFilter } from './whatsapp-error.filter';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
@UseFilters(WhatsAppErrorFilter)
export class WhatsAppController {
  constructor(private readonly service: WhatsAppService) {}

  @Get('status')
  getStatus(@CurrentUser('id') userId: string) {
    return this.service.getStatus(userId);
  }

  @Post('connect')
  connect(@CurrentUser('id') userId: string, @Body() dto: ConnectWhatsAppDto) {
    return this.service.connect(userId, dto.phone);
  }

  @Post('disconnect')
  disconnect(@CurrentUser('id') userId: string) {
    return this.service.disconnect(userId);
  }
}
