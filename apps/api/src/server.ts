import 'dotenv/config';
import { runApiServer } from './app-runtime';

runApiServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('API server failed to start', error);
  process.exit(1);
});
