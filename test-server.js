import http from 'http';

http.get('http://localhost:3000', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    if (res.statusCode >= 400) {
      console.log('Body:', data);
    } else {
      console.log('Body length:', data.length);
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
