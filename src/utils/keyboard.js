const { Markup } = require("telegraf");
const { buildSubjectCallbackData } = require("./callbackData");

const MAIN_MENU_OPTIONS = {
  questionBank: "📚 Question Bank",
  bitBank: "📝 Bit Bank",
  studyMaterials: "📖 Study Materials",
  syllabus: "📋 Syllabus",
};

function buildMainMenu() {
  return Markup.keyboard([
    [MAIN_MENU_OPTIONS.questionBank, MAIN_MENU_OPTIONS.bitBank],
    [MAIN_MENU_OPTIONS.studyMaterials, MAIN_MENU_OPTIONS.syllabus],
  ]).resize();
}

function buildSemesterKeyboard(prefix, semesters) {
  const buttons = semesters.map((semester) =>
    Markup.button.callback(`Semester ${semester}`, `${prefix}_sem_${semester}`)
  );

  return Markup.inlineKeyboard(chunk(buttons, 2));
}

function buildSubjectKeyboard(prefix, semester, subjects) {
  const buttons = subjects.map((subject) =>
    Markup.button.callback(
      subject,
      buildSubjectCallbackData(prefix, semester, subject)
    )
  );

  return Markup.inlineKeyboard(chunk(buttons, 1));
}

function chunk(items, size) {
  const rows = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}

module.exports = {
  MAIN_MENU_OPTIONS,
  buildMainMenu,
  buildSemesterKeyboard,
  buildSubjectKeyboard,
};
