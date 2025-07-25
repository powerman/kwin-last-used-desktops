export default [
    {
        files: ['contents/code/**/*.js'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'script',
            globals: {
                workspace: 'readonly',
                registerShortcut: 'readonly',
                console: 'readonly',
                Date: 'readonly',
            },
        },
        rules: {
            // Code quality.
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],
            strict: ['error', 'global'],

            // Style (following modern JS standards).
            'linebreak-style': ['error', 'unix'],
            semi: ['error', 'always'],
            camelcase: ['error', { properties: 'always' }],
            'brace-style': ['error', '1tbs'],
            'comma-dangle': ['error', 'always-multiline'],
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],

            // Allow console for KWin debugging.
            'no-console': 'off',
        },
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            globals: {
                jest: 'readonly',
                describe: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                beforeEach: 'readonly',
                afterAll: 'readonly',
                afterEach: 'readonly',
                global: 'readonly',
                require: 'readonly',
                __dirname: 'readonly',
                console: 'readonly',
            },
        },
        rules: {
            'linebreak-style': ['error', 'unix'],
            semi: ['error', 'always'],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'no-undef': 'error',
            camelcase: 'error',
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],
        },
    },
    {
        files: ['eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
            globals: {
                console: 'readonly',
            },
        },
        rules: {
            'linebreak-style': ['error', 'unix'],
            semi: ['error', 'always'],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'no-undef': 'error',
            camelcase: 'error',
            'prefer-const': 'error',
            'no-var': 'error',
        },
    },
    {
        ignores: ['.cache/**/*', 'node_modules/**/*', 'docs/**/*'],
    },
];
