import getConfig from "./index.js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default [
  ...(await getConfig('next')),
  ...nextCoreWebVitals,
  ...nextTypescript,
];
