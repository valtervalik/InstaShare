import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/base/base.service';
import { File, FileDocument } from './schemas/file.schema';

@Injectable()
export class FilesService extends BaseService<FileDocument>(File.name) {}
