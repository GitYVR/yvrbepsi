const { ethers } = require('ethers');
const abiDecoder = require('abi-decoder');
const { dispense } = require('./src/vendor');
const {
  RPC_URL,
  MULTISIG_ADDRESS,
  MIN_MATIC_PAYMENT_USD,
  VENDOR_SELECTION_TO_PIN_MAPPING,
  USDC_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
} = require('./src/constants');
const {
  match,
  contains,
  isPaymentValid,
  getStablecoinName,
  parseStablecoin,
  randomPin,
} = require('./src/common');
const { getUsdPerMatic } = require('./src/rates');

abiDecoder.addABI(require('./abi/erc20.json'));

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Handle payments
const handleMaticPayment = async (txs) => {
  console.log('matic payments', txs);

  if (txs.length <= 0) return;

  const usdPerMatic = await getUsdPerMatic().catch((e) => {
    console.log('FAILED TO GET USD PER MATIC', e);
    return 10000000000;
  });

  console.log('usdPerMatic', usdPerMatic);

  for (let i = 0; i < txs.length; i++) {
    const curTx = txs[i];

    const paidValueUSD = parseFloat(ethers.utils.formatEther(curTx.value)) * usdPerMatic;

    // Dispense!
    if (paidValueUSD > MIN_MATIC_PAYMENT_USD) {
      const selection = parseInt(curTx.data, 16);
      let pin = VENDOR_SELECTION_TO_PIN_MAPPING[selection];
      if (Number.isNaN(pin) || pin === undefined) {
        pin = randomPin();
      }

      console.log(
        `payment received ${ethers.utils.formatEther(
          curTx.value,
        )} matic (usd: ${paidValueUSD}), selection: ${selection}, pin ${pin}, dispensing...`,
      );

      // eslint-disable-next-line
      await dispense(pin);
    } else {
      console.log(
        `payment received (NOT ENOUGH) ${ethers.utils.formatEther(
          curTx.value,
        )} matic (usd: ${paidValueUSD})`,
      );
    }
  }
};

const handleStablecoinPayments = async (txs) => {
  const stablecoinTxs = txs
    .filter((x) => {
      const to = x.decodedData.params[0].value;
      const amountWei = x.decodedData.params[1].value;
      return isPaymentValid(x.to, to, amountWei);
    })
    .map((x) => {
      const amountWei = x.decodedData.params[1].value;
      const selection = parseInt(amountWei.slice(-1), 16);
      let pin = VENDOR_SELECTION_TO_PIN_MAPPING[selection];
      if (Number.isNaN(pin) || pin === undefined) {
        pin = randomPin();
      }

      return {
        ...x,
        selection,
        pin,
      };
    });

  console.log('stablecoinTxs', stablecoinTxs);

  if (stablecoinTxs.length <= 0) return;

  for (let i = 0; i < stablecoinTxs.length; i++) {
    const curTx = stablecoinTxs[i];

    console.log(
      `payment received ${parseStablecoin(
        curTx.to,
        curTx.decodedData.params[1].value,
      )} ${getStablecoinName(curTx.to)}, selection: ${curTx.selection}, pin ${
        curTx.pin
      }, dispensing...`,
    );

    // eslint-disable-next-line
    await dispense(curTx.pin);
  }
};

const onBlock = async (b) => {
  const block = await provider.getBlockWithTransactions(b);

  // Handles matic payments
  const maticPayments = block.transactions
    .filter((x) => match(x.to || '', MULTISIG_ADDRESS))
    .filter((x) => x.value.gt(ethers.constants.Zero));

  // Handles ERC20 payments
  const stablecoinPayments = block.transactions
    .filter((x) => contains([USDC_ADDRESS, USDT_ADDRESS, DAI_ADDRESS], x.to))
    .map((x) => ({
      ...x,
      decodedData: abiDecoder.decodeMethod(x.data),
    }))
    .filter((x) => x.decodedData !== undefined)
    .filter((x) => x.decodedData.name === 'transfer');

  console.log('block', b);
  handleMaticPayment(maticPayments);
  handleStablecoinPayments(stablecoinPayments);
};

// If matic, then
provider.on('block', (b) => {
  onBlock(b);
});
