const { registerMaterialFlow } = require("./materialFlowHandler");
const { MAIN_MENU_OPTIONS } = require("../utils/keyboard");

function registerSyllabusHandler(bot) {
  registerMaterialFlow(bot, {
    type: "syllabus",
    prefix: "sy",
    menuLabel: MAIN_MENU_OPTIONS.syllabus,
    title: "📋 Syllabus",
  });
}

module.exports = registerSyllabusHandler;
