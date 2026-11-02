export interface CliffPluginOptions {
  root?: string;
  dir?: string;
  dirs?: readonly string[];
  include?: RegExp;
  exclude?: RegExp;
  virtualModule?: string;
  dts?: string | false;
  typegen?: boolean;
  reloadOnChange?: boolean;
}

export interface CliffFileMeta {
  filePath: string;
  namespace: string;
  clan: string;
  locale: string;
  keys: readonly string[];
}

export interface ScannedCliffFile extends CliffFileMeta {
  absolutePath: string;
  text: string;
}

export interface ResolvedCliffOptions {
  root: string;
  dirs: readonly string[];
  include: RegExp;
  exclude: RegExp;
  virtualModule: string;
  dts: string | false;
  typegen: boolean;
  reloadOnChange: boolean;
}

export class CliffPluginError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CliffPluginError";
  }
}
