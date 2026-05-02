import type { Express } from 'express';

export interface StartApiServerInput {
  app: Express;
  port: number;
  host?: string;
}

export function startApiServer(input: StartApiServerInput): Promise<void> {
  return new Promise((resolve, reject) => {
    const host = input.host ?? '0.0.0.0';
    const server = input.app.listen(input.port, host, () => {
      resolve();
    });

    server.on('error', (error) => {
      reject(error);
    });
  });
}

