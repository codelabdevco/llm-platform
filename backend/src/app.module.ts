import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { User, UserSchema, Conversation, ConversationSchema, Message, MessageSchema } from './common/schemas';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { JwtStrategy } from './auth/jwt.strategy';
import { ChatService } from './chat/chat.service';
import { ChatController } from './chat/chat.controller';
import { ModelsService } from './models/models.service';
import { AdminController } from './admin/admin.controller';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/llm-platform'),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '7d' } }),
    PassportModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 60 }]),
  ],
  controllers: [AuthController, ChatController, AdminController],
  providers: [
    AuthService, ChatService, ModelsService, JwtStrategy,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
