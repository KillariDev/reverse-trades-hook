import { Address } from 'viem'
import { ReadClient, WriteClient } from '../testsuite/simulator/utils/viem.js'
import { getReversibleTradesHookAddress } from '../testsuite/simulator/utils/utilities.js'
import { ReversibleTradesHook_ReversibleTradesHook } from '../types/contractArtifact.js'

export const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
export const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f'

export const deployPool = async (client: WriteClient, currency0: Address, currency1: Address) => {
	return await client.writeContract({
		abi: ReversibleTradesHook_ReversibleTradesHook.abi,
		functionName: 'deployPool',
		address: getReversibleTradesHookAddress(),
		args: [currency0, currency1]
	})
}

export const getPoolkey = async (client: ReadClient, currency0: Address, currency1: Address) => {
	return await client.readContract({
		abi: ReversibleTradesHook_ReversibleTradesHook.abi,
		functionName: 'getPoolKey',
		address: getReversibleTradesHookAddress(),
		args: [currency0, currency1]
	})
}
