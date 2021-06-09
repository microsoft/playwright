import { exec } from 'child_process';
import net from 'net';
import { monotonicTime, raceAgainstDeadline } from './util';
import { WebServerConfig } from '../../types/test';
export async function launchWebServer(config: WebServerConfig) {
    const {command, port, timeout = 10000} = config;
    const webServer = exec(command);
    const cancellationToken = {canceled: false};
    const {timedOut} = await raceAgainstDeadline(waitForSocket(port, 100, cancellationToken), timeout + monotonicTime());
    cancellationToken.canceled = true;
    if (timedOut) {
        webServer.kill();
        throw new Error(`failed to start web server on port ${port} via "${command}"`);
    }
    process.env.PW_BASE_URL = `http://localhost:${port}`;
    return webServer;
}
async function waitForSocket(port: number, delay: number, cancellationToken: {canceled: boolean}) {    
    while (!cancellationToken.canceled) {
        const connected = await new Promise((resolve) => {
        const conn = net
            .connect(port)
            .on('error', () => {
            resolve(false);
            })
            .on('connect', () => {
            conn.end();
            resolve(true);
            });
        });
        if (connected)
            return;
        await new Promise(x => setTimeout(x, delay));
    }

  }
  