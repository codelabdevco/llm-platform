import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response } from 'express';
import { Conversation, ConversationDocument, Message, MessageDocument, User, UserDocument } from '../common/schemas';
import { ModelsService, calcCost } from '../models/models.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private convModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private msgModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private modelsService: ModelsService,
  ) {}

  // ─── Conversations ───────────────────────────────────────────────
  async getConversations(userId: string) {
    return this.convModel
      .find({ userId, isArchived: false })
      .select('-__v')
      .sort({ isPinned: -1, updatedAt: -1 })
      .lean();
  }

  async createConversation(userId: string, dto: {
    title?: string; model: string; provider: string; systemPrompt?: string;
  }) {
    return this.convModel.create({
      userId: new Types.ObjectId(userId),
      title: dto.title || 'New Chat',
      model: dto.model,
      provider: dto.provider,
      systemPrompt: dto.systemPrompt || '',
    });
  }

  async updateConversation(userId: string, convId: string, dto: Partial<{
    title: string; systemPrompt: string; isPinned: boolean; isArchived: boolean; tags: string[];
  }>) {
    const conv = await this.convModel.findById(convId);
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userId.toString() !== userId) throw new ForbiddenException();
    return this.convModel.findByIdAndUpdate(convId, dto, { new: true });
  }

  async deleteConversation(userId: string, convId: string) {
    const conv = await this.convModel.findById(convId);
    if (!conv) throw new NotFoundException();
    if (conv.userId.toString() !== userId) throw new ForbiddenException();
    await this.msgModel.deleteMany({ conversationId: new Types.ObjectId(convId) });
    await conv.deleteOne();
    return { success: true };
  }

  // ─── Messages ────────────────────────────────────────────────────
  async getMessages(userId: string, convId: string) {
    const conv = await this.convModel.findById(convId);
    if (!conv) throw new NotFoundException();
    if (conv.userId.toString() !== userId) throw new ForbiddenException();
    return this.msgModel.find({ conversationId: new Types.ObjectId(convId) })
      .sort({ createdAt: 1 })
      .lean();
  }

  // ─── Streaming Chat ───────────────────────────────────────────────
  async streamChat(
    userId: string,
    convId: string,
    userMessage: string,
    res: Response,
    attachments: any[] = [],
  ) {
    const conv = await this.convModel.findById(convId);
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.userId.toString() !== userId) throw new ForbiddenException();

    // Check token limit
    const user = await this.userModel.findById(userId);
    if (user.tokenLimit && user.totalTokensUsed >= user.tokenLimit) {
      throw new ForbiddenException('Token limit exceeded. Contact admin.');
    }

    // Save user message
    await this.msgModel.create({
      conversationId: new Types.ObjectId(convId),
      userId: new Types.ObjectId(userId),
      role: 'user',
      content: userMessage,
      attachments,
    });

    // Load history (last 50 messages)
    const history = await this.msgModel
      .find({ conversationId: new Types.ObjectId(convId) })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    const messages = history.map(m => ({ role: m.role as any, content: m.content }));

    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const stream = this.modelsService.streamChat(
        { provider: conv.provider as any, model: conv.model, systemPrompt: conv.systemPrompt },
        messages,
      );

      for await (const chunk of stream) {
        if (chunk.done) {
          inputTokens = chunk.inputTokens || 0;
          outputTokens = chunk.outputTokens || 0;
        } else {
          fullText += chunk.text;
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      // Save assistant message
      const cost = calcCost(conv.model, inputTokens, outputTokens);
      const totalTokens = inputTokens + outputTokens;

      await this.msgModel.create({
        conversationId: new Types.ObjectId(convId),
        userId: new Types.ObjectId(userId),
        role: 'assistant',
        content: fullText,
        model: conv.model,
        provider: conv.provider,
        inputTokens,
        outputTokens,
        cost,
      });

      // Update conversation stats
      await this.convModel.updateOne({ _id: convId }, {
        $inc: { totalTokens, totalCost: cost },
        ...(history.length <= 2 ? { title: userMessage.slice(0, 60) } : {}),
      });

      // Update user stats
      await this.userModel.updateOne({ _id: userId }, {
        $inc: { totalTokensUsed: totalTokens, totalCost: cost },
      });

      res.write(`data: ${JSON.stringify({ done: true, inputTokens, outputTokens, cost })}\n\n`);
      res.end();

    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }

  // ─── Stats ───────────────────────────────────────────────────────
  async getUserStats(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    const convCount = await this.convModel.countDocuments({ userId, isArchived: false });
    const msgCount = await this.msgModel.countDocuments({ userId, role: 'assistant' });
    return {
      totalTokensUsed: user.totalTokensUsed,
      totalCost: user.totalCost,
      conversationCount: convCount,
      messageCount: msgCount,
      tokenLimit: user.tokenLimit,
    };
  }
}
