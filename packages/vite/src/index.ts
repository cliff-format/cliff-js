export { transformCliffModule } from "./module.js";
export { cliff, cliff as default } from "./plugin.js";
export {
  findCliffFiles,
  generateDts,
  resolveCliffOptions,
  scanCliffFile,
  scanCliffFiles,
  virtualModuleCode,
  writeDts,
} from "./scan.js";
export type {
  CliffFileMeta,
  CliffPluginOptions,
  ScannedCliffFile,
} from "./types.js";
export { CliffPluginError } from "./types.js";
