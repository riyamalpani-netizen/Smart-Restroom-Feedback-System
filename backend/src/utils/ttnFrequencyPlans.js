// Official TTN v3 frequency plan IDs — keep in sync with frontend src/utils/constants.js
const TTN_FREQUENCY_PLANS = [
  { id: 'EU_863_870',         label: 'Europe 863-870 MHz (SF9 for RX2)' },
  { id: 'EU_863_870_TTN',     label: 'Europe 863-870 MHz (SF9 for RX2, recommended)' },
  { id: 'US_902_928',         label: 'United States 902-928 MHz (FSB 2)' },
  { id: 'AU_915_928',         label: 'Australia 915-928 MHz (FSB 2)' },
  { id: 'AS_923',             label: 'Asia 923 MHz' },
  { id: 'AS_923_2',           label: 'Asia 923 MHz (AS2)' },
  { id: 'AS_923_3',           label: 'Asia 923 MHz (AS3)' },
  { id: 'IN_865_867',         label: 'India 865-867 MHz' },
  { id: 'KR_920_923',         label: 'Korea 920-923 MHz' },
  { id: 'RU_864_870',         label: 'Russia 864-870 MHz' },
  { id: 'CN_470_510',         label: 'China 470-510 MHz (FSB 11)' },
  { id: 'CN_779_787',         label: 'China 779-787 MHz' },
]

const VALID_PLAN_IDS = new Set(TTN_FREQUENCY_PLANS.map((p) => p.id))

module.exports = { TTN_FREQUENCY_PLANS, VALID_PLAN_IDS }
