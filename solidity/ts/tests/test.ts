import { describe, beforeEach, test } from 'node:test'
import { getMockedEthSimulateWindowEthereum, MockWindowEthereum } from '../testsuite/simulator/MockWindowEthereum.js'
import { createWriteClient } from '../testsuite/simulator/utils/viem.js'
import { TEST_ADDRESSES } from '../testsuite/simulator/utils/constants.js'
import { ensureReversibleTradesHookDeployed, setupTestAccounts } from '../testsuite/simulator/utils/utilities.js'
import { DAI_ADDRESS, deployPool, getPoolkey, WETH_ADDRESS } from './hookUtils.js'

describe('Contract Test Suite', () => {
	let mockWindow: MockWindowEthereum
	beforeEach(async () => {
		mockWindow = getMockedEthSimulateWindowEthereum()
		await setupTestAccounts(mockWindow)
	})

	test('canDeployContract', async () => {
		const client = createWriteClient(mockWindow, TEST_ADDRESSES[0], 0)
		await ensureReversibleTradesHookDeployed(client)
	})
	test('canDeployPoolAndGetket', async () => {
		const client = createWriteClient(mockWindow, TEST_ADDRESSES[0], 0)
		await ensureReversibleTradesHookDeployed(client)
		await deployPool(client, WETH_ADDRESS, DAI_ADDRESS)
		const poolKey = await getPoolkey(client, WETH_ADDRESS, DAI_ADDRESS)
		console.log(poolKey)
	})
})
