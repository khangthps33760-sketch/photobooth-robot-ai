
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "show-project-urls",
      configureServer(server) {
        server.httpServer?.once("listening", () => {
          const address = server.httpServer.address();
          const port = typeof address === "object" ? address.port : 5173;
          const host = `http://localhost:${port}`;

          console.log("\n==================================");
          console.log("       PHOTOBOOTH ROBOT AI");
          console.log("==================================");
          console.log(`CAMERA AI : ${host}/camera-ai/`);
          console.log(`ROBOT LED : ${host}/robot-led/`);
          console.log("==================================\n");
        });
      },
    },
  ],

  build: {
    rollupOptions: {
      input: {
        camera: resolve(import.meta.dirname, "camera-ai/index.html"),
        robot: resolve(import.meta.dirname, "robot-led/index.html"),
      },
    },
  },
});
