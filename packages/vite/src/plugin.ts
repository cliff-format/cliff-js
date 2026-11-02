import { resolve } from "node:path";
import type { HmrContext, Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { transformCliffModule } from "./module.js";
import { resolveCliffOptions, scanCliffFiles, virtualModuleCode, writeDts } from "./scan.js";
import type { CliffPluginOptions, ResolvedCliffOptions, ScannedCliffFile } from "./types.js";

export function cliff(pluginOptions: CliffPluginOptions = {}): Plugin {
  let options: ResolvedCliffOptions = resolveCliffOptions(pluginOptions);
  let files: ScannedCliffFile[] = [];
  const resolvedVirtualId = "\0" + options.virtualModule;

  const refresh = async (): Promise<void> => {
    files = await scanCliffFiles(options);
    await writeDts(files, options);
  };

  const isCliffId = (id: string): boolean => {
    if (id.includes("?raw")) return false;
    if (!options.include.test(id)) return false;
    return !options.exclude.test(id);
  };

  return {
    name: "cliff-format",
    enforce: "pre",

    configResolved(config: ResolvedConfig) {
      options = resolveCliffOptions(pluginOptions, config.root);
    },

    async buildStart() {
      await refresh();
      for (const file of files) this.addWatchFile(file.absolutePath);
    },

    resolveId(id) {
      return id === options.virtualModule ? resolvedVirtualId : null;
    },

    async load(id) {
      if (id !== resolvedVirtualId) return null;
      if (files.length === 0) await refresh();
      return virtualModuleCode(files, options.virtualModule);
    },

    transform(code, id) {
      if (!isCliffId(id)) return null;
      return transformCliffModule(code, id, options.root);
    },

    configureServer(server: ViteDevServer) {
      for (const directory of options.dirs) {
        server.watcher.add(resolve(options.root, directory));
      }
    },

    async handleHotUpdate(context: HmrContext) {
      if (!isCliffId(context.file)) return;
      await refresh();
      const virtual = context.server.moduleGraph.getModuleById(resolvedVirtualId);
      if (virtual !== undefined) context.server.moduleGraph.invalidateModule(virtual);
      if (options.reloadOnChange) {
        context.server.ws.send({ type: "full-reload" });
      }
      return [];
    },
  };
}

export { transformCliffModule } from "./module.js";
export { resolveCliffOptions, scanCliffFiles, virtualModuleCode, writeDts } from "./scan.js";
export type { CliffPluginOptions } from "./types.js";
