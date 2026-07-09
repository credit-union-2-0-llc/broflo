import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTrackingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  trackingNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  trackingUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  carrierName?: string;

  // Adding a tracking number usually means it's on its way — default to
  // 'shipped' at the call site, but let the caller override (e.g. a
  // tracking number added right after ordering, before it's actually shipped).
  @IsOptional()
  @IsIn(['ordered', 'processing', 'shipped', 'delivered'])
  status?: 'ordered' | 'processing' | 'shipped' | 'delivered';
}
