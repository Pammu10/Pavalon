// hooks/useNarration.ts
// import { Capacitor } from "@capacitor/core";

let utterance: SpeechSynthesisUtterance | null = null;

export const speak = (text: string) => {
//   if (Capacitor.isNativePlatform()) {
//     // Native: use Capacitor TTS plugin
//     import("@capacitor-community/text-to-speech").then(({ TextToSpeech }) => {
//      TextToSpeech.speak({
//   text: text,
//   lang: "en-GB",  // Swahili (Kenya)
//   rate: 1,
//   pitch: 1.0,
// });

//     });
//   } else {
    // Web browser: use SpeechSynthesis
    if (utterance) {
      window.speechSynthesis.cancel();
    }

    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }
// };

export const stopSpeaking = () => {
  // if (Capacitor.isNativePlatform()) {
  //   import("@capacitor-community/text-to-speech").then(({ TextToSpeech }) => {
  //     TextToSpeech.stop();
  //   });
  // } else {
    window.speechSynthesis.cancel();
  // }
};
