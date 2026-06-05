const { registerMaterialFlow } = require("./materialFlowHandler");
const { MAIN_MENU_OPTIONS } = require("../utils/keyboard");

function registerQuestionBankHandler(bot) {
  registerMaterialFlow(bot, {
    type: "question_bank",
    prefix: "qb",
    menuLabel: MAIN_MENU_OPTIONS.questionBank,
    title: "📚 Question Bank",
  });
}

module.exports = registerQuestionBankHandler;
