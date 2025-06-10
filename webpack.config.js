const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const Dotenv = require('dotenv-webpack')

module.exports = {
    mode: 'production',
    // Точки входа
    entry: {
        background: './src/background/index.ts',
        content: './src/content.ts',
        popup: './src/popup/popup.ts',
    },

    // Куда собирать
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js', // => background.js, content.js, popup.js
        clean: true, // очищает dist перед сборкой
        environment: {
            dynamicImport: false,
            module: false,
        },
    },

    optimization: {
        // Отключаем минификацию которая может использовать eval
        minimize: false,
        moduleIds: 'deterministic',
    },
    // Загрузчики
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'], // поддержка CSS
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },

    // Плагины
    plugins: [
        // Копируем манифест и прочие статики
        new CopyPlugin({
            patterns: [
                { from: 'public', to: '.' }, // public/manifest.json и, например, иконки
            ],
        }),
        new Dotenv(),

        // Генерация popup.html с подключённым popup.js
        new HtmlWebpackPlugin({
            filename: 'popup.html',
            template: 'src/popup/popup.html',
            chunks: ['popup'],
        }),
    ],

    // Оптимизация для продакшна
    mode: 'production',
    devtool: false, // Отключаем source maps для production

    // Не мешать Webpack трогать Node.js-модули (например, если использовать chrome в коде)
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            crypto: false,
            stream: false,
            util: false,
            buffer: false,
            process: false,
        },
    },
}
