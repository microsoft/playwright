# Client Certificate test-certificates

cd "$(dirname "$0")"

## Server

openssl req \
	-x509 \
	-newkey rsa:4096 \
	-keyout server/server_key.pem \
	-out server/server_cert.pem \
	-nodes \
	-days 3650 \
	-subj "/CN=localhost/O=Client\ Certificate\ Demo" \
	-addext "subjectAltName=DNS:localhost,DNS:local.playwright"

## Trusted client-certificate (server signed/valid)

mkdir -p client/trusted
# generate server-signed (valid) certificate
openssl req \
	-newkey rsa:4096 \
	-keyout client/trusted/key.pem \
	-out client/trusted/csr.pem \
	-nodes \
	-days 3650 \
	-subj "/CN=Alice"

# sign with server_cert.pem
openssl x509 \
	-req \
	-in client/trusted/csr.pem \
	-CA server/server_cert.pem \
	-CAkey server/server_key.pem \
	-out client/trusted/cert.pem \
	-set_serial 01 \
	-days 3650
# create pfx
openssl pkcs12 -export -out client/trusted/cert.pfx -inkey client/trusted/key.pem -in client/trusted/cert.pem -passout pass:secure

## Trusted certificate for localhost (server signed/valid)

mkdir -p client/localhost

# generate server-signed (valid) certificate
openssl req \
	-newkey rsa:4096 \
	-keyout client/localhost/localhost.key \
	-out client/localhost/localhost.csr \
	-nodes \
	-days 3650 \
	-subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1"

# put extensions
echo "subjectAltName=DNS:localhost,DNS:127.0.0.1" > client/localhost/localhost.ext

# sign with server_cert.pem
openssl x509 \
	-req \
	-in client/localhost/localhost.csr \
	-CA server/server_cert.pem \
	-CAkey server/server_key.pem \
	-set_serial 01 \
	-out client/localhost/localhost.pem \
	-days 3650 \
  -extfile client/localhost/localhost.ext

## Self-signed certificate (invalid)

mkdir -p client/self-signed
openssl req \
	-newkey rsa:4096 \
	-keyout client/self-signed/key.pem \
	-out client/self-signed/csr.pem \
	-nodes \
	-days 3650 \
	-subj "/CN=Bob"

# sign with self-signed/key.pem
openssl x509 \
	-req \
	-in client/self-signed/csr.pem \
	-signkey client/self-signed/key.pem \
	-out client/self-signed/cert.pem \
	-days 3650
