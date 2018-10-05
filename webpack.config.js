const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
    entry: './index.js',
    output: {
        filename: 'dist/index.js'
    },
    module:{
        rules: [
            {
               use: {
                  loader:'babel-loader',
                  options: { presets: ['es2015'] }
               },
               test: /\.js$/,
               exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new UglifyJsPlugin()
    ]
};
