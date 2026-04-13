import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VideoService } from './video.service';
import { CreateVideoDto } from './dto/create.dto';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post()
  createVideo(@Body() body: CreateVideoDto) {
    return this.videoService.createVideo(body);
  }

  @Get('/:id')
  find(@Param('id') id: number) {
    return this.videoService.getVideo(+id);
  }
}
