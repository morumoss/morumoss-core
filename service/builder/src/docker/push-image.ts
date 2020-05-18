import { Image } from 'dockerode';
import logger from '@openkata/logger';

interface BuildOptions {
  id: string;
  image: Image;
}

export const pushImage = async (opt: BuildOptions): Promise<void> => {
  logger.debug('Pushing image to repository');
  await opt.image.push({
    tag: opt.id,
  });
  logger.debug('Successfully pushed to repository');
};
