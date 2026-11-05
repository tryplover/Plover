import { defineConfig } from "wxt";
import { manifest } from "./manifest.config";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest,
  hooks: {
    "build:manifestGenerated": (_wxt, generated) => {
      const war = generated.web_accessible_resources ?? [];
      generated.web_accessible_resources = war.filter(
        (r) => typeof r === "string" || r.matches?.length !== 0,
      ) as typeof war;
    },
  },
});
