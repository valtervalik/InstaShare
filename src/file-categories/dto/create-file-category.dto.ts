import { IsString } from 'class-validator';

export class CreateFileCategoryDto {
  @IsString()
  name: string;
}
