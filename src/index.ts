import {
  BaseWalletAdapter,
  EventEmitter,
  SendTransactionOptions,
  WalletName,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import {
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";

interface E2EWalletEvents {
  connect(...args: unknown[]): unknown;
  disconnect(...args: unknown[]): unknown;
}

interface E2EWallet extends EventEmitter<E2EWalletEvents> {
  publicKey?: { toBytes(): Uint8Array };
  isConnected: boolean;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
  signAndSendTransaction(
    transaction: Transaction,
    options?: SendOptions
  ): Promise<{ signature: TransactionSignature }>;
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface E2EWindow extends Window {
  solanaE2E?: E2EWalletAdapter;
}

declare const window: E2EWindow;

export interface E2EWalletAdapterConfig {
  keypair?: Keypair;
}

export const E2EWalletName = "E2E" as WalletName<"E2E">;

export class E2EWalletAdapter extends BaseWalletAdapter {
  name = E2EWalletName;
  url = "https://E2E.app";
  icon = "E2E";

  _connecting: boolean;
  _wallet: E2EWallet | null;
  _publicKey: PublicKey | null;
  _underlyingWallet: Keypair;
  _readyState: WalletReadyState;
  _approveNext: boolean;

  constructor(config: E2EWalletAdapterConfig = {}) {
    super();
    this._connecting = false;
    this._wallet = null;
    this._underlyingWallet = config.keypair || Keypair.generate();
    this._publicKey = this._underlyingWallet.publicKey;
    this._readyState = WalletReadyState.Installed;
    this._approveNext = true;
    if (typeof window !== "undefined") {
      window.solanaE2E = this;
    }
  }

  get publicKey(): PublicKey {
    return this._publicKey;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get connected(): boolean {
    return !!this._publicKey;
  }

  get readyState(): WalletReadyState {
    return this._readyState;
  }

  rejectNext() {
    this._approveNext = false;
  }

  _checkForReject() {
    if (!this._approveNext) {
      this._approveNext = true;
      throw new Error("E2E wallet rejected transaction");
    }
  }

  async connect(): Promise<void> {
    this._connecting = true;
    this._publicKey = this._underlyingWallet.publicKey;
    this._connecting = false;
    this.emit("connect", this._publicKey);
  }

  async disconnect(): Promise<void> {
    this._wallet = null;
    this._publicKey = null;
    this.emit("disconnect");
  }

  async sendTransaction(
    transaction: Transaction,
    connection: Connection,
    options: SendTransactionOptions = {}
  ): Promise<TransactionSignature> {
    this._checkForReject();
    transaction = await this.prepareTransaction(transaction, connection);
    const { signers, ...sendOptions } = options;
    const signature = await connection.sendTransaction(transaction, [
      this._underlyingWallet,
    ]);
    return signature;
  }

  async signTransaction(transaction: Transaction): Promise<Transaction> {
    this._checkForReject();
    transaction.sign(this._underlyingWallet);
    return transaction;
  }

  async signAllTransactions(
    transactions: Transaction[]
  ): Promise<Transaction[]> {
    this._checkForReject();
    for (let i=0; i < transactions.length; i++) {
      transactions[i].sign(this._underlyingWallet);
    }
    return transactions;
  }
}
