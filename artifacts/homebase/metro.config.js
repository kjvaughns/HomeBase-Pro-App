const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the workspace node_modules so Metro can follow pnpm symlinks into the
// .pnpm store (e.g. expo-router/entry).  In CI=true mode (dev workflow and
// production build) Metro disables the file watcher entirely, so listing this
// directory here has zero inotify cost — it only affects what Metro is allowed
// to serve over HTTP.
config.watchFolders = [
  path.resolve(workspaceRoot, "node_modules"),
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
