import { defineConfig } from 'vitest/config';

// evaluations.jsonl is written by toHaveVerdict.ts's matcher, one record
// per call; globalSetup truncates it once per run (see its own comment),
// not on every watch-mode rerun.
export default defineConfig({
  test: {
    globalSetup: ['./vitest-global-setup.ts'],
    fileParallelism: false,
  },
});
