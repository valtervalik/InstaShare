import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ActiveUser } from 'src/auth/decorators/active-user.decorator';
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface';
import { apiResponseHandler } from 'src/utils/ApiResponseHandler';
import { CreateFileCategoryDto } from './dto/create-file-category.dto';
import { UpdateFileCategoryDto } from './dto/update-file-category.dto';
import { FileCategoriesService } from './file-categories.service';

@Controller('file-categories')
export class FileCategoriesController {
  constructor(private readonly fileCategoriesService: FileCategoriesService) {}

  @Post()
  async create(
    @Body() createFileCategoryDto: CreateFileCategoryDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    const newCategory = await this.fileCategoriesService.create(
      createFileCategoryDto,
      activeUser,
    );

    return apiResponseHandler(
      `File category created successfully`,
      HttpStatus.CREATED,
      newCategory,
    );
  }

  @Get()
  findAll() {
    return this.fileCategoriesService.findAllWithoutPagination({
      order: 'name',
    });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateFileCategoryDto: UpdateFileCategoryDto,
    @ActiveUser() activeUser: ActiveUserData,
  ) {
    const updatedCategory = await this.fileCategoriesService.update(
      id,
      updateFileCategoryDto,
      { new: true },
      activeUser,
    );

    return apiResponseHandler(
      `File category updated successfully`,
      HttpStatus.OK,
      updatedCategory,
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    await this.fileCategoriesService.remove(id);

    return apiResponseHandler(
      'File category deleted successfully',
      HttpStatus.OK,
    );
  }
}
