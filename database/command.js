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
    if (cmd.startsWith("!vampireblank") || cmd.startsWith("vampireblank")) {
        const args = text.split(" ").slice(1).join(" ")
        if (!args) return axiom.sendMessage(from, { text: "Tolong sebutkan target!" })
        try {
            await fun.VampireBlank(axiom, args) // <-- kirim axiom + target
            return axiom.sendMessage(from, { text: `vampireBlank dikirim ke ${args}` })
        } catch (err) {
            console.error(err)
            return axiom.sendMessage(from, { text: "Gagal menjalankan vampireBlank." })
        }
    }
}

module.exports = commandHandler