module.exports = {
  root: true,
  extends: '@react-native',
  // web/ og admin/ har egne configs/tooling — mobil-lint skal ikke
  // vandre derind (og functions/ er Node, ikke React Native)
  ignorePatterns: ['web/', 'admin/', 'functions/node_modules/'],
  overrides: [
    {
      files: ['functions/**/*.js'],
      env: { node: true },
    },
  ],
};
