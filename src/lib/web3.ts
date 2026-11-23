import { ethers } from 'ethers';
import {
  CONTRACT_ADDRESSES,
  LAND_TITLE_NFT_ABI,
  POLYGON_AMOY_NETWORK,
} from './contracts';

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
}

export async function getConnectedAccounts(): Promise<string[]> {
  if (!window.ethereum) return [];
  const accounts = (await window.ethereum.request({
    method: 'eth_accounts',
  })) as string[];
  return Array.isArray(accounts) ? accounts : [];
}

export async function getCurrentChainId(): Promise<number | null> {
  if (!window.ethereum) return null;
  const hex = (await window.ethereum.request({
    method: 'eth_chainId',
  })) as string;
  if (!hex) return null;
  return Number.parseInt(hex, 16);
}

export async function connectMetaMaskWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error(
      'No EVM wallet detected. Install MetaMask to sign Polygon Amoy transactions.'
    );
  }
  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error('Wallet connection cancelled.');
  }
  return ethers.getAddress(accounts[0]);
}

export async function switchMetaMaskWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No EVM wallet detected.');
  }
  await window.ethereum.request({
    method: 'wallet_requestPermissions',
    params: [{ eth_accounts: {} }],
  });
  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error('No wallet account selected.');
  }
  return ethers.getAddress(accounts[0]);
}

export async function switchToPolygonAmoy(): Promise<void> {
  if (!window.ethereum) {
    throw new Error('No EVM wallet detected.');
  }
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_AMOY_NETWORK.chainIdHex }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: POLYGON_AMOY_NETWORK.chainIdHex,
            chainName: POLYGON_AMOY_NETWORK.chainName,
            nativeCurrency: POLYGON_AMOY_NETWORK.nativeCurrency,
            rpcUrls: [...POLYGON_AMOY_NETWORK.rpcUrls],
            blockExplorerUrls: [POLYGON_AMOY_NETWORK.blockExplorerUrl],
          },
        ],
      });
    } else {
      throw new Error(
        err?.message || 'Unable to switch wallet to Polygon Amoy (80002).'
      );
    }
  }
}

export async function executeLandTitleRevocation(
  tokenId: string,
  groundIndex: number
): Promise<{
  txHash: string;
  blockNumber: number;
  callerAddress: string;
}> {
  if (!window.ethereum) {
    throw new Error('MetaMask is required to execute on-chain revocation.');
  }

  const chainId = await getCurrentChainId();
  if (chainId !== POLYGON_AMOY_NETWORK.chainId) {
    await switchToPolygonAmoy();
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const callerAddress = await signer.getAddress();

  const contract = new ethers.Contract(
    CONTRACT_ADDRESSES.LandTitleNFT,
    LAND_TITLE_NFT_ABI,
    signer
  );

  const governorRoleHash = await contract.GOVERNOR_ROLE();
  const isGovernorOnChain = await contract.hasRole(
    governorRoleHash,
    callerAddress
  );
  if (!isGovernorOnChain) {
    throw new Error(
      `Connected wallet ${callerAddress} does not hold GOVERNOR_ROLE on LandTitleNFT (${CONTRACT_ADDRESSES.LandTitleNFT}).`
    );
  }

  const tx = await contract.revoke(BigInt(tokenId), groundIndex);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error('Polygon Amoy revocation transaction reverted.');
  }

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    callerAddress,
  };
}
