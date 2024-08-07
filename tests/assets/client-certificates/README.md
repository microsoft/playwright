# Client Certificate test-certificates

## Server

```bash
openssl req \
	-x509 \
	-newkey rsa:4096 \
	-keyout server/server_key.pem \
	-out server/server_cert.pem \
	-nodes \
	-days 365 \
	-subj "/CN=localhost/O=Client\ Certificate\ Demo" \
	-addext "subjectAltName=DNS:localhost,DNS:local.playwright"
```

## Trusted client-certificate (server signed/valid)

```
mkdir -p client/trusted
# generate server-signed (valid) certifcate
openssl req \
	-newkey rsa:4096 \
	-keyout client/trusted/key.pem \
	-out client/trusted/csr.pem \
	-nodes \
	-days 365 \
	-subj "/CN=Alice"

# sign with server_cert.pem
openssl x509 \
	-req \
	-in client/trusted/csr.pem \
	-CA server/server_cert.pem \
	-CAkey server/server_key.pem \
	-out client/trusted/cert.pem \
	-set_serial 01 \
	-days 365
# create pfx
openssl pkcs12 -export -out client/trusted/cert.pfx -inkey client/trusted/key.pem -in client/trusted/cert.pem -passout pass:secure
```

## Self-signed certificate (invalid)

```
mkdir -p client/self-signed
openssl req \
	-newkey rsa:4096 \
	-keyout client/self-signed/key.pem \
	-out client/self-signed/csr.pem \
	-nodes \
	-days 365 \
	-subj "/CN=Bob"

# sign with self-signed/key.pem
openssl x509 \
	-req \
	-in client/self-signed/csr.pem \
	-signkey client/self-signed/key.pem \
	-out client/self-signed/cert.pem \
	-days 365
```
