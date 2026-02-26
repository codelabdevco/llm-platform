import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// ─── User ────────────────────────────────────────────────────────
export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: ['admin', 'user'], default: 'user' })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  totalTokensUsed: number;

  @Prop({ default: 0 })
  totalCost: number; // in USD cents

  @Prop({ default: null })
  tokenLimit: number; // null = unlimited

  @Prop({ type: Object, default: {} })
  preferences: {
    defaultModel?: string;
    defaultProvider?: string;
    theme?: string;
    language?: string;
  };

  @Prop()
  lastLoginAt: Date;

  @Prop()
  refreshToken: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// ─── Conversation ─────────────────────────────────────────────────
export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, default: 'New Chat' })
  title: string;

  @Prop({ required: true })
  model: string; // e.g. "claude-sonnet-4-20250514"

  @Prop({ required: true })
  provider: string; // "anthropic" | "openai" | "google" | "ollama"

  @Prop({ default: '' })
  systemPrompt: string;

  @Prop({ default: false })
  isPinned: boolean;

  @Prop({ default: false })
  isArchived: boolean;

  @Prop({ default: 0 })
  totalTokens: number;

  @Prop({ default: 0 })
  totalCost: number;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// ─── Message ─────────────────────────────────────────────────────
export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ enum: ['user', 'assistant', 'system'], required: true })
  role: string;

  @Prop({ required: true })
  content: string;

  @Prop()
  model: string;

  @Prop()
  provider: string;

  @Prop({ default: 0 })
  inputTokens: number;

  @Prop({ default: 0 })
  outputTokens: number;

  @Prop({ default: 0 })
  cost: number; // USD cents

  @Prop({ type: [Object], default: [] })
  attachments: Array<{ name: string; type: string; url: string }>;

  @Prop({ default: false })
  isError: boolean;

  @Prop()
  errorMessage: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: 1 });
