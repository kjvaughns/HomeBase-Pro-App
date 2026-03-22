const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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

const blockList = [
  /[\/\\]\.local[\/\\]/,
  /[\/\\]\.replit[\/\\]/,
  /node_modules[\/\\].*[\/\\]node_modules/,
];

config.resolver = {
  ...config.resolver,
  blockList,
};

config.watchFolders = [__dirname];

config.watcher = {
  ...config.watcher,
  watchman: {
    deferStates: ['hg.update'],
  },
  additionalExts: [],
  healthCheck: {
    enabled: false,
  },
};

module.exports = config;
