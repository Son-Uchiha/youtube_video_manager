<div align="center">

# Youtube Video Manager

Backend service quản lý video YouTube theo mô hình bất đồng bộ: nhận URL, lưu record nội bộ, đẩy job vào queue, để worker gọi YouTube Data API và cập nhật metadata vào database.

![NestJS](https://img.shields.io/badge/NestJS-Backend-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Static%20Typing-3178C6?logo=typescript&logoColor=white)
![BullMQ](https://img.shields.io/badge/BullMQ-Queue-0F172A)
![Redis](https://img.shields.io/badge/Redis-Job%20Store-DC382D?logo=redis&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB-Database-003545?logo=mariadb&logoColor=white)

</div>

## Tổng quan

`Youtube Video Manager` không được thiết kế như một API proxy gọi thẳng YouTube rồi trả kết quả ngay trong request. Theo source hiện tại, project đi theo hướng:

- API chỉ nhận request và tạo record ban đầu.
- Queue giữ vai trò trung gian cho tác vụ nền.
- Worker gọi YouTube Data API và cập nhật lại dữ liệu.
- Database lưu snapshot metadata để hệ thống nội bộ đọc lại nhanh hơn.

Điểm cốt lõi của dự án là dùng `BullMQ + Redis` ngay từ đầu để giải bài toán đồng bộ dữ liệu theo thời gian, thay vì chỉ đọc dữ liệu tức thời một lần.

## Highlights

- Tạo video mới qua `POST /video`
- Validate URL YouTube bằng `Zod`
- Lưu dữ liệu qua `Prisma` vào `MariaDB`
- Đẩy job `video-info` vào queue `VIDEO`
- Worker xử lý nền và gọi `YouTube Data API`
- Refresh dữ liệu định kỳ bằng repeatable jobs

## Tech Stack

| Công nghệ | Vai trò trong dự án |
| --- | --- |
| `NestJS` | Framework backend cho API server và worker |
| `TypeScript` | Ngôn ngữ chính của codebase |
| `BullMQ` | Queue, producer, consumer, repeatable jobs |
| `Redis` | Backend lưu trạng thái queue/job |
| `Prisma` | Truy cập database |
| `MariaDB` | Database chính của hệ thống |
| `Axios` | Gọi YouTube Data API |
| `Zod` | Validate request input |
| `moment` | Convert duration từ YouTube API sang giây |

## Vì sao dùng BullMQ + Redis thay vì gọi YouTube API trực tiếp

Theo source hiện tại, luồng thực tế của `POST /video` là:

1. API nhận URL video.
2. Service lưu record vào bảng `Video`.
3. Service add job `video-info` vào queue `VIDEO`.
4. Worker nhận job.
5. Worker gọi YouTube API.
6. Worker update metadata vào database.

Project chọn `BullMQ + Redis` vì đây là bài toán đồng bộ dữ liệu, không phải chỉ là “call API rồi trả response”.

### Lợi ích trực tiếp

- Giảm độ trễ cho request: API chỉ cần validate, lưu DB và enqueue job.
- Tách lỗi external API khỏi request path: lỗi quota, lỗi mạng hoặc response lỗi không làm request phải gánh toàn bộ xử lý.
- Phù hợp với refresh định kỳ: cùng một cơ chế queue dùng được cho đồng bộ lần đầu và cập nhật lặp lại.
- Scale đúng chỗ: có thể scale worker thay vì scale toàn bộ API server.
- Có dữ liệu nội bộ để đọc lại: hệ thống lưu snapshot metadata vào bảng `Video`, không chỉ đóng vai trò passthrough.

### Vai trò riêng của BullMQ và Redis

- `BullMQ` là lớp điều phối job: add job, consume job, repeatable job.
- `Redis` là nơi lưu trạng thái job để API process và worker process cùng nhìn thấy một queue chung.

| So sánh | Gọi trực tiếp trong request | Cách làm của dự án |
| --- | --- | --- |
| Thời gian phản hồi | Phụ thuộc YouTube API | Trả về sau khi lưu DB và enqueue job |
| Độ ổn định | External API chậm là request chậm theo | Lỗi được cô lập ở worker/job |
| Refresh định kỳ | Khó tổ chức | Tận dụng repeatable jobs |
| Mở rộng hệ thống | Khó scale riêng phần nền | Scale worker độc lập |
| Lưu trữ dữ liệu | Dễ thành passthrough API | Có snapshot dữ liệu trong DB |

## Kiến trúc

```text
Client
  |
  v
NestJS API
  |
  +--> lưu video vào MariaDB
  +--> add job vào queue VIDEO
                |
                v
            Redis / BullMQ
                |
                v
             Worker
                |
                v
      gọi YouTube API + update DB
```

### Thành phần chính

| Thành phần | Vai trò | File liên quan |
| --- | --- | --- |
| API server | Nhận request HTTP, validate input, lưu record, enqueue job | `src/main.ts`, `src/app.module.ts`, `src/video/*` |
| Worker | Chạy nền, consume queue và gọi YouTube API | `src/workers/worker.ts`, `src/workers/worker.module.ts`, `src/consumers/video.consumers.ts` |
| Queue `VIDEO` | Trung gian giữa API và worker | `src/video/video.module.ts`, `src/video/video.service.ts` |
| Redis | Lưu trạng thái job cho BullMQ | `src/app.module.ts`, `src/workers/worker.module.ts` |
| Database | Lưu record `Video` và metadata đã đồng bộ | `prisma/schema.prisma`, `src/prisma.service.ts` |

## Quick Start

### 1. Cài dependency

```bash
npm install
```

### 2. Tạo file `.env`

Tạo `.env` từ `.env.example`:

```env
DATABASE_URL="mysql://root:123456@localhost:3307/Youtube_Video_Manager"
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
YOUTUBE_API_KEY=your_youtube_api_key
PORT=3000
```

### 3. Chạy MariaDB

```bash
docker compose -f mariaDB_Youtube.yml -p youtube_video_manager up -d
```

### 4. Chạy Redis

Ví dụ nhanh bằng Docker:

```bash
docker run -d --name youtube-video-manager-redis -p 6379:6379 redis:7
```

### 5. Generate Prisma client và sync schema

```bash
npx prisma generate
npx prisma db push
```

### 6. Chạy API server

```bash
npm run start:dev
```

### 7. Chạy worker

Mở terminal khác:

```bash
npm run start:worker
```

## API

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/video` | Tạo video mới từ URL YouTube |
| `GET` | `/video/:id` | Lấy dữ liệu video đã lưu |
| `GET` | `/` | Endpoint mặc định, trả về `Hello World!` |

Ví dụ request:

```http
POST /video
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

## Flow xử lý

1. `VideoController` nhận request.
2. `CreateVideoDto` validate URL YouTube.
3. `VideoService.createVideo()` tạo record mới trong bảng `Video`.
4. Service add job `video-info` vào queue `VIDEO`.
5. `VideoConsumers` nhận job từ worker process.
6. Worker gọi YouTube API trong `getInfoVideo()`.
7. Dữ liệu được map và update lại vào record `Video`.
8. Client gọi `GET /video/:id` để đọc metadata đã đồng bộ.

## Scheduling

Project hiện không dùng `@nestjs/schedule`. Scheduling được triển khai bằng repeatable jobs của BullMQ trong `VideoService.onModuleInit()`.

Theo source hiện tại:

- hệ thống đọc các video đã có trong database khi module khởi tạo;
- add job `video-info` cho từng video;
- đăng ký lịch chạy mỗi `10` giây qua `repeat.pattern = '*/10 * * * * *'`.

## Database

Project dùng `MariaDB` thông qua `Prisma`.

Model chính hiện tại là `Video` với các trường:

- `id`
- `url`
- `title`
- `durations`
- `views`
- `likes`
- `comments`
- `createdAt`
- `updatedAt`

Luồng dữ liệu:

- API tạo record trước.
- Worker cập nhật metadata sau.
- `GET /video/:id` đọc lại dữ liệu từ database nội bộ.

## Redis + BullMQ

Queue chính của hệ thống là `VIDEO`.

- Producer: `src/video/video.service.ts`
- Consumer: `src/consumers/video.consumers.ts`
- Worker bootstrap: `src/workers/worker.ts`
- Job chính: `video-info`

Theo source hiện tại:

- có `removeOnComplete: true`;
- chưa thấy cấu hình retry/backoff riêng;
- chưa thấy cấu hình concurrency riêng;
- chưa thấy dead-letter queue riêng.

## YouTube API

Project gọi endpoint:

`GET https://www.googleapis.com/youtube/v3/videos`

Các `part` đang dùng:

- `snippet`
- `contentDetails`
- `statistics`

Biến môi trường cần có:

```env
YOUTUBE_API_KEY=your_youtube_api_key
```

Mapping dữ liệu chính:

- `snippet.title` -> `title`
- `contentDetails.duration` -> `durations`
- `statistics.viewCount` -> `views`
- `statistics.likeCount` -> `likes`
- `statistics.commentCount` -> `comments`

## Docker

Repo hiện có file `mariaDB_Youtube.yml` để chạy MariaDB local:

```bash
docker compose -f mariaDB_Youtube.yml -p youtube_video_manager up -d
```

Theo source hiện tại:

- compose chỉ có service `db-mariadb`;
- chưa có service riêng cho app;
- chưa có service riêng cho worker;
- chưa có Redis trong compose hiện tại.

## Cấu trúc thư mục

```text
youtube_video_manager/
├─ src/
│  ├─ consumers/
│  │  └─ video.consumers.ts
│  ├─ video/
│  │  ├─ dto/
│  │  │  └─ create.dto.ts
│  │  ├─ video.controller.ts
│  │  ├─ video.module.ts
│  │  └─ video.service.ts
│  ├─ workers/
│  │  ├─ worker.module.ts
│  │  └─ worker.ts
│  ├─ app.module.ts
│  ├─ main.ts
│  └─ prisma.service.ts
├─ prisma/
│  └─ schema.prisma
├─ mariaDB_Youtube.yml
├─ .env.example
└─ package.json
```

## Roadmap

### Đã có theo source hiện tại

- [x] API tạo video từ URL YouTube
- [x] Validate URL đầu vào bằng `Zod`
- [x] Lưu dữ liệu video vào `MariaDB` qua `Prisma`
- [x] Đẩy job `video-info` vào queue `VIDEO`
- [x] Worker xử lý background job bằng `BullMQ`
- [x] Gọi `YouTube Data API` để đồng bộ metadata
- [x] Refresh dữ liệu định kỳ bằng repeatable jobs

### Hướng phát triển tiếp theo

- [ ] Bổ sung retry và backoff cho job thất bại
- [ ] Tách rõ scheduler registration khỏi API server để tránh đăng ký job lặp lại từ nhiều process
- [ ] Bổ sung logging và monitoring cho queue/worker
- [ ] Thêm trạng thái job hoặc lịch sử đồng bộ để dễ theo dõi
- [ ] Container hóa đầy đủ app, worker và Redis trong Docker Compose
- [ ] Hoàn thiện migration strategy cho Prisma thay vì chỉ dùng `db push`
- [ ] Bổ sung test cho flow API, queue và worker
- [ ] Tối ưu tần suất polling để kiểm soát quota YouTube API tốt hơn

## Những điểm suy luận từ source

1. `start:prod` cần kiểm tra thêm khi chạy thực tế.
   Lý do: `package.json` dùng `node dist/main`, trong khi artefact hiện thấy dưới `dist/src/main.js`.

2. Repeatable jobs có thể được add từ nhiều process nếu cả API và worker cùng load `VideoModule`.
   Lý do: `onModuleInit()` nằm trong `VideoService`, còn `VideoModule` được import ở cả `AppModule` và `WorkerModule`.

3. Hệ thống hiện đang ở mức nền tảng, chưa có nhiều cấu hình vận hành nâng cao.
   Lý do: chưa thấy retry, backoff, dead-letter queue hoặc monitoring riêng trong source.
