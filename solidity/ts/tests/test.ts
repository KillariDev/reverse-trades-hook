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
import { STATE_VIEW_ABI, UNIV4_ROUTER_ABI } from './abi.js'
import assert from 'node:assert'

const MANAGER = addressString(TEST_ADDRESSES[0])

const hookSalt = checkHookSalt(MANAGER, 156219n)
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
		abi: ERC20_ERC20.abi,
		deploymentName: 'Weth',
		address: WETH_ADDRESS
	}, {
		abi: undefined,
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
	test('canDeployPoolAndGetKey', async () => {
		const client = createWriteClient(mockWindow, TEST_ADDRESSES[0], 0)
		await ensureReversibleTradesHookDeployed(client, MANAGER, hookSalt)
		await deployPool(client, hookSalt, WETH_ADDRESS, DAI_ADDRESS)
		const poolKey = await getPoolkey(client, hookSalt, WETH_ADDRESS, DAI_ADDRESS)
		console.log(poolKey)

		const poolIdentifier = await getPoolIdentifier(poolKey)
		console.log(poolIdentifier)
		const liq = await readV4PoolState(client, poolIdentifier)
		await wrapEth(client, 10000n * 10n**18n)
		console.log(liq)
		assert.ok(await getERC20Balance(client, DAI_ADDRESS, client.account.address) > 100n * 10n**18n, 'account has dai')
		assert.ok(await getERC20Balance(client, WETH_ADDRESS, client.account.address) > 100n * 10n**18n, 'account has weth')

		await addLiquidity(client, hookSalt, poolKey, 0, 1000, 100n * 10n**18n, 100n * 10n**18n)

		const liq2 = await readV4PoolState(client, poolIdentifier)
		console.log(liq2)

		await swapExactIn(client, hookSalt, poolKey, true, 1000000n, 0n)
		assert.rejects(executeSwap(client, hookSalt, 1n), 'cannot execute transaction right away')
		await mockWindow.advanceTime(7200n)
		await swapExactIn(client, hookSalt, poolKey, true, 1000000n, 0n)
		await executeSwap(client, hookSalt, 1n)
		await stopPool(client, hookSalt)
		await mockWindow.advanceTime(7200n)
		assert.rejects(executeSwap(client, hookSalt, 1n), 'pool should be stopped')

		const liq3 = await readV4PoolState(client, poolIdentifier)
		console.log(liq3)
	})
})
