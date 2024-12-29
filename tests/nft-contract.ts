import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftContract } from "../target/types/nft_contract";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { expect } from "chai";

describe("nft-contract", () => {
  // Configure the client to use the Devnet cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftContract as Program<NftContract>;

  // Metaplex Token Metadata Program ID (hardcoded since we can't import it)
  const METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  // Test NFT details
  const NFT_NAME = "Little Girl #0";
  const NFT_SYMBOL = "RINKS";
  const NFT_URI =
    "http://127.0.0.1:8080/ipfs/QmfVuPfBXAiGdoibQrQsUTkQsxwDgDMUuFBVbyQaZmVDDW";

  it("Creates an NFT with metadata and master edition", async () => {
    // Generate a new mint keypair
    const mint = anchor.web3.Keypair.generate();

    // Derive the associated token account address for the mint
    const associatedTokenAccount = await anchor.utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: provider.wallet.publicKey,
    });

    // Derive the metadata account address
    const [metadataAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );

    // Derive the master edition account address
    const [masterEditionAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        mint.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      METADATA_PROGRAM_ID
    );

    try {
      // Initialize NFT
      const txSignature = await program.methods
        .initNft(NFT_NAME, NFT_SYMBOL, NFT_URI)
        .accounts({
          signer: provider.wallet.publicKey,
          mint: mint.publicKey,
          associatedTokenAccount,
          metadataAccount,
          masterEditionAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([mint])
        .rpc();

      console.log("Transaction Signature:", txSignature);

      // Verify the associated token account exists and has the correct balance
      const tokenAccountBalance =
        await program.provider.connection.getTokenAccountBalance(
          associatedTokenAccount
        );
      expect(tokenAccountBalance.value.uiAmount).to.equal(1);
      expect(tokenAccountBalance.value.decimals).to.equal(0);

      // Verify the metadata account exists
      const metadataAccountInfo =
        await program.provider.connection.getAccountInfo(metadataAccount);
      expect(metadataAccountInfo).to.not.be.null;

      // Verify the master edition account exists
      const masterEditionAccountInfo =
        await program.provider.connection.getAccountInfo(masterEditionAccount);
      expect(masterEditionAccountInfo).to.not.be.null;

      console.log("NFT successfully minted on Devnet!");
    } catch (error) {
      console.error("Error during test:", error);
      throw error;
    }
  });
});
