// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import { IERC20 } from "./IERC20.sol";
import { PoolIdLibrary, PoolId } from "./uniswap/types/PoolId.sol";
import { PositionInfo, PositionInfoLibrary } from "./uniswap/libraries/PositionInfoLibrary.sol";
import { PoolKey } from "./uniswap/types/PoolKey.sol";
import { Currency, CurrencyLibrary } from "./uniswap/types/Currency.sol";
import { IPositionManager } from "./uniswap/interfaces/IPositionManager.sol";
import { Actions } from "./uniswap/libraries/Actions.sol";
import { Commands } from "./uniswap/libraries/Commands.sol";
import { IPoolManager } from './uniswap/interfaces/IPoolManager.sol';
import { IHooks } from './uniswap/interfaces/IHooks.sol';
import { TickMath } from "./uniswap/libraries/TickMath.sol";
import { LiquidityAmounts } from "./uniswap/libraries/LiquidityAmounts.sol";
import { StateLibrary } from "./uniswap/libraries/StateLibrary.sol";
import { IAllowanceTransfer } from "./uniswap/interfaces/external/IAllowanceTransfer.sol";
import { IV4Router } from './uniswap/interfaces/IV4Router.sol';
import { IUniversalRouter } from './uniswap/interfaces/IUniversalRouter.sol';
import { IV4Quoter } from './uniswap/interfaces/IV4Quoter.sol';
import { BeforeSwapDelta, BeforeSwapDeltaLibrary } from "./uniswap/types/BeforeSwapDelta.sol";
import { BalanceDelta } from "./uniswap/types/BalanceDelta.sol";

address constant UNIV4_POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
address constant UNIV4_POSITION_MANAGER = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
address constant UNIV4_ROUTER = 0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af;

contract ReversibleTradesHook {
	using CurrencyLibrary for uint256;

	struct swapOrder {
		PoolKey poolKey;
		bool buyYes;
		uint128 amountIn;
		uint128 amountOutMinimum;
		uint256 submittedTimestamp;
	}
	uint256 swapIndex;
	uint256 lastExecutedIndex;
	mapping(uint256 => swapOrder) swapOrders;

	address manager;
	bool swapOn;
	bool stopped;

	uint24 public constant initialFeePips = 50_000; // 5% fee
	int24 public constant tickSpacing = 1000; // NOTE: follows general fee -> tickSPacing convention but may need tweaking.
	uint160 private constant startingPrice = 79228162514264337593543950336; // 1:1 pricing magic number. The startingPrice is expressed as sqrtPriceX96: floor(sqrt(token1 / token0) * 2^96)

	// Hook Permissions
	struct Permissions {
		bool beforeInitialize;
		bool afterInitialize;
		bool beforeAddLiquidity;
		bool afterAddLiquidity;
		bool beforeRemoveLiquidity;
		bool afterRemoveLiquidity;
		bool beforeSwap;
		bool afterSwap;
		bool beforeDonate;
		bool afterDonate;
		bool beforeSwapReturnDelta;
		bool afterSwapReturnDelta;
		bool afterAddLiquidityReturnDelta;
		bool afterRemoveLiquidityReturnDelta;
	}

	// Hook fee flags
	uint24 public constant DYNAMIC_FEE_FLAG = 0x800000;
	uint24 public constant OVERRIDE_FEE_FLAG = 0x400000;

	constructor(address _manager) {
		manager = _manager;
	}

	function beforeSwap(
		address,
		PoolKey calldata,
		IPoolManager.SwapParams calldata,
		bytes calldata
	) external view returns (bytes4, BeforeSwapDelta, uint24) {
		require(!stopped, 'contract stopped');
		require(swapOn, 'not swapping');
		uint24 fee = initialFeePips | OVERRIDE_FEE_FLAG;
		return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee);
	}

	function afterSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata, BalanceDelta, bytes calldata)
		external pure
		returns (bytes4, int128)
	{
		return (this.afterSwap.selector, 0);
	}

	// todo add stop so liquidity cannot be added and removed all the time

	function getHookPermissions()
		public
		pure
		returns (Permissions memory)
	{
		return
			Permissions({
				beforeInitialize: false,
				afterInitialize: false,
				beforeAddLiquidity: false,
				afterAddLiquidity: false,
				beforeRemoveLiquidity: false,
				afterRemoveLiquidity: false,
				beforeSwap: true,
				afterSwap: true,
				beforeDonate: false,
				afterDonate: false,
				beforeSwapReturnDelta: false,
				afterSwapReturnDelta: false,
				afterAddLiquidityReturnDelta: false,
				afterRemoveLiquidityReturnDelta: false
			});
	}

	function getPoolKey(address currency0, address currency1) public view returns (PoolKey memory) {
		bool noGreater = uint160(currency0) < uint160(currency1);
		return PoolKey({
			currency0: noGreater ? CurrencyLibrary.fromId(uint160(currency0)) : CurrencyLibrary.fromId(uint160(currency1)),
			currency1: noGreater ? CurrencyLibrary.fromId(uint160(currency1)) : CurrencyLibrary.fromId(uint160(currency0)),
			fee: DYNAMIC_FEE_FLAG,
			tickSpacing: tickSpacing,
			hooks: IHooks(address(this))
		});
	}

	function deployPool(address currency0, address currency1) public {
		bool noGreater = uint160(currency0) < uint160(currency1);
		PoolKey memory pool = PoolKey({
			currency0: noGreater ? CurrencyLibrary.fromId(uint160(currency0)) : CurrencyLibrary.fromId(uint160(currency1)),
			currency1: noGreater ? CurrencyLibrary.fromId(uint160(currency1)) : CurrencyLibrary.fromId(uint160(currency0)),
			fee: DYNAMIC_FEE_FLAG,
			tickSpacing: tickSpacing,
			hooks: IHooks(address(this))
		});

		IPoolManager(UNIV4_POOL_MANAGER).initialize(pool, startingPrice);
	}
	function mintLiquidity(
		PoolKey memory poolKey,
		int24 tickLower,
		int24 tickUpper,
		uint128 desiredAmount0,
		uint128 desiredAmount1
	) external {
		PoolId poolId = PoolIdLibrary.toId(poolKey);

		approveAll(Currency.unwrap(poolKey.currency0));
		approveAll(Currency.unwrap(poolKey.currency1));

		IERC20(Currency.unwrap(poolKey.currency0)).transferFrom(msg.sender, address(this), desiredAmount0);
		IERC20(Currency.unwrap(poolKey.currency1)).transferFrom(msg.sender, address(this), desiredAmount1);
		uint256 liquidity = getExpectedLiquidityInternal(poolId, tickLower, tickUpper, desiredAmount0, desiredAmount1);
		// 6. Prepare params for modifyLiquidities
		bytes[] memory params = new bytes[](2);
		params[0] = abi.encode(poolKey, tickLower, tickUpper, liquidity, desiredAmount0, desiredAmount1, msg.sender, "");
		params[1] = abi.encode(poolKey.currency0, poolKey.currency1);

		// 7. Mint the liquidity position
		IPositionManager(UNIV4_POSITION_MANAGER).modifyLiquidities(
			abi.encode(abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR)), params),
			block.timestamp + 1000
		);
	}

	function getExpectedLiquidityInternal(PoolId poolId, int24 tickLower, int24 tickUpper, uint128 amount0Max, uint128 amount1Max) internal view returns (uint256) {
		(uint160 sqrtPriceX96,,,) = StateLibrary.getSlot0(IPoolManager(UNIV4_POOL_MANAGER), poolId);
		return LiquidityAmounts.getLiquidityForAmounts(
			sqrtPriceX96,
			TickMath.getSqrtPriceAtTick(tickLower),
			TickMath.getSqrtPriceAtTick(tickUpper),
			amount0Max,
			amount1Max
		);
	}
	function initiateSwap(PoolKey memory poolKey, bool buyYes, uint128 amountIn, uint128 amountOutMinimum) external {
		//todo, require adding an incentive for caller
		swapIndex++;
		swapOrders[swapIndex].poolKey = poolKey;
		swapOrders[swapIndex].buyYes = buyYes;
		swapOrders[swapIndex].amountIn = amountIn;
		swapOrders[swapIndex].amountOutMinimum = amountOutMinimum;
		swapOrders[swapIndex].submittedTimestamp = block.timestamp;

		// todo get money in
	}
	function executeSwap(uint256 index) external {
		//todo, add incentive
		require(block.timestamp + 3600 > swapOrders[index].submittedTimestamp, 'not old enough!');
		require(index == lastExecutedIndex + 1, 'need to execute in order');
		require(!stopped, 'stopped!');
		require(!swapOn, 'already swapping!');
		//todo, add try catch for failures
		swapOn = true;
		swapExactIn(swapOrders[swapIndex].poolKey, swapOrders[swapIndex].buyYes, swapOrders[swapIndex].amountIn, swapOrders[swapIndex].amountOutMinimum);
		swapOn = false;
	}

	function stopPool() external {
		require(msg.sender == manager, 'not a manager');
		stopped = true;

		//todo return users money
	}

	function swapExactIn(PoolKey memory poolKey, bool swapYes, uint128 exactAmountIn, uint128 minAmountOut) private {
		approveAll(Currency.unwrap(poolKey.currency0));
		approveAll(Currency.unwrap(poolKey.currency1));

		address shareTokenIn = Currency.unwrap(swapYes ? poolKey.currency1 : poolKey.currency0);
		address shareTokenOut = Currency.unwrap(swapYes ? poolKey.currency0 : poolKey.currency1);
		IERC20(shareTokenIn).transferFrom(msg.sender, address(this), exactAmountIn);
		performExactInSwapInternal(poolKey, !swapYes, exactAmountIn, minAmountOut, block.timestamp+100);
		IERC20(shareTokenOut).transfer(msg.sender, IERC20(shareTokenOut).balanceOf(address(this)));
	}

	function performExactInSwapInternal(PoolKey memory poolKey, bool buyYes, uint128 amountIn, uint128 amountOutMinimum, uint256 deadline) internal {
		bytes[] memory inputs = new bytes[](1);
		bytes[] memory params = new bytes[](3);

		params[0] = abi.encode(
			IV4Router.ExactInputSingleParams({
				poolKey: poolKey,
				zeroForOne: buyYes,
				amountIn: amountIn,
				amountOutMinimum: amountOutMinimum,
				hookData: bytes("")
			})
		);
		params[1] = abi.encode(buyYes ? poolKey.currency0 : poolKey.currency1, amountIn);
		params[2] = abi.encode(buyYes ? poolKey.currency1 : poolKey.currency0, amountOutMinimum);
		inputs[0] = abi.encode(abi.encodePacked(uint8(Actions.SWAP_EXACT_IN_SINGLE), uint8(Actions.SETTLE_ALL), uint8(Actions.TAKE_ALL)), params);
		IUniversalRouter(UNIV4_ROUTER).execute(abi.encodePacked(uint8(Commands.V4_SWAP)), inputs, deadline);
	}

	function approveAll(address a) private {
		IERC20(a).approve(UNIV4_POSITION_MANAGER, type(uint256).max);
		IERC20(a).approve(UNIV4_POOL_MANAGER, type(uint256).max);
		IERC20(a).approve(UNIV4_ROUTER, type(uint256).max);
		IERC20(a).approve(PERMIT2, type(uint256).max);
		IAllowanceTransfer(PERMIT2).approve(a, UNIV4_POSITION_MANAGER, type(uint160).max, uint48(block.timestamp + 1000));
		IAllowanceTransfer(PERMIT2).approve(a, UNIV4_ROUTER, type(uint160).max, uint48(block.timestamp + 1000));
	}
}
