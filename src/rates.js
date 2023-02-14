const { ethers } = require('ethers');

// Minimal ABI
const univ2LiteAbi = [
  {
    constant: true,
    inputs: [],
    name: 'getReserves',
    outputs: [
      {
        internalType: 'uint112',
        name: '_reserve0',
        type: 'uint112',
      },
      {
        internalType: 'uint112',
        name: '_reserve1',
        type: 'uint112',
      },
      {
        internalType: 'uint32',
        name: '_blockTimestampLast',
        type: 'uint32',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
];

const getUniv2DataGivenIn = (aIn, reserveA, reserveB) => {
  const aInWithFee = aIn.mul(997);
  const numerator = aInWithFee.mul(reserveB);
  const denominator = aInWithFee.add(reserveA.mul(1000));
  const bOut = numerator.div(denominator);

  // Underflow
  let newReserveB = reserveB.sub(bOut);
  if (newReserveB.lt(0) || newReserveB.gt(reserveB)) {
    newReserveB = ethers.BigNumber.from(1);
  }

  // Overflow
  let newReserveA = reserveA.add(aIn);
  if (newReserveA.lt(reserveA)) {
    newReserveA = ethers.constants.MaxInt256;
  }

  return {
    amountOut: bOut,
    newReserveA,
    newReserveB,
  };
};

const getUsdPerMatic = async () => {
  // MATIC<>USDC pair on polygon
  // 0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827
  const provider = new ethers.providers.JsonRpcProvider(
    'https://polygon-rpc.com',
  );
  const pair = new ethers.Contract(
    '0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827',
    univ2LiteAbi,
    provider,
  );
  const [maticBal, usdcBal] = await pair.getReserves();

  const newRes = getUniv2DataGivenIn(
    ethers.utils.parseUnits('1'),
    maticBal,
    usdcBal,
  );

  return parseFloat(ethers.utils.formatUnits(newRes.amountOut, '6'));
};

module.exports = { getUsdPerMatic };
