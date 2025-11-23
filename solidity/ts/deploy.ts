import { privateKeyToAccount } from 'viem/accounts'
import { checkHookSalt, deployReversibleTradesHookTransaction } from './testsuite/simulator/utils/utilities.js'
import { Address, createWalletClient, http, publicActions } from 'viem'
import { sepolia } from 'viem/chains'
import { waitForTransactionReceipt } from 'viem/actions'

const userPrivateKey = "0x79857633bb53b1a9e7e2a6c99132e153093f773c60e779472e8900b0a63ea74e"
const manager = '0x947E624AE91078b66eF602BC2471faffd1c78FE2'
const hookSalt = checkHookSalt(manager)

export function createWriteClientPrivKey(privateKey: Address, cacheTime: number, rpc: string) {
	const account = privateKeyToAccount(privateKey)
	return createWalletClient({
		account: account,
		chain: sepolia,
		transport: http(rpc),
		cacheTime: cacheTime ?? 10_000
	}).extend(publicActions)
}

const deploy = async () => {
	const writeClient = createWriteClientPrivKey(userPrivateKey, 0, 'https://api.zan.top/eth-sepolia')
	console.log('sending')
	const hash = await writeClient.sendTransaction(deployReversibleTradesHookTransaction(manager, hookSalt))
	console.log('sent hash:', hash)
	const receipt = await waitForTransactionReceipt(writeClient, { hash: hash })
	console.log('Done!')
	console.log(receipt)
}

deploy()
