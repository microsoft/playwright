export interface ConnectionTransport {
  send(s: string): void;
  close(): void;
  onmessage?: (message: string) => void,
  onclose?: () => void,
}