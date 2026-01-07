import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Catch common JSX syntax issues
      "react/jsx-no-undef": "error",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react/jsx-closing-bracket-location": "error",
      "react/jsx-closing-tag-location": "error",
      "react/jsx-curly-spacing": ["error", "never"],
      "react/jsx-equals-spacing": ["error", "never"],
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-props-no-multi-spaces": "error",
      "react/jsx-tag-spacing": "error",
      
      // Catch common JavaScript syntax issues
      "no-undef": "error",
      "no-unused-vars": "warn",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-empty": "error",
      "no-extra-semi": "error",
      "no-func-assign": "error",
      "no-invalid-regexp": "error",
      "no-irregular-whitespace": "error",
      "no-obj-calls": "error",
      "no-sparse-arrays": "error",
      "no-unexpected-multiline": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      
      // TypeScript specific
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      
      // Import/Export issues
      "import/no-unresolved": "off", // Next.js handles this
      "import/named": "error",
      "import/default": "error",
      "import/namespace": "error",
      "import/no-duplicates": "error",
      
      // Potential runtime errors
      "array-callback-return": "error",
      "no-constructor-return": "error",
      "no-promise-executor-return": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "error",
      "no-unmodified-loop-condition": "error",
      "no-useless-backreference": "error",
      "require-atomic-updates": "error"
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**", // Ignore our validation scripts
  ]),
]);

export default eslintConfig;
