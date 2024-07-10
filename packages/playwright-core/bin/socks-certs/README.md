# Certfificates for Socks Proxy

These certificates are used when client certificates are used with
Playwright. Playwright then creates a Socks proxy, which sits between
the browser and the actual target server. The Socks proxy uses this certificiate
to talk to the browser and establishes its own secure TLS connection to the server.
The certificates are generated via:

```bash
openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509 -keyout key.pem -out cert.pem -subj "/CN=localhost"
```
