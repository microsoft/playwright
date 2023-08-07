FROM mcr.microsoft.com/playwright:v1.37.0-alpha-aug-7-2023-jammy

WORKDIR /app

COPY package.json ./
COPY cli.js ./
COPY lib ./lib
RUN npm install
