import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';

export const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback,
) => {
  if (!file.originalname.match(/\.(pdf|cer|rar|doc|docx)$/)) {
    return callback(new BadRequestException('Tipo de formato inválido'), false);
  }

  callback(null, true);
};
