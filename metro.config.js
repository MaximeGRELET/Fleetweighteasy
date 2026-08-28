const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Les migrations Drizzle sont des fichiers .sql importés par le bundle.
config.resolver.sourceExts.push('sql');

module.exports = config;
