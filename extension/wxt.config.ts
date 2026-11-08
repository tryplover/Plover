import { defineConfig } from "wxt";
import { WEBSITE_ORIGINS } from "./src/features/auth/handoff";
import { manifest } from "./manifest.config";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest,
  hooks: {
    "build:manifestGenerated": (wxt, generated) => {
      generated.externally_connectable = {
        matches: [
          ...WEBSITE_ORIGINS.prod,
          ...(wxt.config.mode === "development" ? WEBSITE_ORIGINS.dev : []),
        ].map((o) => `${o}/*`),
      };
      const war = generated.web_accessible_resources ?? [];
      generated.web_accessible_resources = war.filter(
        (r) => typeof r === "string" || r.matches?.length !== 0,
      ) as typeof war;
    },
  },
});
