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

const MESSAGE_OPTIONS = {
  parse_mode: "HTML",
  disable_web_page_preview: true,
};
const FLOW_COPY = {
  question_bank: {
    intro:
      "Access question bank PDFs with answers, arranged semester-wise and subject-wise for focused preparation.",
    semesterAction: "Choose your semester to view available question banks.",
    subjectAction: "Select a subject to download the question bank with answers.",
    readyText: "Your question bank with answers is ready for download.",
  },
  bit_bank: {
    intro:
      "Find compact bit-bank materials designed for quick revision before internal and semester exams.",
    semesterAction: "Choose your semester to view available bit-bank resources.",
    subjectAction: "Select a subject to download the bit-bank PDF.",
    readyText: "Your bit-bank PDF is ready for quick revision.",
  },
  study_materials: {
    intro:
      "Browse curated question bank resources to strengthen concepts and practice important questions.",
    semesterAction: "Choose your semester to view available question bank resources.",
    subjectAction: "Select a subject to download the question bank PDF.",
    readyText: "Your question bank PDF is ready for download.",
  },
  syllabus: {
    intro:
      "View the official syllabus and course structure for each subject in one place.",
    semesterAction: "Choose your semester to view available syllabus files.",
    subjectAction: "Select a subject to download the syllabus PDF.",
    readyText: "Your syllabus PDF is ready for reference.",
  },
};
const API_FAILURE_MESSAGE = `━━━━━━━━━━━━━━━
⚠️ <b>SERVER UNAVAILABLE</b>

Unable to connect to the student portal right now.
Please try again after a few minutes.
━━━━━━━━━━━━━━━`;
const NO_RECORDS_MESSAGE = `━━━━━━━━━━━━━━━
❌ <b>NO RECORDS FOUND</b>

No resources are available for this selection yet.
Please check again later.
━━━━━━━━━━━━━━━`;
const FILE_MISSING_MESSAGE = `━━━━━━━━━━━━━━━
❌ <b>FILE NOT AVAILABLE</b>

The selected PDF is currently unavailable.
Please try another subject or check again later.
━━━━━━━━━━━━━━━`;
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
    return ctx.reply(API_FAILURE_MESSAGE, MESSAGE_OPTIONS);
  }

  if (!semesters.length) {
    return ctx.reply(NO_RECORDS_MESSAGE, MESSAGE_OPTIONS);
  }

  return ctx.reply(
    buildSemesterPrompt(config),
    withMessageOptions(buildSemesterKeyboard(config.prefix, semesters))
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
    return ctx.reply(API_FAILURE_MESSAGE, MESSAGE_OPTIONS);
  }

  if (!subjects.length) {
    return ctx.reply(NO_RECORDS_MESSAGE, MESSAGE_OPTIONS);
  }

  return ctx.reply(
    buildSubjectPrompt(config, semester),
    withMessageOptions(buildSubjectKeyboard(config.prefix, semester, subjects))
  );
}

async function handleSubjectSelection(ctx, config, semester, subject) {
  await answerCallback(ctx);

  if (!subject) {
    return ctx.reply(NO_RECORDS_MESSAGE, MESSAGE_OPTIONS);
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
    return ctx.reply(API_FAILURE_MESSAGE, MESSAGE_OPTIONS);
  }

  console.log("Material Object:");
  console.log(JSON.stringify(material, null, 2));

  console.log("File URL:");
  console.log(material?.file_url);

  if (!material?.file_url) {
    return ctx.reply(FILE_MISSING_MESSAGE, MESSAGE_OPTIONS);
  }

  const caption = buildDocumentCaption(config, semester, subject);

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
    return ctx.reply(FILE_MISSING_MESSAGE, MESSAGE_OPTIONS);
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
        parse_mode: "HTML",
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
    return ctx.reply(FILE_MISSING_MESSAGE, MESSAGE_OPTIONS);
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
  return ctx.reply(message, MESSAGE_OPTIONS);
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

function buildSemesterPrompt(config) {
  const copy = getFlowCopy(config);

  return `━━━━━━━━━━━━━━━
<b>${escapeHtml(config.title)}</b>

${escapeHtml(copy.intro)}

🎓 <b>Select Semester</b>
${escapeHtml(copy.semesterAction)}
━━━━━━━━━━━━━━━`;
}

function buildSubjectPrompt(config, semester) {
  const copy = getFlowCopy(config);

  return `━━━━━━━━━━━━━━━
<b>${escapeHtml(config.title)}</b>

🎓 <b>Semester:</b> ${escapeHtml(semester)}

📚 <b>Select Subject</b>
${escapeHtml(copy.subjectAction)}
━━━━━━━━━━━━━━━`;
}

function buildDocumentCaption(config, semester, subject) {
  const copy = getFlowCopy(config);

  return `<b>${escapeHtml(config.title)}</b>
━━━━━━━━━━━━━━━

🎓 <b>Semester:</b> ${escapeHtml(semester)}

📖 <b>Subject:</b>
${escapeHtml(subject)}

${escapeHtml(copy.readyText)}`;
}

function getFlowCopy(config) {
  return FLOW_COPY[config.type] || {
    intro: "Access student resources arranged semester-wise and subject-wise.",
    semesterAction: "Choose your semester to view available resources.",
    subjectAction: "Select a subject to download the PDF.",
    readyText: "Your PDF is ready for download.",
  };
}

function withMessageOptions(extra) {
  return {
    ...MESSAGE_OPTIONS,
    ...extra,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
