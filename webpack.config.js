const path = require('path')
const CopyPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const Dotenv = require('dotenv-webpack')

module.exports = (env) => {
    const isProduction = env.production === true
    const manifestPath = isProduction
        ? 'public/manifest.json'
        : 'public/manifest-dev.json'
    const iconPath = isProduction
        ? 'public/icon-144x144.png'
        : 'public/icon-144x144-dev.png'

    return {
        mode: isProduction ? 'production' : 'development',
        // Точки входа
        entry: {
            background: './src/background/index.ts',
            content: './src/content/content.ts',
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
                    {
                        from: 'public',
                        to: '.',
                        globOptions: {
                            ignore: [
                                '**/icon-144x144*.png',
                                '**/manifest*.json',
                            ],
                        },
                        noErrorOnMissing: true,
                    },
                    {
                        from: iconPath,
                        to: 'icon-144x144.png',
                    },
                    {
                        from: manifestPath,
                        to: 'manifest.json',
                    },
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
}
