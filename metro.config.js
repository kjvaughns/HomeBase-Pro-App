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

// Rewrite the Host header for any Replit proxy domain to localhost:8081
// so Metro's built-in host validation accepts the request.
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      const host = req.headers && req.headers.host;
      if (host && (host.includes('.replit.dev') || host.includes('.replit.app'))) {
        req.headers.host = 'localhost:8081';
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
