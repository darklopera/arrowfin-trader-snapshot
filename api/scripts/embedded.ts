// embedded-postgres is ESM-only; this project compiles to CommonJS. A real
// dynamic import() (hidden from the TS->CJS transform) loads it.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;

export interface EmbeddedPg {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  createDatabase(name: string): Promise<void>;
}

export async function createEmbedded(opts: {
  databaseDir: string; user: string; password: string; port: number; persistent: boolean;
}): Promise<EmbeddedPg> {
  const mod = await dynamicImport('embedded-postgres');
  const Ctor = mod.default ?? mod;
  return new Ctor(opts) as EmbeddedPg;
}
