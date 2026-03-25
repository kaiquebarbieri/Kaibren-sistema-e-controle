const net = await import('node:net');

const url = process.env.DATABASE_URL || '';
console.log('HAS_DB_URL', Boolean(url));

try {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const port = Number(parsed.port || 3306);
  console.log('HOST', host);
  console.log('PORT', port);

  const socket = net.createConnection({ host, port });
  socket.setTimeout(5000);

  socket.on('connect', () => {
    console.log('TCP_OK');
    socket.end();
  });

  socket.on('timeout', () => {
    console.log('TCP_TIMEOUT');
    socket.destroy();
    process.exit(2);
  });

  socket.on('error', (error) => {
    console.log('TCP_ERR', error.code || error.message);
    process.exit(1);
  });
} catch (error) {
  console.log('PARSE_ERR', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
