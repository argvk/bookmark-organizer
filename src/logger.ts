import pino, { type Logger as PinoLogger } from 'pino';

const isDebugEnabled = (() => {
  const value = (process.env.DEBUG ?? '').toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
})();

const pinoLogger: PinoLogger = pino({
  level: isDebugEnabled ? 'debug' : 'info',
});

function toMeta(args: unknown[]): Record<string, unknown> | undefined {
  if (!args || args.length === 0) return undefined;
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    return args[0] as Record<string, unknown>;
  }
  const [first, ...rest] = args;
  return { details: first, extra: rest };
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    const meta = toMeta(args);
    if (meta) pinoLogger.info(meta, message);
    else pinoLogger.info(message);
  },
  debug(message: string, ...args: unknown[]): void {
    const meta = toMeta(args);
    if (meta) pinoLogger.debug(meta, message);
    else pinoLogger.debug(message);
  },
  error(message: string, ...args: unknown[]): void {
    const meta = toMeta(args);
    if (meta) pinoLogger.error(meta, message);
    else pinoLogger.error(message);
  },
};

export type Logger = typeof logger;


