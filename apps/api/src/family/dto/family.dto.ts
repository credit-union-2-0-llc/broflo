import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateFamilyGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class InviteFamilyMemberDto {
  @IsEmail()
  email!: string;
}
