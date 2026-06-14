import { IsEmail, IsString } from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  otp!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}