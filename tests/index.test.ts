import { Keypair, PublicKey, Transaction, Connection } from "@solana/web3.js";
import { E2EWalletAdapter, E2EWindow } from "../src/index";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { TextEncoder } from "util";

describe("E2EWalletAdapter", () => {
  const connection = new Connection("https://api.devnet.solana.com");
  const blockhash = "BEHtXd6rwBa6yWgasyQfmwtWGALmAuFrpn9rwsUn16M5";
  connection.sendTransaction = jest.fn().mockResolvedValue("test-signature");
  connection.getRecentBlockhash = jest.fn().mockResolvedValue({
    blockhash,
    feeCalculator: {
      lamportsPerSignature: 1,
    },
  });

  it("should be instantiable with a random valid pubkey", async () => {
    const adapter = new E2EWalletAdapter();
    expect(adapter).toBeDefined();
    expect(PublicKey.isOnCurve(adapter.publicKey as PublicKey)).toBe(true);
    expect(adapter.readyState).toBe("Installed");
    expect(adapter.connecting).toBe(false);
    expect(adapter.connected).toBe(true);
    expect((window as E2EWindow).solanaE2E).toBeDefined();
  });

  it("should be instantiable with a config", () => {
    const keypair = new Keypair();
    const adapter = new E2EWalletAdapter({
      keypair,
    });
    expect(adapter).toBeDefined();
    expect(adapter.publicKey.toBase58()).toEqual(keypair.publicKey.toBase58());
  });

  it("should emit a connect event on connection", () => {
    const adapter = new E2EWalletAdapter();
    const spy = jest.fn();
    adapter.on("connect", spy);
    adapter.connect();
    expect(spy).toHaveBeenCalled();
  });

  it("should emit a connect event on disconnection", () => {
    const adapter = new E2EWalletAdapter();
    const spy = jest.fn();
    adapter.on("disconnect", spy);
    adapter.connect();
    adapter.disconnect();
    expect(spy).toHaveBeenCalled();
  });

  it("should approve a transaction", async () => {
    const adapter = new E2EWalletAdapter();
    adapter.connect();
    const transaction = new Transaction();
    const signature = await adapter.sendTransaction(transaction, connection);
    expect(connection.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        recentBlockhash: blockhash,
      }),
      [adapter._underlyingWallet]
    );
    expect(signature).toBe("test-signature");
  });

  it("should sign a transaction", async () => {
    const adapter = new E2EWalletAdapter();
    adapter.connect();
    const transaction = new Transaction();
    transaction.sign = jest.fn();
    await adapter.signTransaction(transaction);
    expect(transaction.sign).toHaveBeenCalledWith(adapter._underlyingWallet);
  });

  it("should sign multiple transactions", async () => {
    const adapter = new E2EWalletAdapter();
    const spy = jest.fn();
    adapter.on("disconnect", spy);
    adapter.connect();
    const transactionOne = new Transaction();
    transactionOne.sign = jest.fn();
    const transactionTwo = new Transaction();
    transactionTwo.sign = jest.fn();
    await adapter.signAllTransactions([transactionOne, transactionTwo]);
    expect(transactionOne.sign).toHaveBeenCalledWith(adapter._underlyingWallet);
    expect(transactionTwo.sign).toHaveBeenCalledWith(adapter._underlyingWallet);
  });

  it("should approve multiple transactions", async () => {
    const adapter = new E2EWalletAdapter();
    adapter.connect();
    const transactionOne = new Transaction();
    transactionOne.sign = jest.fn();
    const transactionTwo = new Transaction();
    transactionTwo.sign = jest.fn();
    await adapter.signAllTransactions([transactionOne, transactionTwo]);
    expect(transactionOne.sign).toHaveBeenCalledWith(adapter._underlyingWallet);
    expect(transactionTwo.sign).toHaveBeenCalledWith(adapter._underlyingWallet);
  });

  it("should allow to programmatically reject a transaction", async () => {
    const adapter = new E2EWalletAdapter();
    adapter.connect();
    const transaction = new Transaction();
    const signature = await adapter.sendTransaction(transaction, connection);
    expect(connection.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        recentBlockhash: blockhash,
      }),
      [adapter._underlyingWallet]
    );
    expect(signature).toBe("test-signature");

    adapter.rejectNext();

    const rejectedTx = new Transaction();
    expect(adapter.sendTransaction(rejectedTx, connection)).rejects.toThrow();

    const transactionTwo = new Transaction();
    const signatureTwo = await adapter.sendTransaction(
      transactionTwo,
      connection
    );
    expect(connection.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        recentBlockhash: blockhash,
      }),
      [adapter._underlyingWallet]
    );
    expect(signatureTwo).toBe("test-signature");
  });

  it("should be able to sign a message", async () => {
    const config = { keypair: new Keypair() };
    const adapter = new E2EWalletAdapter(config);
    adapter.connect();
    const message = new TextEncoder().encode("test message");
    const signature = await adapter.signMessage(message);
    const verified = nacl.sign.detached.verify(
      message,
      signature,
      bs58.decode(config.keypair.publicKey.toBase58())
    );
    expect(verified).toBe(true);
  });
});
