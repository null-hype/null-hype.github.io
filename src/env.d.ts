/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly LINEAR_API_KEY?: string;
	readonly LINEAR_GRAPHQL_ENDPOINT?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
