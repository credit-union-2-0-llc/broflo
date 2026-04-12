import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class PlaceOrderDto {
  @IsString()
  suggestionId!: string;

  @IsString()
  personId!: string;

  @IsString()
  eventId!: string;

  @IsString()
  retailerProductId!: string;

  @IsOptional()
  @IsString()
  giftRecordId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  shippingName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  shippingAddress1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shippingAddress2?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  shippingCity!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2)
  shippingState!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(10)
  shippingZip!: string;
}
