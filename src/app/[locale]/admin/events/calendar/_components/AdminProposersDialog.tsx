'use client'

import type { Address, Hash } from 'viem'
import type { ProposerWhitelistCreatorOption, ProposerWhitelistMutationResponse, ProposerWhitelistStatus, ProposerWhitelistStatusResponse } from '@/lib/proposer-whitelist'
import { useAppKitAccount } from '@reown/appkit/react'
import { CheckCircle2Icon, Loader2Icon, PlusIcon, UserCheckIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getAddress, isAddress } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { DEFAULT_CHAIN_ID } from '@/lib/network'
import {
  isProposerWhitelistStatusResponse,
  normalizeProposerAddressList,

  readProposerWhitelistError,
  shortenProposerWhitelistAddress,
} from '@/lib/proposer-whitelist'
import {
  CREATOR_PROPOSER_WHITELIST_ABI,
  CREATOR_PROPOSER_WHITELIST_BYTECODE,
  CREATOR_PROPOSER_WHITELIST_REGISTRY_ABI,
} from '@/lib/proposer-whitelist-contracts'
import { cn } from '@/lib/utils'
import { defaultViemNetwork } from '@/lib/viem-network'

interface AdminProposersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCreatorAddress?: string | null
  onStatusChange?: (status: ProposerWhitelistStatus) => void
}

function readApiError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const maybeError = (payload as { error?: unknown }).error
  return typeof maybeError === 'string' && maybeError.trim() ? maybeError.trim() : null
}

function mergeCreatorOptions(input: {
  creators: ProposerWhitelistCreatorOption[]
  connectedAddress: Address | null
}) {
  const byAddress = new Map<string, ProposerWhitelistCreatorOption>()
  for (const creator of input.creators) {
    byAddress.set(creator.address.toLowerCase(), creator)
  }

  if (input.connectedAddress) {
    const key = input.connectedAddress.toLowerCase()
    const existing = byAddress.get(key)
    byAddress.set(key, {
      address: input.connectedAddress,
      displayName: existing?.displayName ?? 'Connected EOA',
      shortAddress: shortenProposerWhitelistAddress(input.connectedAddress),
      hasServerSigner: Boolean(existing?.hasServerSigner),
    })
  }

  return [...byAddress.values()]
}

function isMutationResponse(payload: unknown): payload is ProposerWhitelistMutationResponse {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const candidate = payload as Partial<ProposerWhitelistMutationResponse>
  return Boolean(candidate.status) && Array.isArray(candidate.txHashes)
}

function getPreferredCreator(input: {
  initialCreatorAddress?: string | null
  selectedCreator: Address | null
  connectedAddress: Address | null
  creators: ProposerWhitelistCreatorOption[]
}) {
  if (input.selectedCreator) {
    return input.selectedCreator
  }
  if (input.initialCreatorAddress && isAddress(input.initialCreatorAddress)) {
    return getAddress(input.initialCreatorAddress) as Address
  }
  if (input.connectedAddress) {
    return input.connectedAddress
  }
  return input.creators[0]?.address ?? null
}

export default function AdminProposersDialog({
  open,
  onOpenChange,
  initialCreatorAddress,
  onStatusChange,
}: AdminProposersDialogProps) {
  const { address: connectedAddressRaw } = useAppKitAccount()
  const connectedAddress = useMemo(
    () => connectedAddressRaw && isAddress(connectedAddressRaw) ? getAddress(connectedAddressRaw) as Address : null,
    [connectedAddressRaw],
  )
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const [creators, setCreators] = useState<ProposerWhitelistCreatorOption[]>([])
  const [selectedCreator, setSelectedCreator] = useState<Address | null>(null)
  const [status, setStatus] = useState<ProposerWhitelistStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [walletInput, setWalletInput] = useState('')

  const creatorOptions = useMemo(
    () => mergeCreatorOptions({ creators, connectedAddress }),
    [connectedAddress, creators],
  )
  const selectedOption = creatorOptions.find(item => selectedCreator && item.address.toLowerCase() === selectedCreator.toLowerCase()) ?? null
  const canUseConnectedWallet = Boolean(
    selectedCreator
    && connectedAddress
    && selectedCreator.toLowerCase() === connectedAddress.toLowerCase(),
  )
  const canUseServerSigner = Boolean(status?.hasServerSigner || selectedOption?.hasServerSigner)
  const signerLabel = canUseConnectedWallet
    ? 'Connected wallet'
    : canUseServerSigner
      ? 'Server signer'
      : 'No signer'

  const loadStatus = useCallback(async (creator: Address | null) => {
    setIsLoading(true)
    try {
      const query = creator ? `?creator=${encodeURIComponent(creator)}` : ''
      const response = await fetch(`/admin/api/proposer-whitelists${query}`, {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)
      if (!response.ok || apiError || !isProposerWhitelistStatusResponse(payload)) {
        throw new Error(apiError || `Could not load proposer whitelist (${response.status})`)
      }

      const nextPayload: ProposerWhitelistStatusResponse = payload
      setCreators(nextPayload.creators)
      setStatus(nextPayload.status)
      if (nextPayload.status) {
        onStatusChange?.(nextPayload.status)
      }

      const preferred = getPreferredCreator({
        initialCreatorAddress,
        selectedCreator: creator,
        connectedAddress,
        creators: nextPayload.creators,
      })
      setSelectedCreator(preferred)
    }
    catch (error) {
      console.error('Failed to load proposer whitelist', error)
      toast.error(error instanceof Error ? error.message : 'Could not load proposer whitelist.')
    }
    finally {
      setIsLoading(false)
    }
  }, [connectedAddress, initialCreatorAddress, onStatusChange])

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
  useEffect(function loadOnOpen() {
    if (!open) {
      return
    }
    const preferred = getPreferredCreator({
      initialCreatorAddress,
      selectedCreator,
      connectedAddress,
      creators: [],
    })
    void loadStatus(preferred)
  }, [connectedAddress, initialCreatorAddress, loadStatus, open, selectedCreator])
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler */

  async function runServerMutation(action: 'create' | 'add' | 'remove', proposers: Address[]) {
    if (!selectedCreator) {
      throw new Error('Select a creator wallet first.')
    }

    const response = await fetch('/admin/api/proposer-whitelists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        creator: selectedCreator,
        proposers,
      }),
    })
    const payload = await response.json().catch(() => null) as unknown
    const apiError = readApiError(payload)
    if (!response.ok || apiError || !isMutationResponse(payload)) {
      throw new Error(apiError || `Could not update proposer whitelist (${response.status})`)
    }
    setStatus(payload.status)
    onStatusChange?.(payload.status)
    return payload.txHashes
  }

  async function waitForWalletTx(hash: Hash) {
    const client = publicClient
    if (!client) {
      return
    }
    const receipt = await client.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`Transaction failed: ${hash}`)
    }
    return receipt
  }

  function getConnectedWalletClient() {
    if (!selectedCreator) {
      throw new Error('Select a creator wallet first.')
    }
    if (!canUseConnectedWallet || !walletClient) {
      throw new Error('Connect the selected creator wallet to sign this action.')
    }
    if (walletClient.chain?.id && walletClient.chain.id !== DEFAULT_CHAIN_ID) {
      throw new Error(`Switch wallet to ${defaultViemNetwork.name} before updating proposer whitelist.`)
    }
    return walletClient
  }

  async function runWalletCreate(proposers: Address[]) {
    if (!selectedCreator || !status) {
      throw new Error('Select a creator wallet first.')
    }
    const client = getConnectedWalletClient()
    const deployHash = await runWithSignaturePrompt(() => client.deployContract({
      account: selectedCreator,
      chain: client.chain,
      abi: CREATOR_PROPOSER_WHITELIST_ABI,
      bytecode: CREATOR_PROPOSER_WHITELIST_BYTECODE,
      args: [selectedCreator, proposers],
    }), {
      title: 'Create whitelist',
      description: 'Open your wallet and approve the whitelist deployment.',
    })
    const deployReceipt = await waitForWalletTx(deployHash)
    const whitelistAddress = deployReceipt?.contractAddress && isAddress(deployReceipt.contractAddress)
      ? getAddress(deployReceipt.contractAddress) as Address
      : null
    if (!whitelistAddress) {
      throw new Error('Whitelist deployment did not return a contract address.')
    }

    const registerHash = await runWithSignaturePrompt(() => client.writeContract({
      account: selectedCreator,
      chain: client.chain,
      address: status.registryAddress,
      abi: CREATOR_PROPOSER_WHITELIST_REGISTRY_ABI,
      functionName: 'registerWhitelist',
      args: [whitelistAddress],
    }), {
      title: 'Register whitelist',
      description: 'Open your wallet and approve the registry transaction.',
    })
    await waitForWalletTx(registerHash)
  }

  async function runWalletUpdate(action: 'add' | 'remove', proposers: Address[]) {
    if (!selectedCreator || !status?.whitelistAddress) {
      throw new Error('Creator whitelist is not registered yet.')
    }
    const client = getConnectedWalletClient()
    const hash = await runWithSignaturePrompt(() => client.writeContract({
      account: selectedCreator,
      chain: client.chain,
      address: status.whitelistAddress!,
      abi: CREATOR_PROPOSER_WHITELIST_ABI,
      functionName: action === 'add' ? 'addProposers' : 'removeProposers',
      args: [proposers],
    }), {
      title: action === 'add' ? 'Add proposers' : 'Remove proposer',
      description: 'Open your wallet and approve the whitelist update.',
    })
    await waitForWalletTx(hash)
  }

  async function mutate(action: 'create' | 'add' | 'remove', rawProposers: string | string[]) {
    if (!selectedCreator) {
      toast.error('Select a creator wallet first.')
      return
    }

    let proposers: Address[] = []
    try {
      proposers = normalizeProposerAddressList(rawProposers)
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid wallet address.')
      return
    }

    if (action !== 'create' && proposers.length === 0) {
      toast.error('Add at least one wallet.')
      return
    }

    setIsMutating(true)
    try {
      if (canUseServerSigner && !canUseConnectedWallet) {
        await runServerMutation(action, proposers)
      }
      else if (action === 'create') {
        await runWalletCreate(proposers)
      }
      else {
        await runWalletUpdate(action, proposers)
      }

      await loadStatus(selectedCreator)
      setWalletInput('')
      setAddOpen(false)
      toast.success(action === 'remove' ? 'Proposer removed.' : 'Proposer whitelist updated.')
    }
    catch (error) {
      console.error('Failed to update proposer whitelist', error)
      toast.error(readProposerWhitelistError(error))
    }
    finally {
      setIsMutating(false)
    }
  }

  function handleCreatorChange(value: string) {
    if (!isAddress(value)) {
      return
    }
    const nextCreator = getAddress(value) as Address
    setSelectedCreator(nextCreator)
    setStatus(null)
    void loadStatus(nextCreator)
  }

  const proposerRows = status?.proposers ?? []
  const showAddYourWallet = Boolean(addOpen && proposerRows.length === 0 && connectedAddress && !walletInput.trim())
  const actionDisabled = isLoading || isMutating || !selectedCreator || !status || (!canUseConnectedWallet && !canUseServerSigner)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheckIcon className="size-5" />
            Proposers
          </DialogTitle>
          <DialogDescription>
            Adicione wallets confiáveis de usuários que poderão propor resultado dos mercados na UMA.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Creator wallet</Label>
            <Select
              value={selectedCreator ?? undefined}
              onValueChange={handleCreatorChange}
              disabled={isLoading || isMutating}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={isLoading ? 'Loading creators...' : 'Select creator'} />
              </SelectTrigger>
              <SelectContent>
                {creatorOptions.map(creator => (
                  <SelectItem key={creator.address} value={creator.address}>
                    {creator.displayName}
                    {' · '}
                    {creator.shortAddress}
                    {creator.hasServerSigner ? ' · server' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn(
                  'size-2.5 rounded-full',
                  status?.whitelistAddress ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                )}
                />
                <span className="text-sm font-medium">
                  {status?.whitelistAddress ? 'Whitelist registered' : 'Whitelist not registered'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{signerLabel}</span>
            </div>
            {status?.whitelistAddress && (
              <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
                {status.whitelistAddress}
              </p>
            )}
          </div>

          {status?.whitelistAddress && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Allowed proposers</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => setAddOpen(previous => !previous)}
                  disabled={isMutating}
                >
                  <PlusIcon className="size-3.5" />
                  Add
                </Button>
              </div>

              <div className="grid max-h-[280px] gap-2 overflow-y-auto rounded-md border p-2 pr-1">
                {proposerRows.map(proposer => (
                  <div
                    key={proposer}
                    className="flex items-center justify-between gap-2 rounded-sm bg-muted/25 px-2 py-1.5"
                  >
                    <span className="min-w-0 font-mono text-xs break-all text-muted-foreground">{proposer}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 rounded-md"
                      aria-label="Remove proposer"
                      disabled={isMutating || actionDisabled}
                      onClick={() => void mutate('remove', [proposer])}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!status?.whitelistAddress || addOpen) && (
            <div className="grid gap-2">
              <Label>{status?.whitelistAddress ? 'Add proposer wallets' : 'Initial proposer wallets'}</Label>
              <Textarea
                value={walletInput}
                onChange={event => setWalletInput(event.target.value)}
                placeholder="0x123..., 0xabc..."
                className="min-h-20"
                disabled={isMutating}
              />
              {showAddYourWallet && (
                <button
                  type="button"
                  className="w-fit text-xs font-medium text-primary hover:opacity-80"
                  onClick={() => setWalletInput(connectedAddress ?? '')}
                >
                  add your own wallet
                </button>
              )}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => void mutate(status?.whitelistAddress ? 'add' : 'create', walletInput)}
                  disabled={actionDisabled}
                >
                  {isMutating
                    ? <Loader2Icon className="size-4 animate-spin" />
                    : status?.whitelistAddress
                      ? <PlusIcon className="size-4" />
                      : <CheckCircle2Icon className="size-4" />}
                  {status?.whitelistAddress ? 'Add proposers' : 'Create whitelist'}
                </Button>
              </div>
            </div>
          )}

          {!canUseConnectedWallet && !canUseServerSigner && selectedCreator && (
            <p className="text-sm text-destructive">
              Connect this creator wallet or configure its private key in prediction-market to update the whitelist.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
