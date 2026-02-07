const fun = require("./functions")

async function commandHandler(axiom, msg, from, text) {

    const cmd = text.toLowerCase()

    // ----- PING -----
    if (cmd === "ping") {
        return axiom.sendMessage(from, { text: "pong!" })
    }

    // ----- MENU -----
    if (cmd === "menu" || cmd === "!menu") {
        return axiom.sendMessage(from, { text: fun.menuText() })
    }

    // ----- SPAM ----
    case 'spm':
  if (!args[0]) return m.reply("Contoh:\n!spm 628xxxx 5");

  let target = args[0];
  let jumlah = parseInt(args[1]) || 5;

  await SpamLokasiTag(axiom, target, jumlah);
  m.reply("✔️ Spam lokasi + tag terkirim.");
  break;
}

module.exports = commandHandler