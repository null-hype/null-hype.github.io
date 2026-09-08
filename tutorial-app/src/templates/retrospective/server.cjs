const http = require('node:http');
http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end('<!doctype html><html><body><p>Connecting investigation…</p></body></html>');
}).listen(4174, '0.0.0.0');
