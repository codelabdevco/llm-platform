import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../common/schemas';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name: string) {
    const exists = await this.userModel.findOne({ email: email.toLowerCase() });
    if (exists) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    const user = await this.userModel.create({ email: email.toLowerCase(), password: hashed, name });
    return this.generateTokens(user);
  }

  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new ForbiddenException('Account deactivated');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.userModel.updateOne({ _id: user._id }, { lastLoginAt: new Date() });
    return this.generateTokens(user);
  }

  async refresh(token: string) {
    try {
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET + '_refresh' });
      const user = await this.userModel.findById(payload.sub);
      if (!user || user.refreshToken !== token) throw new Error();
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.userModel.updateOne({ _id: userId }, { refreshToken: null });
    return { success: true };
  }

  private async generateTokens(user: UserDocument) {
    const payload = { sub: user._id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET + '_refresh',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    });

    await this.userModel.updateOne({ _id: user._id }, { refreshToken });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        preferences: user.preferences,
        totalTokensUsed: user.totalTokensUsed,
        totalCost: user.totalCost,
      },
    };
  }
}
