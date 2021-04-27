
export interface TcpData {
  port: number,
  data?: string, // base64 encoded binary data
  event: string
}

export interface IWSMessage {
  TcpData?: TcpData;
  clientId?: string;
  playwright?: object ;
  ports?: [number];
}

export class WsMessage  implements IWSMessage {
  TcpData: TcpData | undefined;
  playwright: object | undefined;
  ports: [number] | undefined;
  clientId: string | undefined;
  constructor(wsMessageProperties: IWSMessage) {
    this.TcpData = wsMessageProperties.TcpData;
    this.playwright = wsMessageProperties.playwright;
    this.ports = wsMessageProperties.ports;
    this.clientId = wsMessageProperties.clientId;
  }
}
