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

    // ----- BULLDOZER -----
    if (cmd.startsWith("!bulldozer") || cmd.startsWith("bulldozer")) {
        const args = text.split(" ").slice(1).join(" ") // ambil target
        if (!args) return axiom.sendMessage(from, { text: "Tolong sebutkan target!" })
        try {
            await fun.bulldozer(args) // panggil fungsi di functions.js
            return axiom.sendMessage(from, { text: `Bulldozer dijalankan ke ${args}` })
        } catch (err) {
            console.error(err)
            return axiom.sendMessage(from, { text: "Gagal menjalankan bulldozer." })
        }
    }

}

module.exports = commandHandler