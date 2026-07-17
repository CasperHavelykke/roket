module.exports = {
  root: true,
  extends: '@react-native',
  // admin/ har egen config/tooling — mobil-lint skal ikke vandre
  // derind (og functions/ er Node, ikke React Native)
  ignorePatterns: ['admin/', 'functions/node_modules/'],
  overrides: [
    {
      files: ['functions/**/*.js'],
      env: { node: true },
    },
  ],
};
