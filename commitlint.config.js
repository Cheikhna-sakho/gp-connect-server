/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'ci', 'revert'],
    ],
    // Allow any case in the subject (no forced lowercase)
    'subject-case': [0],
    // Max length of header line
    'header-max-length': [2, 'always', 100],
  },
};
