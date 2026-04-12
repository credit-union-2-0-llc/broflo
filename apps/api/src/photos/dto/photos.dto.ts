import { IsEnum, IsOptional } from "class-validator";
import { PhotoCategory } from "@prisma/client";

export class UploadPhotoDto {
  @IsOptional()
  @IsEnum(PhotoCategory)
  category?: PhotoCategory;
}
