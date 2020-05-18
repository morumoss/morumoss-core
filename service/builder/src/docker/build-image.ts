import fs from 'fs-extra';
import tar from 'tar-fs';
import Docker, { Image } from 'dockerode';
import zlib from 'zlib';
import AWS from 'aws-sdk';
import logger from '@openkata/logger';

type PathFunction = (dir: string) => string;

interface DockerFileOptions {
  image: string;
  version: string;
}

interface BuildOptions {
  id: string;
  imageOptions: DockerFileOptions;
  workingDir: string;
  s3: AWS.S3;
  bucket: string;
  registry: {
    url: string;
    workspace: string;
  };
}

const buildDockerfile = ({ image, version }: DockerFileOptions): string =>
  `
    FROM theiaide/theia

    USER theia

    WORKDIR /home/project

    COPY ./src .

    USER root
  `;

const setupWorkDirectory = async ({
  workDir,
  dir,
}: {
  workDir: string;
  dir: string;
}): Promise<{ getPath: PathFunction; clean: () => Promise<void> }> => {
  logger.debug(`create working directory: ${workDir}/${dir}`);
  await fs.ensureDir(`${workDir}/${dir}`);
  return {
    getPath: (path: string): string => `${workDir}/${dir}/${path}`,
    clean: (): Promise<void> => fs.remove(`${workDir}/${dir}`),
  };
};

export const buildImage = async (
  docker: Docker,
  opt: BuildOptions,
): Promise<Image> => {
  const { getPath, clean } = await setupWorkDirectory({
    workDir: opt.workingDir,
    dir: opt.id,
  });
  try {
    // Get Source files
    await new Promise((resolve, reject) => {
      // TODO: error handling
      logger.debug('writing s3 object');
      opt.s3
        .getObject({ Bucket: opt.bucket, Key: opt.id })
        .createReadStream()
        .on('error', (err) => {
          // NoSuchKey: The specified key does not exist
          reject(err);
        })
        .pipe(zlib.createGunzip())
        .on('error', (err) => {
          reject(err);
        })
        .pipe(tar.extract(getPath('src'), {}))
        .on('error', (err) => {
          reject(err);
        })
        .on('finish', () => {
          logger.debug('finished writing s3 object');
          resolve();
        });
    });

    // Builder DockerFile.
    logger.debug('Building Dockerfile');
    const dockerfile = buildDockerfile(opt.imageOptions);
    await fs.writeFile(getPath('DockerFile'), dockerfile);

    logger.debug(await fs.readdir(getPath('src')));

    logger.debug('sending build context to docker');
    const imgContext = await docker.buildImage(
      {
        context: getPath(''),
        src: ['Dockerfile', 'src'],
      },
      {
        t: `${opt.registry.url}/${opt.registry.workspace}:${opt.id}`,
      },
    );
    logger.debug('sending build context to docker');
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(
        imgContext,
        // @ts-ignore
        (err, res) => (err ? reject(err) : resolve(res)),
        // @ts-ignore
        (stream) => logger.debug(JSON.stringify(stream)),
      );
    });
    await clean();
    return docker.getImage(`${opt.registry.url}/${opt.registry.workspace}`);
  } catch (error) {
    logger.error(error);
    await clean();
    throw error;
  }
};
