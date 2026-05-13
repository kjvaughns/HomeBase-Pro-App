const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Only watch specific source dirs, NOT all node_modules (pnpm store has 100k+ files)
config.watchFolders = [
  path.resolve(workspaceRoot, "lib"),
  path.resolve(workspaceRoot, "scripts"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.disableHierarchicalLookup = true;

// Use exactly 1 worker: Metro then requires('./Worker') inline (no fork), eliminating
// child process spawning which hangs in Replit's constrained environment.
config.maxWorkers = 1;

module.exports = config;
