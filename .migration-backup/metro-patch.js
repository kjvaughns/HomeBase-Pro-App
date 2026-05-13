// Patch fs.watch to gracefully ignore ENOENT on Replit temp dirs
const fs = require('fs');
const originalWatch = fs.watch;
fs.watch = function(filename, options, listener) {
  try {
    return originalWatch.call(this, filename, options, listener);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Return a mock watcher that does nothing
      const EventEmitter = require('events');
      const mock = new EventEmitter();
      mock.close = () => {};
      return mock;
    }
    throw err;
  }
};
