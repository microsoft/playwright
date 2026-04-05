"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getRawBody;
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
// @ts-expect-error untyped module
const bytes_1 = __importDefault(require("bytes"));
function getRawBody(req, { limit, encoding }) {
    const limitNumber = bytes_1.default.parse(limit);
    return new Promise((resolve, reject) => {
        let received = 0;
        const chunks = [];
        req.on('data', (chunk) => {
            received += chunk.length;
            if (received > limitNumber)
                return reject(new Error(`Message size exceeds limit of ${limit} bytes`));
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                resolve(Buffer.concat(chunks).toString(encoding));
            }
            catch (error) {
                reject(error);
            }
        });
        req.on('error', error => {
            reject(error);
        });
    });
}
