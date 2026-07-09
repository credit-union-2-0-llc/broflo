import { IsIn, IsInt, IsOptional, IsString, Min, MinLength, MaxLength } from 'class-validator';

export class CreateManualOrderDto {
  @IsString()
  personId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  productTitle!: string;

  @IsOptional()
  @IsString()
  giftRecordId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  trackingUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  carrierName?: string;

  @IsOptional()
  @IsIn(['ordered', 'processing', 'shipped', 'delivered'])
  status?: 'ordered' | 'processing' | 'shipped' | 'delivered';
}
