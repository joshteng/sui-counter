import { SuiClient, getFullnodeUrl, type MoveValue, type SuiTransactionBlockResponse } from "@mysten/sui/client";
import { getFaucetHost, requestSuiFromFaucetV0 } from "@mysten/sui/faucet";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import { sleep } from "bun";

const suiClient = new SuiClient({ url: getFullnodeUrl('devnet') });

const privateKey = fromBase64(process.env.PRIVATE_KEY!).slice(1);
const keypair = Ed25519Keypair.fromSecretKey(privateKey);
const counterPackageId = '0xa51d89641ccc2b72aba0fb4cdfcae9ac4a674a9c2c1a66e897ff3d0748e78daa';

console.log("Creating a counter....");
const counterObjectId = await createCounter();
console.log("Getting the counter....");
console.log({ value: await getCounter(counterObjectId!) });
console.log("Incrementing the counter....");
await incrementCounter(counterObjectId!);
console.log("Getting the counter....");
console.log({ value: await getCounter(counterObjectId!) });
console.log("Setting the counter value....");
await setCounterValue(counterObjectId!, 10);
console.log("Getting the counter....");
console.log({ value: await getCounter(counterObjectId!) });

async function createCounter() {
  const tx = new Transaction();

  tx.moveCall({
    arguments: [],
    target: `${counterPackageId}::counter::create`,
  });

  const result: SuiTransactionBlockResponse = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEvents: true,
      showEffects: true,
    }
  });

  const counterObjectId = result.effects?.created?.[0].reference.objectId;

  return counterObjectId;

}

async function getCounter(counterObjectId: string) {
  if (counterObjectId) {
    await sleep(3_000);

    const counter = await suiClient.getObject({
      id: counterObjectId,
      options: {
        showContent: true,
        showOwner: true,
      }
    });

    // console.log({ owner: counter.data?.owner, content: counter.data?.content });

    if (counter.data?.content?.dataType === 'moveObject') {
      // console.log({ fields: counter.data?.content?.fields });
      return (counter.data?.content?.fields as { value: MoveValue })['value'];
    } else {
      console.error('Failed to create counter object');
    }
  } else {
    console.error('Failed to create counter object');
  }
}

async function incrementCounter(counterObjectId: string) {
  /* experiment with using a new keypair to mutate a permissionless shared object */
  const newKeypair = new Ed25519Keypair();
  const address = newKeypair.toSuiAddress();

  await requestSuiFromFaucetV0({
    host: getFaucetHost('devnet'),
    recipient: address,
  });
  /* end */

  const tx = new Transaction();

  tx.moveCall({
    arguments: [tx.object(counterObjectId)],
    target: `${counterPackageId}::counter::increment`,
  });

  const result: SuiTransactionBlockResponse = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: newKeypair,
    options: {
      showEvents: true,
      showEffects: true,
    }
  });

  // console.log(JSON.stringify(result, null, 2));

  return counterObjectId;
}

async function setCounterValue(counterObjectId: string, value: number) {
  const tx = new Transaction();

  tx.moveCall({
    arguments: [tx.object(counterObjectId), tx.pure.u64(value)],
    target: `${counterPackageId}::counter::set_value`,
  });

  const result: SuiTransactionBlockResponse = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEvents: true,
      showEffects: true,
    }
  });

  return counterObjectId;
}
