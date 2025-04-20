import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/base/base.schema';
import { FileCategory } from 'src/file-categories/schemas/file-category.schema';
import { User } from 'src/users/schemas/user.schema';

export type FileDocument = HydratedDocument<File>;

@Schema({ timestamps: true })
export class File extends BaseSchema {
  @Prop({ type: String })
  filename: string;

  @Prop({ type: Number })
  size: number;

  @Prop({ type: String })
  ref: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'FileCategory' })
  category: FileCategory;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  createdBy: User;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  updatedBy: User;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  deletedBy: User;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  restoredBy: User;
}

export const FileSchema = SchemaFactory.createForClass(File);
