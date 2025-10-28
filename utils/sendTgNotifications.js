const {Bot} = require('grammy')
const botLaura = new Bot(process.env.LAURA_TOKEN)

const sendLauraNotification = async (err_msg, chatid, disable_notification = false) => {
    try {
        chatid = chatid ?? 741815228
        if (process.env.NODE_ENV == 'local') return console.log('TG Local:', err_msg)
        await botLaura.api.sendMessage(chatid, err_msg, { disable_notification })
    } catch (error) {
        console.error(error)
    }
}

module.exports = {sendLauraNotification}