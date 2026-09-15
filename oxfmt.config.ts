import { base, defineConfig, type OxfmtConfig } from '@jterrazz/typescript/oxfmt';

// The `library` tsconfig's `isolatedDeclarations` refuses a default export whose
// type it would have to infer, so every config file here names its own type.
const config: OxfmtConfig = defineConfig(base);

export default config;
