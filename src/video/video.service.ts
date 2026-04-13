import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import moment from 'moment';
import { PrismaService } from 'src/prisma.service';
import { CreateVideo } from './dto/create.dto';
import axios from 'axios';

@Injectable()
export class VideoService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('VIDEO')
    private readonly videoQueue: Queue,
  ) {}

  getVideo(id: number) {
    return this.prisma.video.findUnique({
      where: { id },
    });
  }
  async createVideo({ url }: CreateVideo) {
    if (!url) {
      throw new BadRequestException('URL is required');
    }
    const video = await this.prisma.video.create({
      data: {
        url: url,
      },
    });
    // add job vào hàng đợi
    await this.videoQueue.add(
      'video-info',
      { id: video.id },
      { removeOnComplete: true },
    );
    return video;
  }

  // Tự động update các bản ghi lưu ý số lượng video ko quá nhiều
  async onModuleInit() {
    const videos = await this.prisma.video.findMany();
    for (const video of videos) {
      await this.videoQueue.add(
        'video-info',
        { id: video.id },
        {
          repeat: {
            jobId: `video-${video.id}`,
            pattern: '*/10 * * * * *', // Chạy mỗi 10 giây
          },
          removeOnComplete: true,
        },
      );
    }
  }

  async upadteInfoVideo(id: number) {
    const video = await this.prisma.video.findUnique({
      where: { id },
    });
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    const url = video.url;
    const videoId = this.getVideoId(url as string);
    const videoInfo = await this.getInfoVideo(videoId as string);
    return this.prisma.video.update({
      where: { id },
      data: videoInfo,
    });
  }

  getVideoId(url: string) {
    if (!url) return;
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/,
    );
    return match ? match[1] : null;
  }

  async getInfoVideo(videoId: string) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    try {
      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/videos',
        {
          params: {
            part: 'snippet,contentDetails,statistics',
            id: videoId,
            key: apiKey,
          },
        },
      );
      const { items } = response.data;
      const { statistics, contentDetails, snippet } = items[0];
      return {
        title: snippet.title,
        durations: +moment.duration(contentDetails.duration).asSeconds(),
        views: +statistics.viewCount,
        likes: +statistics.likeCount,
        comments: +statistics.commentCount,
      };

      //   return items;
    } catch {
      throw new NotFoundException('Video not found on YouTube');
    }
  }
}
