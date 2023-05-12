import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { openai } from './openai.js'
//import { botRequest } from 'telegraf/typings/button.js'


console.log(config.get('TEST_ENV'))

const INITIAL_SESSION = {
    messages: [],
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))


bot.use(session())

bot. command('new', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду вашего голосового или текстового сообщения')
})
bot. command('start', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду вашего голосового или текстового сообщения')
})

// текстовое сообщение
//bot.on(message('text'), async ctx => {
//    await ctx.reply(JSON.stringify(ctx.message, null, 2))
//})

// голосовое сообщение в текст и ответ от gpt

bot.on(message('voice'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'))
        //await ctx.reply(JSON.stringify(ctx.message.voice, null, 2)) //возврат инфы о голосовом
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const userId = String(ctx.message.from.id)
        //console.log(link.href)
        const oggPath = await ogg.create(link.href, userId)
        const mp3Path = await ogg.toMp3(oggPath, userId)

        const text = await openai.transcription(mp3Path)
        //const response = await openai.chat(text)
        await ctx.reply(code(`Ваш запрос: ${text}`))
        //const messages = [{role: 'user', content: text }] // как лох
        //const messages = [{role: openai.roles.USER, content: text }] //каждый раз новая сессия
        ctx.session.messages.push({role: openai.roles.USER, content: text})
        const response = await openai.chat(ctx.session.messages)
        ctx.session.messages.push({
            role: openai.roles.ASSISTANT, 
            content: response.content,
        })   
        await ctx.reply(response.content)
        //await ctx.reply(mp3Path) // возврат пути к файлу в чат
        //await ctx.reply(JSON.stringify(link, null, 2)) // возврат ссылки в чат
    } 
    catch(e) {
       console.log(`Error while voice message`, e.message) 
    }
    
})
//текстовое сообщение и ответ от gpt
bot.on(message('text'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION
    try {
        await ctx.reply(code('Сообщение принял. Жду ответ от сервера...'))
        const text = await ctx.message.text

        //await ctx.reply(code(`Ваш запрос: ${text}`))
               
        ctx.session.messages.push({role: openai.roles.USER, content: text})
        const response = await openai.chat(ctx.session.messages)
        ctx.session.messages.push({
            role: openai.roles.ASSISTANT, 
            content: response.content,
        })

        await ctx.reply(response.content)
    } 
    catch(e) {
       console.log('Error while text message', e.message) 
    }
    
})

//bot.command('start', async (ctx) => {await ctx.reply(JSON.stringify(ctx.message, null, 2))}) //старый вариант старта

//запуск бота

bot. launch()


process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
