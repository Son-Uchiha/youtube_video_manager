// src/video/dto/create.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const youtubeUrlRegex =
  /(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))[\w-]{11}/;

export const CreateVideoSchema = z.object({
  url: z
    .string()
    .trim()
    .url('URL khong hop le')
    .refine((value) => youtubeUrlRegex.test(value), 'URL YouTube khong hop le'),
});

export class CreateVideoDto extends createZodDto(CreateVideoSchema) {}

export type CreateVideo = z.output<typeof CreateVideoSchema>;
