export { createAdminApp, loadConfig } from "./core.ts";

import { createAdminApp } from "./core.ts";

const app = createAdminApp();

export default {
  fetch(req: Request) {
    return app.fetch(req);
  },
  run(args: string[]) {
    return app.run(args);
  },
};
