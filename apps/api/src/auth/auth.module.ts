import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({
      secret: (() => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET environment variable is required");
        return secret;
      })(),
      signOptions: { expiresIn: "15m" },
    }),
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    EmailService,
    PrismaService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
