import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/base/base.service';
import {
  FileCategory,
  FileCategoryDocument,
} from './schemas/file-category.schema';

@Injectable()
export class FileCategoriesService extends BaseService<FileCategoryDocument>(
  FileCategory.name,
) {}
