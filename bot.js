const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const {config} = require("dotenv");

config()

// Bot token
const API_TOKEN = process.env.BOT_API;

// Dictionary function
async function get_definitions(word, max_definitions = 7) {
    try {
        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
        const response = await axios.get(url);
        const res = response.data;

        if (Array.isArray(res) && res.length > 0) {
            const word_data = res[0];
            const phonetics = word_data.phonetics || [];
            let audio_url = null;
            let phonetic_text = null;

            for (const phonetic of phonetics) {
                if ('text' in phonetic && phonetic.text) {
                    phonetic_text = phonetic.text;
                }
                if ('audio' in phonetic && phonetic.audio) {
                    audio_url = phonetic.audio;
                    break;
                }
            }

            const definitions = [];
            const meanings = word_data.meanings || [];
            
            outerLoop: for (const meaning of meanings) {
                for (const definition of (meaning.definitions || [])) {
                    definitions.push(`👉 ${definition.definition || 'Mavjud emas.'}`);
                    if (definitions.length >= max_definitions) {
                        break outerLoop;
                    }
                }
            }

            const result = {
                "phonetic": phonetic_text ? phonetic_text : "Mavjud emas",
                "audio": audio_url,
                "definitions": definitions.length > 0 ? definitions : ["Mavjud emas."]
            };

            return JSON.stringify(result, null, 4);
        } else {
            return JSON.stringify({"error": "So'z topilmadi!"}, null, 4);
        }
    } catch (error) {
        console.error('Dictionary lookup error:', error);
        return JSON.stringify({"error": "So'rov yuborishda xatolik!"}, null, 4);
    }
}

// Improved translation function that handles longer texts
async function translateText(text, targetLang) {
    try {
        // If text is too long, break it into chunks of 1000 characters
        const MAX_CHUNK_SIZE = 1000;
        let fullTranslation = '';
        
        if (text.length <= MAX_CHUNK_SIZE) {
            // Short text, translate directly
            const response = await axios.get(
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
            );
            // Extract the translation from the response
            return response.data[0].map(chunk => chunk[0]).join('');
        } else {
            // Long text, break into chunks
            const chunks = [];
            for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
                chunks.push(text.substring(i, i + MAX_CHUNK_SIZE));
            }
            
            // Translate each chunk
            for (const chunk of chunks) {
                const response = await axios.get(
                    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(chunk)}`
                );
                fullTranslation += response.data[0].map(chunk => chunk[0]).join('');
            }
            return fullTranslation;
        }
    } catch (error) {
        console.error('Translation error:', error);
        return text; // Return original text on error
    }
}

async function detectLanguage(text) {
    try {
        // Just use a small portion of text for language detection
        const sampleText = text.substring(0, 100);
        const response = await axios.get(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(sampleText)}`
        );
        return response.data[2]; // This should be the language code
    } catch (error) {
        console.error('Language detection error:', error);
        return 'en'; // Default to English on error
    }
}

// Initialize bot
const bot = new Telegraf(API_TOKEN);

// Start command handler
bot.command('start', async (ctx) => {
    try {
        const keyboard = Markup.keyboard([
            ["🆘 Qo'llanilishi"]
        ]).resize();
        
        await ctx.reply("👋 Salom! Speak English botiga xush kelibsiz 😊", keyboard);
        await ctx.reply('Foydalanish uchun pastdagi tugmani bosing 👇');
    } catch (error) {
        console.error('Error in start command:', error);
    }
});

// Help button handler
bot.hears("🆘 Qo'llanilishi", async (ctx) => {
    try {
        await ctx.reply(
            "📖 *FOYDALANISH QO'LLANMASI* 🚀\n\n" +
            "🔹 *Ingliz yoki o'zbek tilidagi so'z yoki iborani yuboring!*\n" +
            "🔹 *Bot sizga quyidagilarni taqdim etadi:*\n" +
            "✅ 🔊 *Talaffuz (Audio fayl, agar mavjud bo'lsa)*\n" +
            "✅ 📖 *Ta'rif (Definition)*\n" +
            "✅ 🌍 *Tarjima (o'zbekcha yoki inglizcha matn)*\n\n" +
            "💡 *Misol:*\n" +
            "📝 *So'z:* \"wisdom\"\n" +
            "📖 *Ta'rif:* 👉 *The quality of having experience, knowledge, and good judgment.*\n" +
            "🔊 *Talaffuz:* 🎧 [Audio](https://example.com/audio.mp3)\n\n" +
            "📌 *Til o'rganish – muvaffaqiyat kaliti!* 🚀✨",
            {
                parse_mode: "Markdown",
                ...Markup.removeKeyboard()
            }
        );
    } catch (error) {
        console.error('Error in help command:', error);
    }
});

// Message handler for translations and definitions
bot.on('text', async (ctx) => {
    try {
        const userText = ctx.message.text;
        
        if (userText === "🆘 Qo'llanilishi") {
            return; // Already handled by the hears handler
        }
        
        // Show typing indicator
        ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
        
        // Detect language
        const lang = await detectLanguage(userText);
        
        const words = userText.split(' ');
        const dest = lang === "en" ? "uz" : "en";
        
        // Translate the text with our improved function
        const translation = await translateText(userText, dest);
        
        if (words.length >= 2) {
            // For phrases, just return translation
            await ctx.reply(`Tarjimasi: ${translation}`);
        } else {
            // For single words, provide dictionary lookup
            const word = lang !== "en" ? translation : userText;
            
            // Get dictionary definitions
            const lookup_json = await get_definitions(word, 7);
            const lookup = JSON.parse(lookup_json);
            
            if (!lookup.error) {
                // If word found in dictionary
                const phonetic_text = lookup.phonetic || "Mavjud emas";
                const definitions_text = lookup.definitions ? lookup.definitions.join('\n') : "Mavjud emas";
                
                const response = `Tarjimasi: ${translation}\n\n🔊 **Fonetika:** ${phonetic_text}\n📖 **Definitions:**\n${definitions_text}`;
                await ctx.reply(response);
                
                // Send audio if available
                if (lookup.audio) {
                    await ctx.replyWithVoice({ url: lookup.audio });
                }
            } else {
                // Word not found in dictionary
                await ctx.reply(`Tarjimasi: ${translation} 🧐 menimcha men aniqlay olmaydigan so'z`);
            }
        }
    } catch (error) {
        console.error(`Error handling message: ${error}`);
        await ctx.reply("Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
    }
});

// Error handler
bot.catch((err, ctx) => {
    console.error(`Error in bot: ${err}`);
    ctx.reply("Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
});

// Start the bot
console.log('Starting bot...');
bot.launch()
    .then(() => {
        console.log('Bot successfully started!');
    })
    .catch(err => {
        console.error(`Failed to start bot: ${err.message}`);
    });

// Enable graceful stop
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    console.log('Bot stopped due to SIGINT');
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    console.log('Bot stopped due to SIGTERM');
});