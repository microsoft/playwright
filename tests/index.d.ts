declare module 'socksv5' {
    import type net from 'net';

    class Auth { }

    class SocksServer {
        listen: net.Server['listen'];
        useAuth(auth: Auth): void;
        close: net.Server['close'];
    }

    type Info = {
        srcAddr: string;
        srcPort: number;
        dstAddr: string;
        dstPort: number;
    }

    function acceptHandler(intercept: true): net.Socket | undefined;
    function acceptHandler(intercept: false): undefined;
    export function createServer(cb: (info: Info, accept: typeof acceptHandler, deny: () => void) => void): SocksServer;

    export const auth: {
        None: () => Auth
    };
}
