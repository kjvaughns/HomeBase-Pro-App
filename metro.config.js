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

const path = require('path');

const FONT_TYPES = { '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2' };

// Rewrite the Host header for any Replit proxy domain to localhost:8081
// so Metro's built-in host validation accepts the request.
config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    const assetsDir = path.resolve(__dirname, 'assets');
    return (req, res, next) => {
      const host = req.headers && req.headers.host;
      if (host && (host.includes('.replit.dev') || host.includes('.replit.app'))) {
        req.headers.host = 'localhost:8081';
      }
      // Serve static font files directly from the assets/ directory so web
      // @font-face requests resolve without going through Metro's asset pipeline.
      const urlPath = req.url.split('?')[0];
      const ext = path.extname(urlPath).toLowerCase();
      if (urlPath.startsWith('/assets/') && FONT_TYPES[ext]) {
        const filePath = path.join(assetsDir, urlPath.slice('/assets/'.length));
        try {
          const data = fs.readFileSync(filePath);
          res.setHeader('Content-Type', FONT_TYPES[ext]);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          res.end(data);
          return;
        } catch (_) {}
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
