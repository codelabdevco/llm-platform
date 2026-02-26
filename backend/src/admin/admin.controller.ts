import {
  Controller, Get, Patch, Delete, Param, Body,
  UseGuards, Request, ForbiddenException, Query
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IsOptional, IsBoolean, IsNumber, IsString } from 'class-validator';
import { User, UserDocument, Conversation, ConversationDocument, Message, MessageDocument } from '../common/schemas';

class UpdateUserDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsNumber() tokenLimit?: number;
}

function adminGuard(req: any) {
  if (req.user.role !== 'admin') throw new ForbiddenException('Admin only');
}

@Controller('admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Conversation.name) private convModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private msgModel: Model<MessageDocument>,
  ) {}

  @Get('users')
  async getUsers(@Request() req, @Query('page') page = '1', @Query('limit') limit = '20') {
    adminGuard(req);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      this.userModel.find().select('-password -refreshToken').skip(skip).limit(parseInt(limit)).lean(),
      this.userModel.countDocuments(),
    ]);
    return { users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) };
  }

  @Patch('users/:id')
  async updateUser(@Request() req, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    adminGuard(req);
    return this.userModel.findByIdAndUpdate(id, dto, { new: true }).select('-password -refreshToken');
  }

  @Delete('users/:id')
  async deleteUser(@Request() req, @Param('id') id: string) {
    adminGuard(req);
    if (id === req.user.userId) throw new ForbiddenException('Cannot delete yourself');
    await this.userModel.findByIdAndDelete(id);
    await this.convModel.deleteMany({ userId: id });
    await this.msgModel.deleteMany({ userId: id });
    return { success: true };
  }

  @Get('stats')
  async getStats(@Request() req) {
    adminGuard(req);
    const [
      totalUsers, activeUsers,
      totalConversations, totalMessages,
      topUsers, costByModel,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ isActive: true }),
      this.convModel.countDocuments(),
      this.msgModel.countDocuments({ role: 'assistant' }),
      this.userModel.find().sort({ totalTokensUsed: -1 }).limit(10)
        .select('name email totalTokensUsed totalCost').lean(),
      this.msgModel.aggregate([
        { $match: { role: 'assistant' } },
        { $group: { _id: '$model', totalTokens: { $sum: { $add: ['$inputTokens', '$outputTokens'] } }, totalCost: { $sum: '$cost' }, count: { $sum: 1 } } },
        { $sort: { totalCost: -1 } },
      ]),
    ]);

    // Total cost & tokens across all users
    const totals = await this.userModel.aggregate([
      { $group: { _id: null, totalCost: { $sum: '$totalCost' }, totalTokens: { $sum: '$totalTokensUsed' } } },
    ]);

    return {
      users: { total: totalUsers, active: activeUsers },
      conversations: totalConversations,
      messages: totalMessages,
      totalCostCents: totals[0]?.totalCost || 0,
      totalTokens: totals[0]?.totalTokens || 0,
      topUsers,
      costByModel,
    };
  }

  @Get('usage')
  async getDailyUsage(@Request() req) {
    adminGuard(req);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.msgModel.aggregate([
      { $match: { role: 'assistant', createdAt: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        messages: { $sum: 1 },
        tokens: { $sum: { $add: ['$inputTokens', '$outputTokens'] } },
        cost: { $sum: '$cost' },
      }},
      { $sort: { _id: 1 } },
    ]);
  }
}
