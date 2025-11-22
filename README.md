# Rollback Hook

![Rollback Hook](./icon.png)

Rollback Hook is an advanced [Uniswap V4 hook](https://docs.uniswap.org/contracts/v4/quickstart/hooks/swap) designed for **prediction markets**, enabling liquidity providers to manage risk when market prices change rapidly. It allows queued trades to be **temporarily reversible** for up to 1 hour, after which trades become final. This ensures LPs are protected from sudden volatility in prediction markets. This sudden volatility might happen when the market outcome is known, even thought the market has not ended yet. [Deployed on Sepolia](https://sepolia.etherscan.io/address/0x69a4917737b578d5a917ee70118dc1c21c3d00c0).

## Key Features

- **Prediction Market Liquidity Pool**
  Works like a standard Uniswap pool for "yes" and "no" shares, allowing traders to interact seamlessly with the market.

- **Queued Orders**
  All trades are queued and executed in order. Orders can only be finalized **after one hour**, giving the market manager time to review price changes.

- **Trade Reversal for Market Protection**
  If the market odds move too quickly, a predefined manager can **stop the pool**, preventing queued trades from executing. This helps protect liquidity providers from unexpected losses due to sudden price swings.

- **Seamless User Experience**
  From a trader's perspective, the pool functions like a normal Uniswap AMM, with the rollback and queueing happening transparently in the background.

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
