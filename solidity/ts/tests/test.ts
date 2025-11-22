import { describe, beforeEach, test } from 'node:test'
import { getMockedEthSimulateWindowEthereum, MockWindowEthereum } from '../testsuite/simulator/MockWindowEthereum.js'
import { createWriteClient } from '../testsuite/simulator/utils/viem.js'
import { PROXY_DEPLOYER_ADDRESS, TEST_ADDRESSES } from '../testsuite/simulator/utils/constants.js'
import { approveToken, checkHookSalt, ensureReversibleTradesHookDeployed, getERC20Balance, getReversibleTradesHookAddress, isReversibleTradesHookDeployed, permit2Approve, setupTestAccounts } from '../testsuite/simulator/utils/utilities.js'
import { addLiquidity, DAI_ADDRESS, deployPool, getPoolIdentifier, getPoolkey, readV4PoolState, STATE_VIEW, UNIV4_POOL_MANAGER, UNIV4_POSITION_MANAGER, UNIV4_ROUTER, WETH_ADDRESS, wrapEth } from './hookUtils.js'
import { createTransactionExplainer } from '../testsuite/simulator/utils/transactionExplainer.js'
import { Deployment } from '../testsuite/simulator/utils/logExplaining.js'
import { addressString } from '../testsuite/simulator/utils/bigint.js'
import { ERC20_ERC20, ReversibleTradesHook_ReversibleTradesHook, uniswap_interfaces_IPoolManager_IPoolManager } from '../types/contractArtifact.js'
import { STATE_VIEW_ABI } from './abi.js'
import assert from 'node:assert'

const hookSalt = checkHookSalt()
const getDeployments = (): Deployment[] => {
	return [{
		abi: ReversibleTradesHook_ReversibleTradesHook.abi,
		deploymentName: 'Reversible hook',
		address: getReversibleTradesHookAddress(hookSalt),
	}, {
		abi: undefined,
		deploymentName: 'proxy depoyer',
		address: addressString(PROXY_DEPLOYER_ADDRESS),
	}, {
		abi: uniswap_interfaces_IPoolManager_IPoolManager.abi,
		deploymentName: 'UniV4 Pool manager',
		address: UNIV4_POOL_MANAGER
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
	}]
}

describe('Contract Test Suite', () => {
	let mockWindow: MockWindowEthereum
	beforeEach(async () => {
		mockWindow = getMockedEthSimulateWindowEthereum()
		mockWindow.setAfterTransactionSendCallBack(createTransactionExplainer(getDeployments()))
		await setupTestAccounts(mockWindow)
	})

	test('canDeployContract', async () => {
		const client = createWriteClient(mockWindow, TEST_ADDRESSES[0], 0)
		await ensureReversibleTradesHookDeployed(client, hookSalt)
		assert.ok(await isReversibleTradesHookDeployed(client, hookSalt), 'not deployed')
	})
	test('canDeployPoolAndGetKey', async () => {
		const client = createWriteClient(mockWindow, TEST_ADDRESSES[0], 0)
		await ensureReversibleTradesHookDeployed(client, hookSalt)
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
		await approveToken(client, DAI_ADDRESS, UNIV4_POOL_MANAGER)
		await approveToken(client, WETH_ADDRESS, UNIV4_POOL_MANAGER)
		await approveToken(client, WETH_ADDRESS, getReversibleTradesHookAddress(hookSalt))
		await approveToken(client, DAI_ADDRESS, getReversibleTradesHookAddress(hookSalt))
		await permit2Approve(client, DAI_ADDRESS, UNIV4_POSITION_MANAGER)
		await permit2Approve(client, WETH_ADDRESS, UNIV4_POSITION_MANAGER)
		await permit2Approve(client, DAI_ADDRESS, UNIV4_ROUTER)
		await permit2Approve(client, WETH_ADDRESS, UNIV4_ROUTER)

		await addLiquidity(client, hookSalt, poolKey, 0, 1000, 100n * 10n**18n, 100n * 10n**18n)
		//await modifyPoolLiquidity(client, poolKey, { tickLower: 1 , tickUpper: 8000, liquidityDelta: 1000000n, salt: '0x0000000000000000000000000000000000000000000000000000000000000000' }, '0x')

		const liq2 = await readV4PoolState(client, poolIdentifier)
		console.log(liq2)
	})
})
