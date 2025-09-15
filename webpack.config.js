import path from 'path';
import { fileURLToPath } from 'url';

// Needed for __dirname in ESM:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: './src/layout.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  mode: 'development',
  devServer: {
    static: './dist',
    hot: true,
    port: 8080,        // standardized port
    host: '0.0.0.0',   // listen on all network interfaces
    open: false        // prevent opening browser on VM
  },
  cache: {
    type: 'filesystem'
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      }
    ]
  },
  resolve: {
    extensions: ['.js']
  }
};

