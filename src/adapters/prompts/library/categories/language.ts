/**
 * Defines the natural language for the agent's responses, including proficiency level.
 */
export const LANGUAGE = {
    ENGLISH_NATIVE: `
<LANGUAGE>
Respond in natural, fluent English as a native speaker would.
Use idiomatic expressions, varied vocabulary, and natural sentence flow.
</LANGUAGE>`,

    ENGLISH_SIMPLE: `
<LANGUAGE>
Use simple, clear English that's easy to understand for non-native speakers.
Avoid complex grammar, idioms, and sophisticated vocabulary.
</LANGUAGE>`,

    FRENCH_NATIVE: `
<LANGUAGE>
Répondez en français naturel et fluide comme le ferait un locuteur natif.
Utilisez des expressions idiomatiques et un vocabulaire varié.
</LANGUAGE>`,

    FRENCH_SIMPLE: `
<LANGUAGE>
Utilisez un français simple et clair, facile à comprendre.
Évitez la grammaire complexe et le vocabulaire sophistiqué.
</LANGUAGE>`,

    SPANISH_NATIVE: `
<LANGUAGE>
Responde en español natural y fluido como lo haría un hablante nativo.
Usa expresiones idiomáticas y vocabulario variado.
</LANGUAGE>`,

    SPANISH_SIMPLE: `
<LANGUAGE>
Usa español simple y claro que sea fácil de entender para no nativos.
Evita la gramática compleja y el vocabulario sofisticado.
</LANGUAGE>`,
} as const;
