import express from 'express';
import bodyParser from 'body-parser';
import isEmply from 'lodash.isempty';

import AWS from 'aws-sdk';

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
  // send entire app down. Process manager will restart it
  process.exit(1);
});

const sqs = new AWS.SQS({
  endpoint: 'http://alpine-sqs:9324/',
  accessKeyId: '<accessKeyId>',
  secretAccessKey: '<secretAccessKey>',
  region: '<region>',
  s3ForcePathStyle: true, // needed with minio?
  signatureVersion: 'v4',
});

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/:queue', async (req, res) => {
  // update status to building

  console.log(req.params.queue);
  if (isEmply(req.body)) {
    return res.sendStatus(200);
  }

  await sqs
    .sendMessage({
      MessageBody: JSON.stringify(req.body),
      QueueUrl: `http://alpine-sqs:9324/queue/${req.params.queue}`,
    })
    .promise();
  res.sendStatus(200);
});

app.listen(4000, () => {
  console.log('miniosqs started...');
});
