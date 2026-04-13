import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VideoConsumers } from 'src/consumers/video.consumers';
import { VideoModule } from 'src/video/video.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.registerQueue({
      name: 'VIDEO',
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    VideoModule,
  ],
  providers: [VideoConsumers],
})
export class WorkerModule {}
