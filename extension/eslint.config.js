import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [".output", ".wxt", "coverage", "node_modules"],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    files: ["src/**/*.{ts,tsx}"],
    ...react.configs.flat.recommended,
    ...react.configs.flat["jsx-runtime"],
    settings: {
      react: { version: "detect" },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: [
      "src/ui/**/*.{ts,tsx}",
      "src/entrypoints/{content,popup,options,panel,blocked}/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/worker/*",
                "@/features/*/worker",
                "@/features/timer/badge",
              ],
              message:
                "Page and UI code must not import worker modules; they register handlers and alarms. Talk to the worker via @/shared/messages.",
            },
          ],
        },
      ],
    },
  },
  prettier,
);
