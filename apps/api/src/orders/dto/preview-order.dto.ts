import { IsString, IsOptional, IsInt, IsUrl } from 'class-validator';

export class PreviewOrderDto {
  @IsUrl()
  productUrl!: string;

  @IsString()
  productTitle!: string;

  @IsInt()
  productPriceCents!: number;

  @IsString()
  @IsOptional()
  suggestionId?: string;
}