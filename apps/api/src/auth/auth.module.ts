import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";

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
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    ...(process.env.GOOGLE_CLIENT_ID ? [GoogleStrategy] : []),
    EmailService,
    PrismaService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
