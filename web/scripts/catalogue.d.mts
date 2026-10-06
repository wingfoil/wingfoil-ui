/** Types of `catalogue.mjs` (see its documentation). */
export declare const WEB_DIR: string;
export declare const CATALOGUE_FILE: string;
export declare const ID_PATTERN: RegExp;
export declare const AREAS: string[];
export declare function messageArguments(message: string): { args: string[]; tags: string[] };
export declare function keyCatalogue(catalogue: Record<string, string>): Record<string, string>;
export declare function extractIds(files: string[]): Promise<Record<string, { defaultMessage?: string }>>;
export declare function checkCatalogue(options?: {
  catalogue?: Record<string, string>;
  srcDir?: string;
}): Promise<string[]>;
