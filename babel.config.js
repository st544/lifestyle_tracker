module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // In Reanimated v4, the worklets babel plugin moved to its own package.
      // This MUST be listed last. If you ever see "Reanimated 2 failed to
      // create a worklet" or animations silently no-op, this line is the
      // first thing to check.
      'react-native-worklets/plugin',
    ],
  };
};
