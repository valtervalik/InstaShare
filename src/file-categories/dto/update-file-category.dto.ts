import { PartialType } from '@nestjs/mapped-types';
import { CreateFileCategoryDto } from './create-file-category.dto';

export class UpdateFileCategoryDto extends PartialType(CreateFileCategoryDto) {}
