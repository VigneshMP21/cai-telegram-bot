const crypto = require("crypto");

function isInfinityFreeChallenge(payload) {
  return (
    typeof payload === "string" &&
    payload.includes('document.cookie="__test="') &&
    payload.includes("slowAES.decrypt")
  );
}

function solveInfinityFreeChallenge(html) {
  const match = html.match(
    /var a=toNumbers\("([a-f0-9]+)"\),b=toNumbers\("([a-f0-9]+)"\),c=toNumbers\("([a-f0-9]+)"\)/i
  );

  if (!match) {
    return null;
  }

  const [, keyHex, ivHex, cipherHex] = match;
  const decipher = crypto.createDecipheriv(
    "aes-128-cbc",
    Buffer.from(keyHex, "hex"),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAutoPadding(false);

  const cookieValue = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]).toString("hex");

  return `__test=${cookieValue}`;
}

function addInfinityFreeRetryParam(url) {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set("i", "1");
  return parsedUrl.toString();
}

module.exports = {
  addInfinityFreeRetryParam,
  isInfinityFreeChallenge,
  solveInfinityFreeChallenge,
};
