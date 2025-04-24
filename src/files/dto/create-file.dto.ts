import { IsMongoId, IsString } from 'class-validator';

export class CreateFileDto {
  @IsString()
  filename: string;

  @IsMongoId()
  category: string;
}
