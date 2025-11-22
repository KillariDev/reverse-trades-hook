import { Address, encodeAbiParameters, keccak256 } from 'viem'
import { ReadClient, WriteClient } from '../testsuite/simulator/utils/viem.js'
import { getReversibleTradesHookAddress } from '../testsuite/simulator/utils/utilities.js'
import { ReversibleTradesHook_ReversibleTradesHook, uniswap_interfaces_IPoolManager_IPoolManager } from '../types/contractArtifact.js'
import { STATE_VIEW_ABI } from './abi.js'

export const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
export const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f'
export const UNIV4_POOL_MANAGER = '0x000000000004444c5dc75cB358380D2e3dE08A90'
export const STATE_VIEW = '0x7ffe42c4a5deea5b0fec41c94c136cf115597227'

export const deployPool = async (client: WriteClient, currency0: Address, currency1: Address) => {
	return await client.writeContract({
		abi: ReversibleTradesHook_ReversibleTradesHook.abi,
		functionName: 'deployPool',
		address: getReversibleTradesHookAddress(),
		args: [currency0, currency1]
	})
}

type PoolKey = {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
}

type ModifyLiquidityParams = {
	tickLower: bigint,
	tickUpper: bigint,
	liquidityDelta: bigint
}

export const getPoolkey = async (client: ReadClient, currency0: Address, currency1: Address) => {
	return await client.readContract({
		abi: ReversibleTradesHook_ReversibleTradesHook.abi,
		functionName: 'getPoolKey',
		address: getReversibleTradesHookAddress(),
		args: [currency0, currency1]
	})
}

export const getPoolIdentifier = async (poolKey: PoolKey) => {
		const encodedPoolKey = encodeAbiParameters(
		[
			{ name: 'currency0', type: 'address' },
			{ name: 'currency1', type: 'address' },
			{ name: 'fee', type: 'uint24' },
			{ name: 'tickSpacing', type: 'int24' },
			{ name: 'hook', type: 'address' }
		],
		[
			poolKey.currency0,
			poolKey.currency1,
			poolKey.fee,
			poolKey.tickSpacing,
			poolKey.hooks
		]
	)
	return keccak256(encodedPoolKey)
}


export const modifyPoolLiquidity = async (
	client: WriteClient,
	poolKey: PoolKey,
	modifyLiquidityParams: ModifyLiquidityParams,
	hookData: Address
) => {
	const transactionHash = await client.writeContract({
		address: UNIV4_POOL_MANAGER,
		abi: uniswap_interfaces_IPoolManager_IPoolManager.abi,
		functionName: 'modifyLiquidity',
		args: [
			poolKey,
			modifyLiquidityParams,
			hookData
		]
	})

	return transactionHash
}
export async function readV4PoolState(client: ReadClient, poolIdentifier: `0x${string}`) {
	const liquidity = await client.readContract({
		abi: STATE_VIEW_ABI,
		functionName: 'getLiquidity',
		address: STATE_VIEW,
		args: [poolIdentifier]
	})
	const slot0 = await client.readContract({
		abi: STATE_VIEW_ABI,
		functionName: 'getSlot0',
		address: STATE_VIEW,
		args: [poolIdentifier]
	})

	const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0

	return {
		sqrtPriceX96,
		tick,
		protocolFee,
		lpFee,
		liquidity
	}
}

export const initiateSwap = () => {

}

export const executeSwap = () => {

}

export const reverseTrades = () => {

}
