import app from "./app";
import { registerRoutes } from "./routes/routes";
import { startMonthlyRecapScheduler } from "./monthlyRecapService";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = await registerRoutes(app);

startMonthlyRecapScheduler();

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});

httpServer.on("error", (err: Error) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
