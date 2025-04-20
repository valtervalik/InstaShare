import { registerAs } from '@nestjs/config';
import { IsString } from 'class-validator';
import validateConfig from 'src/utils/validate-config';
import { FilesConfig } from './files-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  FILES_PATH: string;
}

export default registerAs<FilesConfig>('files', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    path: process.env.FILES_PATH,
  };
});
