import { ethers } from 'ethers';
import {
  ANAGU_TOKEN_ABI,
  CONTRACT_ADDRESSES,
  LAND_REGISTRY_ABI,
  LAND_TITLE_NFT_ABI,
  POLYGON_AMOY_NETWORK,
} from '../src/lib/contracts.ts';
import type {
  BlockchainStats,
  OnChainTitleInfo,
  WalletBalances,
} from '../src/lib/types.ts';

const AMOY_NETWORK = new ethers.Network(
  POLYGON_AMOY_NETWORK.chainName,
  POLYGON_AMOY_NETWORK.chainId
);

function createProvider(rpcUrl: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl, AMOY_NETWORK, {
    staticNetwork: AMOY_NETWORK,
    batchMaxCount: 1,
  });
}

export async function withAmoyProvider<T>(
  operation: (provider: ethers.JsonRpcProvider, rpcUrl: string) => Promise<T>
): Promise<T> {
  let lastError: unknown = null;
  for (const rpcUrl of POLYGON_AMOY_NETWORK.rpcUrls) {
    const provider = createProvider(rpcUrl);
    try {
      const result = await Promise.race([
        operation(provider, rpcUrl),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`RPC timeout: ${rpcUrl}`)), 8500)
        ),
      ]);
      return result;
    } catch (err) {
      lastError = err;
    } finally {
      provider.destroy();
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('All Polygon Amoy RPC endpoints failed.');
}

export async function fetchWalletBalances(
  address: string
): Promise<WalletBalances> {
  const checksummed = ethers.getAddress(address);
  return withAmoyProvider(async (provider, rpcUrl) => {
    const anagu = new ethers.Contract(
      CONTRACT_ADDRESSES.ANAGUToken,
      ANAGU_TOKEN_ABI,
      provider
    );
    const nft = new ethers.Contract(
      CONTRACT_ADDRESSES.LandTitleNFT,
      LAND_TITLE_NFT_ABI,
      provider
    );

    const [polWei, anaguWei, decimals, symbol, governorRoleHash] =
      await Promise.all([
        provider.getBalance(checksummed),
        anagu.balanceOf(checksummed),
        anagu.decimals(),
        anagu.symbol(),
        nft.GOVERNOR_ROLE(),
      ]);

    const hasGovernorRole = await nft.hasRole(governorRoleHash, checksummed);

    return {
      address: checksummed,
      polBalance: ethers.formatEther(polWei),
      anaguBalance: ethers.formatUnits(anaguWei, Number(decimals)),
      tokenSymbol: String(symbol || 'ANAGU'),
      hasGovernorRole: Boolean(hasGovernorRole),
      governorRoleHash: String(governorRoleHash),
      rpcUrl,
    };
  });
}

export async function fetchRegistryStats(): Promise<BlockchainStats> {
  return withAmoyProvider(async (provider, rpcUrl) => {
    const anagu = new ethers.Contract(
      CONTRACT_ADDRESSES.ANAGUToken,
      ANAGU_TOKEN_ABI,
      provider
    );
    const registry = new ethers.Contract(
      CONTRACT_ADDRESSES.LandRegistry,
      LAND_REGISTRY_ABI,
      provider
    );

    const [
      blockNumber,
      titlesIssued,
      transfersCompleted,
      totalFeesCollected,
      registrationFee,
      transferFee,
      totalSupply,
      decimals,
      symbol,
    ] = await Promise.all([
      provider.getBlockNumber(),
      registry.titlesIssued(),
      registry.transfersCompleted(),
      registry.totalFeesCollected(),
      registry.fees(0),
      registry.fees(1),
      anagu.totalSupply(),
      anagu.decimals(),
      anagu.symbol(),
    ]);

    const dec = Number(decimals);
    return {
      chainId: POLYGON_AMOY_NETWORK.chainId,
      rpcUrl,
      blockNumber,
      titlesIssued: String(titlesIssued),
      transfersCompleted: String(transfersCompleted),
      totalFeesCollectedAnagu: ethers.formatUnits(totalFeesCollected, dec),
      registrationFeeAnagu: ethers.formatUnits(registrationFee, dec),
      transferFeeAnagu: ethers.formatUnits(transferFee, dec),
      anaguTotalSupply: ethers.formatUnits(totalSupply, dec),
      tokenSymbol: String(symbol || 'ANAGU'),
    };
  });
}

export async function fetchTitleOnChain(
  tokenId: string | number
): Promise<OnChainTitleInfo> {
  const idBigInt = BigInt(tokenId);
  return withAmoyProvider(async (provider) => {
    const nft = new ethers.Contract(
      CONTRACT_ADDRESSES.LandTitleNFT,
      LAND_TITLE_NFT_ABI,
      provider
    );

    const [ownerOf, isRevoked, revocationGround, revokedAt, titleStruct, tokenUri] =
      await Promise.all([
        nft.ownerOf(idBigInt),
        nft.isRevoked(idBigInt),
        nft.revocationGround(idBigInt),
        nft.revokedAt(idBigInt),
        nft.titles(idBigInt),
        nft.tokenURI(idBigInt),
      ]);

    return {
      tokenId: idBigInt.toString(),
      ownerOf: String(ownerOf),
      isRevoked: Boolean(isRevoked),
      revocationGround: Number(revocationGround),
      revokedAt: Number(revokedAt),
      parcelIdBytes32: String(titleStruct.parcelId ?? titleStruct[0]),
      spatialHashBytes32: String(titleStruct.spatialHash ?? titleStruct[1]),
      applicationIdBytes32: String(titleStruct.applicationId ?? titleStruct[2]),
      issuedAt: Number(titleStruct.issuedAt ?? titleStruct[3]),
      tokenUri: String(tokenUri || titleStruct.uri || titleStruct[4] || ''),
    };
  });
}

export async function verifyRevocationReceipt(
  txHash: string,
  expectedTokenId: string
): Promise<{
  verified: boolean;
  revokedBy: string | null;
  ground: number | null;
  blockNumber: number | null;
}> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { verified: false, revokedBy: null, ground: null, blockNumber: null };
  }

  return withAmoyProvider(async (provider) => {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return { verified: false, revokedBy: null, ground: null, blockNumber: null };
    }

    const iface = new ethers.Interface(LAND_TITLE_NFT_ABI);
    const nftAddress = CONTRACT_ADDRESSES.LandTitleNFT.toLowerCase();

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== nftAddress) continue;
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'TitleRevoked') {
          const loggedTokenId = parsed.args.tokenId.toString();
          if (loggedTokenId === String(expectedTokenId)) {
            return {
              verified: true,
              revokedBy: String(parsed.args.revokedBy),
              ground: Number(parsed.args.ground),
              blockNumber: receipt.blockNumber,
            };
          }
        }
      } catch {
        // Ignore unrelated log topics
      }
    }

    return {
      verified: false,
      revokedBy: null,
      ground: null,
      blockNumber: receipt.blockNumber,
    };
  });
}
