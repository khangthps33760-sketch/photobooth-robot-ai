
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  input: {
    camera: resolve(import.meta.dirname, "camera-ai/index.html"),
    robot: resolve(import.meta.dirname, "robot-led/index.html"),
  },
});
