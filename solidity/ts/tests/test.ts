import { describe, beforeEach, test } from 'node:test'
import { getMockedEthSimulateWindowEthereum, MockWindowEthereum } from '../testsuite/simulator/MockWindowEthereum.js'
import { createWriteClient } from '../testsuite/simulator/utils/viem.js'
import { PROXY_DEPLOYER_ADDRESS, TEST_ADDRESSES } from '../testsuite/simulator/utils/constants.js'
import { approveToken, checkHookSalt, ensureReversibleTradesHookDeployed, getERC20Balance, getReversibleTradesHookAddress, isReversibleTradesHookDeployed, permit2Approve, setupTestAccounts } from '../testsuite/simulator/utils/utilities.js'
import { addLiquidity, DAI_ADDRESS, deployPool, executeSwap, getPoolIdentifier, getPoolkey, readV4PoolState, STATE_VIEW, stopPool, swapExactIn, UNIV4_POOL_MANAGER, UNIV4_POSITION_MANAGER, UNIV4_ROUTER, WETH_ADDRESS, wrapEth } from './hookUtils.js'
import { createTransactionExplainer } from '../testsuite/simulator/utils/transactionExplainer.js'
import { Deployment } from '../testsuite/simulator/utils/logExplaining.js'
import { addressString } from '../testsuite/simulator/utils/bigint.js'
import { ERC20_ERC20, ReversibleTradesHook_ReversibleTradesHook, uniswap_interfaces_IPoolManager_IPoolManager, uniswap_libraries_Position_Position } from '../types/contractArtifact.js'
import { PERMIT2_ABI, STATE_VIEW_ABI, UNIV4_ROUTER_ABI, WETH_ABI } from './abi.js'
import assert from 'node:assert'

const MANAGER = addressString(TEST_ADDRESSES[0])

const hookSalt = checkHookSalt(MANAGER, 51852n)
const getDeployments = (): Deployment[] => {
	return [{
		abi: ReversibleTradesHook_ReversibleTradesHook.abi,
		deploymentName: 'Reversible hook',
		address: getReversibleTradesHookAddress(MANAGER, hookSalt),
	}, {
		abi: undefined,
		deploymentName: 'proxy depoyer',
		address: addressString(PROXY_DEPLOYER_ADDRESS),
	}, {
		abi: uniswap_interfaces_IPoolManager_IPoolManager.abi,
		deploymentName: 'UniV4 Pool manager',
		address: UNIV4_POOL_MANAGER
	}, {
		abi: uniswap_libraries_Position_Position.abi,
		deploymentName: 'Position manager',
		address: UNIV4_POSITION_MANAGER
	}, {
		abi: UNIV4_ROUTER_ABI,
		deploymentName: 'router',
		address: UNIV4_ROUTER
	}, {
		abi: STATE_VIEW_ABI,
		deploymentName: 'State View',
		address: STATE_VIEW
	}, {
		abi: ERC20_ERC20.abi,
		deploymentName: 'DAI',
		address: DAI_ADDRESS
	}, {
		abi: WETH_ABI,
		deploymentName: 'Weth',
		address: WETH_ADDRESS
	}, {
		abi: PERMIT2_ABI,
		deploymentName: 'Permit2',
		address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
	}]
}

describe('Contract Test Suite', () => {
	let mockWindow: MockWindowEthereum
	beforeEach(async () => {
		mockWindow = getMockedEthSimulateWindowEthereum()
		mockWindow.setAfterTransactionSendCallBack(createTransactionExplainer(getDeployments()))
		await setupTestAccounts(mockWindow)
		const client = createWriteClient(mockWindow, TEST_ADDRESSES[0], 0)
		await approveToken(client, DAI_ADDRESS, UNIV4_POOL_MANAGER)
		await approveToken(client, WETH_ADDRESS, UNIV4_POOL_MANAGER)
		await approveToken(client, WETH_ADDRESS, getReversibleTradesHookAddress(MANAGER, hookSalt))
		await approveToken(client, DAI_ADDRESS, getReversibleTradesHookAddress(MANAGER, hookSalt))
		await permit2Approve(client, DAI_ADDRESS, UNIV4_POSITION_MANAGER)
		await permit2Approve(client, WETH_ADDRESS, UNIV4_POSITION_MANAGER)
		await permit2Approve(client, DAI_ADDRESS, UNIV4_ROUTER)
		await permit2Approve(client, WETH_ADDRESS, UNIV4_ROUTER)
	})

	test('canDeployContract', async () => {
		const client = createWriteClient(mockWindow, TEST_ADDRESSES[0], 0)
		await ensureReversibleTradesHookDeployed(client, MANAGER, hookSalt)
		assert.ok(await isReversibleTradesHookDeployed(client, MANAGER, hookSalt), 'not deployed')
	})
	test('Can add pending swaps and stop the pool', async () => {
		const client = createWriteClient(mockWindow, TEST_ADDRESSES[0], 0)

		// deploy hook
		await ensureReversibleTradesHookDeployed(client, MANAGER, hookSalt)

		// deploy pool
		await deployPool(client, hookSalt, WETH_ADDRESS, DAI_ADDRESS)
		const poolKey = await getPoolkey(client, hookSalt, WETH_ADDRESS, DAI_ADDRESS)

		const poolIdentifier = await getPoolIdentifier(poolKey)

		//check that liquidity is zero in new pool
		const liq = await readV4PoolState(client, poolIdentifier)
		assert.ok(liq.liquidity === 0n, 'liquidity is zero')

		// wrap some eth that we can use for testing
		await wrapEth(client, 10000n * 10n**18n)

		// check we have enough weth and dai
		assert.ok(await getERC20Balance(client, DAI_ADDRESS, client.account.address) > 100n * 10n**18n, 'account has dai')
		assert.ok(await getERC20Balance(client, WETH_ADDRESS, client.account.address) > 100n * 10n**18n, 'account has weth')

		// add liquidity o the pool
		await addLiquidity(client, hookSalt, poolKey, 0, 1000, 100n * 10n**18n, 100n * 10n**18n)

		// check we have liquidity
		const liq2 = await readV4PoolState(client, poolIdentifier)
		assert.ok(liq2.liquidity > liq.liquidity, 'added liquidity')

		// queue swap to the pool
		await swapExactIn(client, hookSalt, poolKey, true, 1000000n, 0n)

		// we should not be able to execute it right away
		await assert.rejects(executeSwap(client, hookSalt, 1n), 'cannot execute transaction right away')
		await mockWindow.advanceTime(7200n)

		// add another transaction to pending
		await swapExactIn(client, hookSalt, poolKey, true, 1000000n, 0n)

		// we should be able to do that now as time has pased
		await executeSwap(client, hookSalt, 1n)

		// price should change
		const liq3 = await readV4PoolState(client, poolIdentifier)
		assert.ok(liq2.sqrtPriceX96 !== liq3.sqrtPriceX96, 'price changed')

		// stop pool
		await stopPool(client, hookSalt)
		await mockWindow.advanceTime(7200n)

		// we should no longer be able to swap
		await assert.rejects(executeSwap(client, hookSalt, 1n), 'pool should be stopped')
	})
})
