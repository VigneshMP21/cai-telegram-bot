const { registerMaterialFlow } = require("./materialFlowHandler");
const { MAIN_MENU_OPTIONS } = require("../utils/keyboard");

function registerBitBankHandler(bot) {
  registerMaterialFlow(bot, {
    type: "bit_bank",
    prefix: "bb",
    menuLabel: MAIN_MENU_OPTIONS.bitBank,
    title: "📝 Bit Bank",
  });
}

module.exports = registerBitBankHandler;
