# Certificate with repeated CN attributes

Self-signed certificate whose subject and issuer DNs contain two CN attributes.
Generated with:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout key.pem -out cert.pem \
  -subj "/CN=localhost/CN=secondary-name" -addext "subjectAltName=DNS:localhost"
```
