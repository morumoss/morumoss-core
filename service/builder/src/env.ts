import dotenv from 'dotenv';

console.log(process.env.NODE_ENV);

dotenv.config({
  path: process.env.NODE_ENV === 'production' ? undefined : '.env.development',
});

// TODO: ensure that we have the required env

export const {
  QUEUE_URL,
  WORK_DIR,
  S3_BUCKET,
  REGISTRY_IMAGE,
  REGISTRY_URL,
  MINIO_ENDPOINT,
  MINIO_SECRET_KEY,
  MINIO_ACCESS_KEY,
  DOCKER_HOST,
  DOCKER_PORT,
} = process.env as { [key: string]: string };
