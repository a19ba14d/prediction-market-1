import type { Address, Hash } from 'viem'
import { createPublicClient, getAddress, http, isAddress } from 'viem'
import { CREATOR_PROPOSER_WHITELIST_REGISTRY_ADDRESS, ZERO_ADDRESS } from '@/lib/contracts'
import {
  CREATOR_PROPOSER_WHITELIST_ABI,
  CREATOR_PROPOSER_WHITELIST_REGISTRY_ABI,
} from '@/lib/proposer-whitelist-contracts'
import { defaultViemNetwork, defaultViemRpcUrl } from '@/lib/viem-network'

export interface ProposerWhitelistCreatorOption {
  address: Address
  displayName: string
  shortAddress: string
  hasServerSigner: boolean
}

export interface ProposerWhitelistStatus {
  creator: Address
  registryAddress: Address
  whitelistAddress: Address | null
  proposers: Address[]
  hasServerSigner: boolean
}

export interface ProposerWhitelistStatusResponse {
  registryAddress: Address
  creators: ProposerWhitelistCreatorOption[]
  status: ProposerWhitelistStatus | null
}

export interface ProposerWhitelistMutationResponse {
  status: ProposerWhitelistStatus
  txHashes: Hash[]
}

function getClientCreatorProposerWhitelistRegistryAddress() {
  return CREATOR_PROPOSER_WHITELIST_REGISTRY_ADDRESS
}

export function getServerCreatorProposerWhitelistRegistryAddress() {
  return CREATOR_PROPOSER_WHITELIST_REGISTRY_ADDRESS
}

export function shortenProposerWhitelistAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function normalizeProposerAddressList(value: string | string[]) {
  const values = Array.isArray(value)
    ? value
    : value.split(/[\s,;]+/g)

  const deduped = new Map<string, Address>()
  for (const raw of values) {
    const trimmed = raw.trim()
    if (!trimmed) {
      continue
    }
    if (!isAddress(trimmed)) {
      throw new Error(`Invalid wallet address: ${trimmed}`)
    }
    const normalized = getAddress(trimmed) as Address
    deduped.set(normalized.toLowerCase(), normalized)
  }
  return [...deduped.values()]
}

export function isProposerWhitelistStatusResponse(payload: unknown): payload is ProposerWhitelistStatusResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const candidate = payload as Partial<ProposerWhitelistStatusResponse>
  return typeof candidate.registryAddress === 'string'
    && Array.isArray(candidate.creators)
    && (candidate.status === null || typeof candidate.status === 'object')
}

export function readProposerWhitelistError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (
    lower.includes('insufficient funds')
    || lower.includes('exceeds the balance')
    || lower.includes('not enough native')
    || lower.includes('insufficient balance')
  ) {
    return 'Creator wallet needs POL for gas before updating proposer whitelist.'
  }

  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
    return 'Wallet signature was rejected.'
  }

  if (lower.includes('notcreator') || lower.includes('not creator')) {
    return 'Only the selected creator wallet can update this whitelist.'
  }

  if (lower.includes('zeroaddress') || lower.includes('zero address')) {
    return 'Zero address is not allowed.'
  }

  if (lower.includes('whitelistcreatormismatch')) {
    return 'Whitelist creator does not match the selected creator wallet.'
  }

  return message || 'Could not update proposer whitelist.'
}

export async function readCreatorProposerWhitelistStatus(input: {
  creator: Address
  registryAddress?: Address
  hasServerSigner?: boolean
}): Promise<ProposerWhitelistStatus> {
  const registryAddress = input.registryAddress ?? getClientCreatorProposerWhitelistRegistryAddress()
  const client = createPublicClient({
    chain: defaultViemNetwork,
    transport: http(defaultViemRpcUrl),
  })

  const whitelist = await client.readContract({
    address: registryAddress,
    abi: CREATOR_PROPOSER_WHITELIST_REGISTRY_ABI,
    functionName: 'whitelistOf',
    args: [input.creator],
  }) as Address

  const whitelistAddress = whitelist.toLowerCase() === ZERO_ADDRESS.toLowerCase()
    ? null
    : (getAddress(whitelist) as Address)

  const proposers = whitelistAddress
    ? await client.readContract({
      address: whitelistAddress,
      abi: CREATOR_PROPOSER_WHITELIST_ABI,
      functionName: 'getProposers',
    }) as Address[]
    : []

  return {
    creator: input.creator,
    registryAddress,
    whitelistAddress,
    proposers: proposers.map(proposer => getAddress(proposer) as Address),
    hasServerSigner: Boolean(input.hasServerSigner),
  }
}
