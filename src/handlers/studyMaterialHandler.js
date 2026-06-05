const { registerMaterialFlow } = require("./materialFlowHandler");
const { MAIN_MENU_OPTIONS } = require("../utils/keyboard");

function registerStudyMaterialHandler(bot) {
  registerMaterialFlow(bot, {
    type: "study_materials",
    prefix: "sm",
    menuLabel: MAIN_MENU_OPTIONS.studyMaterials,
    title: "📖 Study Materials",
  });
}

module.exports = registerStudyMaterialHandler;
