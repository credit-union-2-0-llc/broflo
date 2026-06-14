import { IsString, IsOptional, IsInt, IsUrl, IsEmail } from 'class-validator';

export class PlaceOrderDto {
  @IsString()
  productUrl!: string;

  @IsString()
  productTitle!: string;

  @IsInt()
  productPriceCents!: number;

  @IsString()
  @IsOptional()
  productImageUrl?: string;

  @IsInt()
  @IsOptional()
  shippingCents?: number;

  @IsString()
  @IsOptional()
  shippingAddress1?: string;

  @IsString()
  @IsOptional()
  shippingAddress2?: string;

  @IsString()
  @IsOptional()
  shippingCity?: string;

  @IsString()
  @IsOptional()
  shippingState?: string;

  @IsString()
  @IsOptional()
  shippingZip?: string;

  @IsString()
  @IsOptional()
  shippingCountry?: string;

  @IsString()
  @IsOptional()
  retailerSlug?: string;

  @IsString()
  @IsOptional()
  recipientName?: string;

  @IsEmail()
  @IsOptional()
  recipientEmail?: string;

  @IsString()
  @IsOptional()
  giftRecordId?: string;

  @IsString()
  @IsOptional()
  personId?: string;
}