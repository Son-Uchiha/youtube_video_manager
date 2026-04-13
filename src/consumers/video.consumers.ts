import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { VideoService } from 'src/video/video.service';

@Processor('VIDEO')
export class VideoConsumers extends WorkerHost {
  constructor(private readonly videoService: VideoService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'video-info') {
      console.log(job.data);
      const { id } = job.data;
      console.log('UPDATE VIDEO');
      await this.videoService.upadteInfoVideo(id);
    }
    return {}; // coi là hoàn thành
  }
}
