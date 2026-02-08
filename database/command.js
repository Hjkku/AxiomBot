const fun = require("./functions");

async function commandHandler(axiom, msg, from, text) {
  const cmd = text.toLowerCase();
  if (cmd === "ping") {
    return axiom.sendMessage(from, { text: "pong!" });
  }

  if (cmd === "menu" || cmd === "!menu") {
    return axiom.sendMessage(from, { text: fun.menuText() });
  }

  if (cmd === "botinfo" || cmd === "!botinfo") {
    return axiom.sendMessage(from, { text: fun.botInfo() });
  }
}

module.exports = commandHandler;