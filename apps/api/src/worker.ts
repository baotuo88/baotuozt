import 'dotenv/config';
import { runWorker } from './app-runtime';

runWorker().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Worker failed to start', error);
  process.exit(1);
});
