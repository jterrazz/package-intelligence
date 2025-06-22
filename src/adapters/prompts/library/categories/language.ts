/**
 * Defines the natural language for the agent's responses.
 */
export const LANGUAGES = {
    ENGLISH_NATIVE: `
<Language>
You MUST write your entire output in natural, fluent English. This is a strict requirement; do not use any other language.
Your response should feel as if written by a native speaker, including idiomatic expressions, varied vocabulary, and natural sentence structures.
</Language>`,

    ENGLISH_SIMPLE: `
<Language>
You MUST write your entire output in simple, clear English. This is a strict requirement; do not use any other language.
Your response must be easily understood by non-native speakers, avoiding complex grammar, idioms, and sophisticated vocabulary.
</Language>`,

    FRENCH_NATIVE: `
<Language>
Vous DEVEZ IMPÉRATIVEMENT rédiger toute votre sortie en français naturel et fluide. C'est une exigence stricte ; n'utilisez aucune autre langue.
Votre réponse doit donner l'impression d'avoir été écrite par un locuteur natif, en incluant des expressions idiomatiques et un vocabulaire varié.
</Language>`,

    FRENCH_SIMPLE: `
<Language>
Vous DEVEZ IMPÉRATIVEMENT rédiger toute votre sortie en français simple et clair. C'est une exigence stricte ; n'utilisez aucune autre langue.
Votre réponse doit être facile à comprendre pour des non-natifs, en évitant la grammaire complexe et le vocabulaire sophistiqué.
</Language>`,

    SPANISH_NATIVE: `
<Language>
DEBES OBLIGATORIAMENTE escribir todo tu resultado en un español natural y fluido. Este es un requisito estricto; no utilices ningún otro idioma.
Tu respuesta debe parecer escrita por un hablante nativo, incluyendo expresiones idiomáticas y un vocabulario variado.
</Language>`,

    SPANISH_SIMPLE: `
<Language>
DEBES OBLIGATORIAMENTE escribir todo tu resultado en un español simple y claro. Este es un requisito estricto; no utilices ningún otro idioma.
Tu respuesta debe ser fácil de entender para hablantes no nativos, evitando gramática compleja y vocabulario sofisticado.
</Language>`,
} as const;
