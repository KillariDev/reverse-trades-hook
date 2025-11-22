import { describe, beforeEach, test } from 'node:test'
import { getMockedEthSimulateWindowEthereum, MockWindowEthereum } from '../testsuite/simulator/MockWindowEthereum.js'
import { createWriteClient } from '../testsuite/simulator/utils/viem.js'
import { PROXY_DEPLOYER_ADDRESS, TEST_ADDRESSES } from '../testsuite/simulator/utils/constants.js'
import { ensureReversibleTradesHookDeployed, getReversibleTradesHookAddress, setupTestAccounts } from '../testsuite/simulator/utils/utilities.js'
import { DAI_ADDRESS, deployPool, getPoolIdentifier, getPoolkey, readV4PoolState, STATE_VIEW, UNIV4_POOL_MANAGER, WETH_ADDRESS } from './hookUtils.js'
import { createTransactionExplainer } from '../testsuite/simulator/utils/transactionExplainer.js'
import { Deployment } from '../testsuite/simulator/utils/logExplaining.js'
import { addressString } from '../testsuite/simulator/utils/bigint.js'
import { ReversibleTradesHook_ReversibleTradesHook, uniswap_interfaces_IPoolManager_IPoolManager } from '../types/contractArtifact.js'
import { STATE_VIEW_ABI } from './abi.js'

const getDeployments = (): Deployment[] => {
	return [{
		abi: ReversibleTradesHook_ReversibleTradesHook.abi,
		deploymentName: 'Reversible hook',
		address: getReversibleTradesHookAddress(),
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
		await ensureReversibleTradesHookDeployed(client)
	})
	test('canDeployPoolAndGetKey', async () => {
		const client = createWriteClient(mockWindow, TEST_ADDRESSES[0], 0)
		await ensureReversibleTradesHookDeployed(client)
		await deployPool(client, WETH_ADDRESS, DAI_ADDRESS)
		const poolKey = await getPoolkey(client, WETH_ADDRESS, DAI_ADDRESS)
		console.log(poolKey)

		const poolIdentifier = await getPoolIdentifier(poolKey)
		console.log(poolIdentifier)
		const liq = await readV4PoolState(client, poolIdentifier)
		console.log(liq)
	})
})
