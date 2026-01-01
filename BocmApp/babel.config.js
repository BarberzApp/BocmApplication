module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./app'],
          alias: {
            // Specific aliases must come first to take precedence
            '@/shared': './app/shared',
            '@/components': './app/shared/components',
            '@/hooks': './app/shared/hooks',
            '@/lib': './app/shared/lib',
            '@/types': './app/shared/types',
            '@/utils': './app/shared/utils',
            '@/pages': './app/pages',
            '@/navigation': './app/navigation',
            '@': './app', // Generic alias last
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
}; 