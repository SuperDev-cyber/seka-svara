import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('email')
@Controller('email')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('invite')
  @ApiOperation({ summary: 'Send game invitation email' })
  async sendGameInvitation(
    @Request() req,
    @Body() body: {
      to: string;
      tableName: string;
      joinLink: string;
    },
  ) {
    const inviterName = req.user.username || req.user.email?.split('@')[0] || 'Anonymous';
    
    return this.emailService.sendGameInvitation(
      body.to,
      inviterName,
      body.tableName,
      10, // Default entry fee
      body.joinLink,
    );
  }

  @Post('notification')
  @ApiOperation({ summary: 'Send game notification email' })
  async sendGameNotification(
    @Request() req,
    @Body() body: {
      toEmail: string;
      eventType: 'game_started' | 'game_ended' | 'your_turn' | 'game_won' | 'game_lost';
      gameData: any;
    },
  ) {
    const playerName = req.user.username || req.user.email?.split('@')[0] || 'Anonymous';
    
    return this.emailService.sendGameNotification(
      body.toEmail,
      playerName,
      body.eventType,
      body.gameData,
    );
  }
}
