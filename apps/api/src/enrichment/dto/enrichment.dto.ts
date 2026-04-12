import {
  IsArray,
  IsString,
  IsUrl,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
  MinLength,
} from "class-validator";

export class ParseWishlistDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsUrl({ protocols: ["https"], require_protocol: true }, { each: true })
  urls!: string[];
}

export class CreateManualTagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tag!: string;
}
