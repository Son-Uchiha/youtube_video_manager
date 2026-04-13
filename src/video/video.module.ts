import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { PrismaService } from 'src/prisma.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'VIDEO',
    }),
  ],
  controllers: [VideoController],
  providers: [VideoService, PrismaService],
  exports: [VideoService],
})
export class VideoModule {}
