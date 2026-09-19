const http = require('http');
const handler = require('serve-handler');
const path = require('path');
const net = require('net');

const START_PORT = parseInt(process.env.PORT, 10) || 4000;

function findFreePort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(port, '0.0.0.0', () => probe.close(() => resolve(port)));
    probe.on('error', () => resolve(findFreePort(port + 1)));
  });
}

findFreePort(START_PORT).then((PORT) => {
  if (PORT !== START_PORT) {
    console.log(`Port ${START_PORT} in use — using ${PORT} instead.`);
  }

  const server = http.createServer((request, response) =>
    handler(request, response, {
      public: path.join(__dirname, 'build'),
      rewrites: [{ source: '/**', destination: '/index.html' }],
    })
  );

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Local IP: http://192.168.68.88:${PORT}`);
    console.log('For access from other devices on the network, use the Local IP address');
  });
});