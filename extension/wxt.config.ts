import { defineConfig } from "wxt";
import { manifest } from "./manifest.config";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest,
});
