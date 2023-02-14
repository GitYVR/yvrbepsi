const { Gpio } = require('onoff');
const { sleep } = require('./common');

let isDispensing = false;

const dispense = async (pinNo) => {
  // Can only dispense one at a time to avoid overloading
  if (isDispensing) return;
  isDispensing = true;

  let pin;
  try {
    pin = new Gpio(pinNo, 'out');
  } catch (e) {
    console.log(
      `Error initializing GPIO pin ${pin}, running in simulation mode...`,
    );
    return;
  }
  pin.writeSync(0);
  await sleep(1000);
  pin.writeSync(1);
  isDispensing = false;
};

// Right to left, pins
// [4, 5, 6, 12, 13, 16, 9]

module.exports = {
  dispense,
};
