// Store builds (EAS "production" profile) never show the "Unlock for testing" Premium button.
module.exports = ({ config }) => ({
  ...config,
  extra: { ...config.extra, allowTestUnlock: process.env.EAS_BUILD_PROFILE !== 'production' },
});
