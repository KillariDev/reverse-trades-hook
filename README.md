# Rollback Hook

![Rollback Hook](./icon.png)

Rollback Hook is an [Uniswap V4 hook](https://docs.uniswap.org/contracts/v4/quickstart/hooks/swap) hook built for prediction markets, giving liquidity providers a way to manage risk during rapid price movements. It introduces a mechanism where queued trades can be reversed for up to one hour before becoming permanent. This provides protection when markets experience sudden volatility, such as moments when an outcome becomes clear even though the market is still officially active. [The contract is deployed on Sepolia](https://sepolia.etherscan.io/address/0x69a4917737b578d5a917ee70118dc1c21c3d00c0)

The pool deployer can choose when to trigger a rollback. Once this happens, the pool is no longer usable, and liquidity providers can withdraw their positions. The deployer holds only this single privilege: the ability to revert up to one hour of recent trades, without any additional control over the market.

## Usage

### Compile Contracts
```bash
npm run contracts
````

### Run Tests

```bash
npm run test
```

### Deploy to Sepolia

```bash
npm run deploy
```
