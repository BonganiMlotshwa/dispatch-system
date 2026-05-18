const http = require('http');
const handler = require('serve-handler');
const path = require('path');

const PORT = process.env.PORT || 4000;

const server = http.createServer((request, response) => {
  // You can define custom routes here if needed
  return handler(request, response, {
    public: path.join(__dirname, 'build'),
    // Add rewrites for client-side routing (React Router)
    rewrites: [
      { source: '/**', destination: '/index.html' }
    ]
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`Local IP: http://192.168.68.88:${PORT}`);
  console.log('For access from other devices on the network, use the Local IP address');
});