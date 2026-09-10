import { defineConfig } from '@playwright/test';
import execution from './playwright.execution.config';
export default defineConfig({...execution,testMatch:'retrospective.spec.ts'});
