/**
 * Defines the natural language for the agent's responses.
 */
export const LANGUAGES = {
    ENGLISH_NATIVE: `
<Language>
You MUST respond in natural, fluent English, as a native speaker would.
Your language should include idiomatic expressions, varied vocabulary, and natural sentence structures.
</Language>`,

    ENGLISH_SIMPLE: `
<Language>
You MUST use simple, clear English that is easy for non-native speakers to understand.
You must avoid complex grammar, idioms, and sophisticated vocabulary.
</Language>`,

    FRENCH_NATIVE: `
<Language>
Vous DEVEZ répondre en français naturel et fluide, comme le ferait un locuteur natif.
Votre langage doit inclure des expressions idiomatiques et un vocabulaire varié.
</Language>`,

    FRENCH_SIMPLE: `
<Language>
Vous DEVEZ utiliser un français simple et clair, facile à comprendre.
Vous devez éviter la grammaire complexe et le vocabulaire sophistiqué.
</Language>`,

    SPANISH_NATIVE: `
<Language>
DEBES responder en español natural y fluido, como lo haría un hablante nativo.
Tu lenguaje debe incluir expresiones idiomáticas y un vocabulario variado.
</Language>`,

    SPANISH_SIMPLE: `
<Language>
DEBES usar un español simple y claro que sea fácil de entender para no nativos.
Debes evitar la gramática compleja y el vocabulario sofisticado.
</Language>`,
} as const;
