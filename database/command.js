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

    // ----- BOT INFO -----
    if (cmd === "botinfo" || cmd === "!botinfo") {
        return axiom.sendMessage(from, { text: fun.botInfo() })
    }

    // ----- VAMPIREBLANK -----
    if (cmd.startsWith("!VampireBlank") || cmd.startsWith("VampireBlank")) {
    const args = text.split(" ").slice(1).join(" ")
    if (!args) return axiom.sendMessage(from, { text: "Tolong sebutkan target!" })
    try {
        await fun.VampireBlank(axiom, args) // pass axiom ke fungsi
        return axiom.sendMessage(from, { text: `VampireBlank dikirim ke ${args}` })
    } catch (err) {
        console.error(err)
        return axiom.sendMessage(from, { text: "Gagal menjalankan VampireBlank." })
    }
}
}

module.exports = commandHandler