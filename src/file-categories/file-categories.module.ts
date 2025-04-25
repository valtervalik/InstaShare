import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Params } from 'src/base/base-interfaces';
import { FilesModule } from 'src/files/files.module';
import { FilesService } from 'src/files/files.service';
import { MinioModule } from 'src/minio/minio.module';
import { MinioService } from 'src/minio/minio.service';
import { FileCategoriesController } from './file-categories.controller';
import { FileCategoriesService } from './file-categories.service';
import {
  FileCategory,
  FileCategorySchema,
} from './schemas/file-category.schema';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: FileCategory.name,
        useFactory: (
          filesService: FilesService,
          minioService: MinioService,
        ) => {
          const schema = FileCategorySchema;

          schema.pre<FileCategory & Params>('deleteOne', async function () {
            const id = this._conditions._id;

            const files = await filesService.findAllWithoutPagination({
              category: id,
            });

            if (!files.elements.length) {
              return;
            }

            try {
              for (const file of files.elements) {
                await minioService.deleteFile(file.ref);
              }

              await filesService.removeMany(
                files.elements.map((f) => f._id) as string[],
              );
            } catch (error) {
              throw new Error('Failed to delete associated files');
            }
          });

          return schema;
        },
        imports: [FilesModule, MinioModule],
        inject: [FilesService, MinioService],
      },
    ]),
  ],
  controllers: [FileCategoriesController],
  providers: [FileCategoriesService],
  exports: [MongooseModule],
})
export class FileCategoriesModule {}
