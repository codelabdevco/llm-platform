import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, Request, Res, Query, HttpCode
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ChatService } from './chat.service';

class CreateConvDto {
  @IsOptional() @IsString() title?: string;
  @IsString() model: string;
  @IsString() provider: string;
  @IsOptional() @IsString() systemPrompt?: string;
}

class UpdateConvDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() systemPrompt?: string;
  @IsOptional() @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsBoolean() isArchived?: boolean;
  @IsOptional() @IsArray() tags?: string[];
}

class SendMessageDto {
  @IsString() message: string;
}

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private chatService: ChatService) {}

  // Conversations
  @Get('conversations')
  getConversations(@Request() req) {
    return this.chatService.getConversations(req.user.userId);
  }

  @Post('conversations')
  createConversation(@Request() req, @Body() dto: CreateConvDto) {
    return this.chatService.createConversation(req.user.userId, dto);
  }

  @Patch('conversations/:id')
  updateConversation(@Request() req, @Param('id') id: string, @Body() dto: UpdateConvDto) {
    return this.chatService.updateConversation(req.user.userId, id, dto);
  }

  @Delete('conversations/:id')
  @HttpCode(200)
  deleteConversation(@Request() req, @Param('id') id: string) {
    return this.chatService.deleteConversation(req.user.userId, id);
  }

  // Messages
  @Get('conversations/:id/messages')
  getMessages(@Request() req, @Param('id') id: string) {
    return this.chatService.getMessages(req.user.userId, id);
  }

  // Streaming
  @Post('conversations/:id/stream')
  async stream(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    return this.chatService.streamChat(req.user.userId, id, dto.message, res);
  }

  // Stats
  @Get('stats')
  getStats(@Request() req) {
    return this.chatService.getUserStats(req.user.userId);
  }
}
