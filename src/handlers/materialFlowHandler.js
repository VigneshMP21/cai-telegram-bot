const axios = require("axios");
const {
  addInfinityFreeRetryParam,
  isInfinityFreeChallenge,
  solveInfinityFreeChallenge,
} = require("../utils/infinityFree");

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
const DOWNLOAD_HEADERS = {
  Accept: "application/pdf, application/octet-stream, text/html, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

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

  console.log("Material Object:");
  console.log(JSON.stringify(material, null, 2));

  console.log("File URL:");
  console.log(material?.file_url);

  if (!material?.file_url) {
    return ctx.reply(FILE_MISSING_MESSAGE);
  }

  const caption = `${config.title}\n\n📖 Subject:\n${subject}\n\n🎓 Semester:\n${semester}`;

  let fileResponse;

  try {
    console.log("Downloading File:", material.file_url);

    fileResponse = await downloadFileStream(material.file_url);
  } catch (error) {
    console.error("Axios Download Error");
    console.error(error);
    console.error(error?.response);
    console.error(error?.response?.status);
    console.error(error?.response?.headers);
    return ctx.reply(FILE_MISSING_MESSAGE);
  }

  try {
    console.log("Sending File To Telegram");

    await ctx.replyWithDocument(
      {
        source: fileResponse.data,
        filename: `${subject}.pdf`,
      },
      {
        caption,
      }
    );
  } catch (error) {
    console.error("Telegram Document Error");
    console.error(error);
    console.error(error?.response);
    console.error(error?.description);
    console.error("[CAI_BOT] Telegram Document Context", {
      materialType: config.type,
      semester,
      subject,
      fileUrl: material.file_url,
      telegramResponse: error?.response,
      telegramDescription: error?.description,
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

async function downloadFileStream(fileUrl) {
  const response = await axios.get(fileUrl, {
    responseType: "stream",
    timeout: 30000,
    validateStatus: () => true,
    headers: DOWNLOAD_HEADERS,
  });

  if (!isHtmlResponse(response)) {
    if (response.status >= 400) {
      response.data.destroy();
      throw new Error(`File download failed with status ${response.status}.`);
    }

    return response;
  }

  const html = await streamToString(response.data);

  if (!isInfinityFreeChallenge(html)) {
    throw new Error(
      `File URL returned HTML instead of a document. Content-Type: ${
        response.headers?.["content-type"] || "unknown"
      }`
    );
  }

  const cookie = solveInfinityFreeChallenge(html);

  if (!cookie) {
    throw new Error("Unable to solve InfinityFree file download challenge.");
  }

  const retryResponse = await axios.get(addInfinityFreeRetryParam(fileUrl), {
    responseType: "stream",
    timeout: 30000,
    validateStatus: () => true,
    headers: {
      ...DOWNLOAD_HEADERS,
      Cookie: cookie,
    },
  });

  if (isHtmlResponse(retryResponse)) {
    retryResponse.data.destroy();
    throw new Error("InfinityFree file download retry returned HTML.");
  }

  if (retryResponse.status >= 400) {
    retryResponse.data.destroy();
    throw new Error(`File download retry failed with status ${retryResponse.status}.`);
  }

  return retryResponse;
}

function isHtmlResponse(response) {
  return String(response.headers?.["content-type"] || "")
    .toLowerCase()
    .includes("text/html");
}

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

module.exports = {
  registerMaterialFlow,
};
