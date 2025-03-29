const axios = require('axios');

async function get_definitions(word, max_definitions = 7) {
    try {
        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
        const response = await axios.get(url);
        const res = response.data;

        if (Array.isArray(res) && res.length > 0) {
            const word_data = res[0]; // Faqat birinchi natijani olish
            const phonetics = word_data.phonetics || [];
            let audio_url = null;
            let phonetic_text = null; // Fonetika matni uchun

            // **Fonetika va audio olish**
            for (const phonetic of phonetics) {
                if ('text' in phonetic && phonetic.text) {
                    phonetic_text = phonetic.text;
                }
                if ('audio' in phonetic && phonetic.audio) {
                    audio_url = phonetic.audio;
                    break; // Audio topilgan zahoti to'xtaydi
                }
            }

            // **Barcha ta'riflarni olish (maksimum 7 ta)**
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
        return JSON.stringify({"error": "So'rov yuborishda xatolik!"}, null, 4);
    }
}

// Test the function
if (require.main === module) {
    get_definitions('america').then(result => {
        console.log(result);
    });
}

module.exports = { get_definitions };