// Patch fs.watch to gracefully ignore ENOENT on Replit temp dirs
// Must be loaded before Metro's file watcher initializes
const fs = require('fs');
const originalWatch = fs.watch;
fs.watch = function(filename, options, listener) {
  try {
    return originalWatch.call(this, filename, options, listener);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const EventEmitter = require('events');
      const mock = new EventEmitter();
      mock.close = () => {};
      return mock;
    }
    throw err;
  }
};

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};

module.exports = config;
