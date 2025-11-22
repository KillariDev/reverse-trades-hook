import { Address, encodeAbiParameters, keccak256 } from 'viem'
import { ReadClient, WriteClient } from '../testsuite/simulator/utils/viem.js'
import { getReversibleTradesHookAddress } from '../testsuite/simulator/utils/utilities.js'
import { ReversibleTradesHook_ReversibleTradesHook } from '../types/contractArtifact.js'
import { STATE_VIEW_ABI } from './abi.js'

export const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
export const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f'
export const UNIV4_POOL_MANAGER = '0x000000000004444c5dc75cB358380D2e3dE08A90'
export const STATE_VIEW = '0x7ffe42c4a5deea5b0fec41c94c136cf115597227'
export const UNIV4_ROUTER = '0x00000000000044a361ae3cac094c9d1b14eece97'
export const UNIV4_POSITION_MANAGER = '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e'

export const deployPool = async (client: WriteClient, hookSalt: bigint, currency0: Address, currency1: Address) => {
	return await client.writeContract({
		abi: ReversibleTradesHook_ReversibleTradesHook.abi,
		functionName: 'deployPool',
		address: getReversibleTradesHookAddress(hookSalt),
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

export const getPoolkey = async (client: ReadClient, hookSalt: bigint, currency0: Address, currency1: Address) => {
	return await client.readContract({
		abi: ReversibleTradesHook_ReversibleTradesHook.abi,
		functionName: 'getPoolKey',
		address: getReversibleTradesHookAddress(hookSalt),
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

export const addLiquidity = async (client: WriteClient, hookSalt: bigint, poolKey: PoolKey, tickLower: number, tickUpper: number, amount0: bigint, amount1: bigint) => {
	return await client.writeContract({
		abi: ReversibleTradesHook_ReversibleTradesHook.abi,
		functionName: 'mintLiquidity',
		address: getReversibleTradesHookAddress(hookSalt),
		args: [poolKey, tickLower, tickUpper, amount0, amount1]
	})
}

export const initiateSwap = () => {

}

export const executeSwap = () => {

}

export const reverseTrades = () => {

}

export async function wrapEth(client: WriteClient, amountInEth: bigint) {
	const WETH_ABI = [
		{
			name: 'deposit',
			type: 'function',
			stateMutability: 'payable',
			inputs: [],
			outputs: []
		}
	]

	return await client.writeContract({
		address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
		abi: WETH_ABI,
		functionName: 'deposit',
		value: amountInEth
	})
}

export async function swapExactInV4(
	walletClient: ReturnType<typeof createWalletClient>,
	routerAddress: `0x${string}`,
	params: SwapV4Params
) {
	// 1. Build poolKey
	const poolKey: PoolKey = {
		currency0: params.token0,
		currency1: params.token1,
		fee: params.fee,
		tickSpacing: params.tickSpacing,
		hooks: params.hookAddress
	}

	// 2. Plan the swap actions
	const v4Planner = new V4Planner()
	v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
		{
			poolKey,
			zeroForOne: params.zeroForOne,
			amountIn: params.amountIn.toString(),
			amountOutMinimum: params.minAmountOut.toString(),
			hookData: "0x"
		}
	])
	v4Planner.addAction(Actions.SETTLE_ALL, [poolKey.currency0, params.amountIn.toString()])
	v4Planner.addAction(Actions.TAKE_ALL, [poolKey.currency1, params.minAmountOut.toString()])

	const { actions, params: plannerParams } = v4Planner.finalize()

	// 3. Encode into router command
	const routePlanner = new RoutePlanner()
	routePlanner.addCommand(CommandType.V4_SWAP, [actions, plannerParams])

	const commands = routePlanner.commands

	// 4. Execute the transaction using viem walletClient
	const txHash = await walletClient.writeContract({
		address: routerAddress,
		abi: UNIVERSAL_ROUTER_ABI,
		functionName: "execute",
		args: [commands, [actions], params.deadline],
		value: params.zeroForOne ? params.amountIn : 0n
	})

	return txHash
}
