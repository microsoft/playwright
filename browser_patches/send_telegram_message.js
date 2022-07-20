/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check
const https = require('https');

const TELEGRAM_CHAT_ID = "-1001225613794";

(async () => {
  const { TELEGRAM_BOT_KEY } = process.env;
  if (!TELEGRAM_BOT_KEY) {
    console.log('environment variable \'TELEGRAM_BOT_KEY\' is not set');
    return;
  }

  const text = process.argv[2];
  if (!text) {
    console.log('Text not set!');
    console.log('Usage: node send_telegram_message.js <text>');
    return;
  }

  await sendTelegramMessage(TELEGRAM_BOT_KEY, text);
  console.log('Telegram message sent successfully!');
})().catch(error => {
  console.error(`Failed to send Telegram message. Error: ${error}`);
})

/**
 * @param {string} apiKey 
 * @param {string} text 
 */
async function sendTelegramMessage(apiKey, text) {
  await new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${apiKey}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        if (res.statusCode !== 200)
          reject(new Error(`Telegram API returned status code ${res.statusCode}. Body: ${body}`));
        else
          resolve(JSON.parse(body));
      });
      res.on('error', err => {
        reject(err);
      });
    });
    request.on('error',reject);
    request.write(JSON.stringify({
      disable_web_page_preview: true,
      chat_id: TELEGRAM_CHAT_ID,
      parse_mode: 'html',
      text,
      disable_notification: false,
    }));
    request.end();
  });
}
