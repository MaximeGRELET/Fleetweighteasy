module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Permet à `src/data/db/migrations/migrations.js` d'importer les fichiers
      // .sql générés par drizzle-kit et de les embarquer dans le bundle.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
