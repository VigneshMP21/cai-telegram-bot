const {
  getMaterial,
  getSemesters,
  getSubjects,
} = require("../services/apiService");
const {
  buildSemesterKeyboard,
  buildSubjectKeyboard,
} = require("../utils/keyboard");
const { decodeSubject, resolveSubjectReference } = require("../utils/callbackData");
const { logBotEvent } = require("../utils/logger");

const API_FAILURE_MESSAGE = "⚠️ Unable to connect to server.";
const NO_RECORDS_MESSAGE = "❌ No records found.";
const FILE_MISSING_MESSAGE = "❌ File not available.";

function registerMaterialFlow(bot, config) {
  bot.hears(config.menuLabel, (ctx) => handleMenuSelection(ctx, config));

  bot.action(
    new RegExp(`^${config.prefix}_sem_(\\d+)$`),
    (ctx) => handleSemesterSelection(ctx, config, ctx.match[1])
  );

  bot.action(
    new RegExp(`^${config.prefix}_subject_(\\d+)_(.+)$`),
    (ctx) => {
      const semester = ctx.match[1];
      const subject = decodeSubject(ctx.match[2]);
      return handleSubjectSelection(ctx, config, semester, subject);
    }
  );

  bot.action(
    new RegExp(`^${config.prefix}_subject_ref_([a-f0-9]+)$`),
    (ctx) => {
      const reference = resolveSubjectReference(ctx.match[1]);

      if (!reference) {
        return replyFromCallback(ctx, NO_RECORDS_MESSAGE);
      }

      return handleSubjectSelection(
        ctx,
        config,
        reference.semester,
        reference.subject
      );
    }
  );
}

async function handleMenuSelection(ctx, config) {
  logBotEvent(ctx, {
    selectedMenu: config.menuLabel,
    materialType: config.type,
  });

  let semesters;

  try {
    semesters = await getSemesters(config.type);
  } catch (error) {
    logApiError(ctx, "getSemesters", config, error);
    return ctx.reply(API_FAILURE_MESSAGE);
  }

  if (!semesters.length) {
    return ctx.reply(NO_RECORDS_MESSAGE);
  }

  return ctx.reply(
    `${config.title}\n\nSelect semester:`,
    buildSemesterKeyboard(config.prefix, semesters)
  );
}

async function handleSemesterSelection(ctx, config, semester) {
  await answerCallback(ctx);

  logBotEvent(ctx, {
    selectedMenu: config.menuLabel,
    selectedSemester: semester,
    materialType: config.type,
  });

  let subjects;

  try {
    subjects = await getSubjects(config.type, semester);
  } catch (error) {
    logApiError(ctx, "getSubjects", config, error);
    return ctx.reply(API_FAILURE_MESSAGE);
  }

  if (!subjects.length) {
    return ctx.reply(NO_RECORDS_MESSAGE);
  }

  return ctx.reply(
    `${config.title}\n\n🎓 Semester: ${semester}\n\nSelect subject:`,
    buildSubjectKeyboard(config.prefix, semester, subjects)
  );
}

async function handleSubjectSelection(ctx, config, semester, subject) {
  await answerCallback(ctx);

  if (!subject) {
    return ctx.reply(NO_RECORDS_MESSAGE);
  }

  logBotEvent(ctx, {
    selectedMenu: config.menuLabel,
    selectedSemester: semester,
    selectedSubject: subject,
    materialType: config.type,
  });

  let material;

  try {
    material = await getMaterial(config.type, semester, subject);
  } catch (error) {
    logApiError(ctx, "getMaterial", config, error);
    return ctx.reply(API_FAILURE_MESSAGE);
  }

  if (!material?.file_url) {
    return ctx.reply(FILE_MISSING_MESSAGE);
  }

  const caption = `${config.title}\n\n📖 Subject:\n${subject}\n\n🎓 Semester:\n${semester}`;

  try {
    await ctx.replyWithDocument(material.file_url, { caption });
  } catch (error) {
    console.error("[CAI_BOT] Failed to send document", {
      materialType: config.type,
      semester,
      subject,
      fileUrl: material.file_url,
      error: error?.message || error,
    });
    return ctx.reply(FILE_MISSING_MESSAGE);
  }

  logBotEvent(ctx, {
    downloadedMaterial: material.file_url,
    selectedMenu: config.menuLabel,
    selectedSemester: semester,
    selectedSubject: subject,
    materialType: config.type,
  });
}

async function replyFromCallback(ctx, message) {
  await answerCallback(ctx);
  return ctx.reply(message);
}

async function answerCallback(ctx) {
  if (!ctx.callbackQuery) {
    return;
  }

  try {
    await ctx.answerCbQuery();
  } catch (error) {
    console.error("[CAI_BOT] Failed to answer callback query", {
      error: error?.message || error,
    });
  }
}

function logApiError(ctx, action, config, error) {
  logBotEvent(ctx, {
    action,
    materialType: config.type,
    apiError: error?.message || error,
  });
}

module.exports = {
  registerMaterialFlow,
};
