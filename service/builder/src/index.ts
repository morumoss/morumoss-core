import { Squiss } from 'squiss-ts';
import Docker from 'dockerode';
import AWS from 'aws-sdk';
import logger from '@openkata/logger';
import {
  QUEUE_URL,
  S3_BUCKET,
  REGISTRY_IMAGE,
  REGISTRY_URL,
  WORK_DIR,
  MINIO_ENDPOINT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
  DOCKER_HOST,
  DOCKER_PORT,
} from './env';
import { buildImage, pushImage } from './docker';

const docker = new Docker({
  protocol: 'http',
  host: DOCKER_HOST,
  port: DOCKER_PORT,
});

const s3 = new AWS.S3({
  accessKeyId: MINIO_ENDPOINT ? MINIO_ACCESS_KEY : undefined,
  secretAccessKey: MINIO_ENDPOINT ? MINIO_SECRET_KEY : undefined,
  endpoint: MINIO_ENDPOINT || undefined,
  s3ForcePathStyle: true, // needed with minio?
  signatureVersion: 'v4',
});

// TODO: really ugly clean this up
const awsConfig =
  process.env.NODE_ENV === 'production'
    ? undefined
    : {
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        region: 'us-east-1',
      };

const workQueue = new Squiss({
  awsConfig,
  queueUrl: QUEUE_URL,
  bodyFormat: 'json',
  // TODO: test what we can handler per worker
  maxInFlight: 1,
});

interface Job {
  id: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseMessage = (msg: any): Job => {
  return {
    id: msg.s3.object.key,
  };
};

workQueue.on('message', async (msg) => {
  const job = parseMessage(msg.body.Records[0]);

  // TODO: process message
  logger.debug(`Received job: ${job.id}`);

  try {
    const image = await buildImage(docker, {
      imageOptions: {
        image: 'node',
        version: '12',
      },
      id: job.id,
      workingDir: WORK_DIR,
      s3,
      bucket: S3_BUCKET,
      registry: {
        url: REGISTRY_URL,
        workspace: REGISTRY_IMAGE,
      },
    });

    await pushImage({
      id: job.id,
      image,
    });

    logger.debug('Cleaning s3 artifacts');
    await s3
      .deleteObject({
        Bucket: S3_BUCKET,
        Key: job.id,
      })
      .promise();
  } catch (error) {
    logger.error(error);
  }
  logger.debug('Removing Message');
  await msg.del();
});

// This handler executes when the process is told to shutdown,
// this happens when ECS stops a task and docker sends SIGTERM to
// the container.
process.on('SIGTERM', () => {
  logger.info('Shutting down SIGTERM');
  // Stop listening for new jobs off the queue.
  workQueue.stop();
});

logger.info('Starting Service');

workQueue.start();
