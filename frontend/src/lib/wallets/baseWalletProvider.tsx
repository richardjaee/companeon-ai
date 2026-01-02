
export interface BaseWalletProvider {
  provider: any;
  connect(): Promise<string>;
  disconnect?(): Promise<void>;
  signMessage(message: string): Promise<string>;
  signTransaction?(tx: any): Promise<string>;

}
