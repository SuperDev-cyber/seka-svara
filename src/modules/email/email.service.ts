import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // For development, we'll use a mock email service that logs emails instead of sending them
    // In production, you would use a real SMTP service like SendGrid, AWS SES, etc.
    this.transporter = nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      secure: false,
      auth: {
        user: 'test',
        pass: 'test',
      },
    });

    this.logger.log('📧 Mock email service initialized for development');
  }

  async sendGameInvitation(
    toEmail: string,
    inviterName: string,
    tableName: string,
    entryFee: number,
    gameUrl: string,
  ) {
    const subject = `🎰 You're invited to play Seka Svara!`;
    const html = this.generateGameInvitationHTML(
      toEmail,
      inviterName,
      tableName,
      entryFee,
      gameUrl,
    );

    return this.sendEmail(toEmail, subject, html);
  }

  async sendGameNotification(
    toEmail: string,
    playerName: string,
    eventType: 'game_started' | 'game_ended' | 'your_turn' | 'game_won' | 'game_lost',
    gameData: any,
  ) {
    let subject: string;
    let html: string;

    switch (eventType) {
      case 'game_started':
        subject = '🎮 Your Seka Svara game has started!';
        html = this.generateGameStartedHTML(playerName, gameData);
        break;
      case 'game_ended':
        subject = '🏁 Your Seka Svara game has ended!';
        html = this.generateGameEndedHTML(playerName, gameData);
        break;
      case 'your_turn':
        subject = '⏰ It\'s your turn in Seka Svara!';
        html = this.generateYourTurnHTML(playerName, gameData);
        break;
      case 'game_won':
        subject = '🏆 Congratulations! You won!';
        html = this.generateGameWonHTML(playerName, gameData);
        break;
      case 'game_lost':
        subject = '😔 Better luck next time!';
        html = this.generateGameLostHTML(playerName, gameData);
        break;
      default:
        throw new Error(`Unknown event type: ${eventType}`);
    }

    return this.sendEmail(toEmail, subject, html);
  }

  private async sendEmail(to: string, subject: string, html: string) {
    // For development, mock the email sending
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    
    if (isDevelopment) {
      this.logger.log(`📧 MOCK EMAIL SENT (Development Mode):`);
      this.logger.log(`   To: ${to}`);
      this.logger.log(`   Subject: ${subject}`);
      this.logger.log(`   Content: HTML email with game invitation`);
      this.logger.log(`   Game URL: ${html.includes('href=') ? 'Contains game link' : 'No link found'}`);
      
      // Simulate a small delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return { success: true, messageId: 'mock-' + Date.now() };
    }
    
    try {
      const info = await this.transporter.sendMail({
        from: '"Seka Svara Game" <noreply@sekasvara.com>',
        to,
        subject,
        html,
      });

      this.logger.log(`📧 Email sent successfully to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  private generateGameInvitationHTML(
    toEmail: string,
    inviterName: string,
    tableName: string,
    entryFee: number,
    gameUrl: string,
  ): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Join Seka Svara Game</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .game-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎰 Seka Svara</h1>
                <p>You're invited to play!</p>
            </div>
            <div class="content">
                <h2>Hello ${toEmail.split('@')[0]}!</h2>
                <p><strong>${inviterName}</strong> has invited you to join their Seka Svara game table!</p>
                
                <div class="game-info">
                    <h3>🎮 Game Details</h3>
                    <p><strong>Table Name:</strong> ${tableName}</p>
                    <p><strong>Entry Fee:</strong> ${entryFee} USDT</p>
                    <p><strong>Invited by:</strong> ${inviterName}</p>
                </div>
                
                <p>Click the button below to join the game and start playing!</p>
                <a href="${gameUrl}" class="cta-button">🎯 Join Game Now</a>
                
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">${gameUrl}</p>
            </div>
            <div class="footer">
                <p>This invitation was sent from Seka Svara Game Platform</p>
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private generateGameStartedHTML(playerName: string, gameData: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Game Started</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎮 Game Started!</h1>
            </div>
            <div class="content">
                <h2>Hello ${playerName}!</h2>
                <p>Your Seka Svara game has started! Good luck and have fun!</p>
                <p><strong>Table:</strong> ${gameData.tableName || 'Unknown'}</p>
                <p><strong>Entry Fee:</strong> ${gameData.entryFee || 0} USDT</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private generateGameEndedHTML(playerName: string, gameData: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Game Ended</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏁 Game Ended</h1>
            </div>
            <div class="content">
                <h2>Hello ${playerName}!</h2>
                <p>Your Seka Svara game has ended. Thanks for playing!</p>
                <p><strong>Final Pot:</strong> ${gameData.pot || 0} USDT</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private generateYourTurnHTML(playerName: string, gameData: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Your Turn</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .cta-button { display: inline-block; background: #2196F3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⏰ Your Turn!</h1>
            </div>
            <div class="content">
                <h2>Hello ${playerName}!</h2>
                <p>It's your turn in the Seka Svara game! Don't keep other players waiting.</p>
                <a href="${gameData.gameUrl || '#'}" class="cta-button">🎯 Take Your Turn</a>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private generateGameWonHTML(playerName: string, gameData: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>You Won!</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #FFD700 0%, #FFA000 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏆 Congratulations!</h1>
            </div>
            <div class="content">
                <h2>Hello ${playerName}!</h2>
                <p>🎉 Congratulations! You won the Seka Svara game!</p>
                <p><strong>Winnings:</strong> ${gameData.winnings || 0} USDT</p>
                <p>Great job and thanks for playing!</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private generateGameLostHTML(playerName: string, gameData: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Game Over</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #9E9E9E 0%, #757575 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>😔 Game Over</h1>
            </div>
            <div class="content">
                <h2>Hello ${playerName}!</h2>
                <p>Better luck next time! The game didn't go your way this time.</p>
                <p>Don't give up - join another game and try again!</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}
