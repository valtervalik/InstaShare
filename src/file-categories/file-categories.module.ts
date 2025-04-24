import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileCategoriesController } from './file-categories.controller';
import { FileCategoriesService } from './file-categories.service';
import {
  FileCategory,
  FileCategorySchema,
} from './schemas/file-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FileCategory.name, schema: FileCategorySchema },
    ]),
  ],
  controllers: [FileCategoriesController],
  providers: [FileCategoriesService],
  exports: [MongooseModule],
})
export class FileCategoriesModule {}
