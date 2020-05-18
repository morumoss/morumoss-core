import express from 'express';

const app = express();

app.get('*', async (req, res) => {
  // update status to building
  res.json({ foo: 'bar' });
});

app.listen(8000, () => console.log('listening on port 8000'));
