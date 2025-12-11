
const express = require('express');
const router = express.Router();
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

// Creates a client
const client = new TextToSpeechClient();

router.post('/', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  const request = {
    input: { text: text },
    // Voice selection: en-GB, Neural2, Male voice. 'D' is a good option.
    voice: { languageCode: 'en-GB', name: 'en-GB-Neural2-B', ssmlGender: 'MALE' },
    // Select the type of audio encoding
    audioConfig: { audioEncoding: 'MP3' },
  };

  try {
    // Performs the text-to-speech request
    const [response] = await client.synthesizeSpeech(request);
    // Send the audio in base64 format to the client
    res.json({ audioContent: response.audioContent.toString('base64') });
  } catch (error) {
    console.error('ERROR:', error);
    res.status(500).json({ error: 'Failed to synthesize speech.' });
  }
});

module.exports = router;
