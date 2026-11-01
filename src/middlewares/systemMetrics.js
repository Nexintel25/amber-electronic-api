import { recordApiMetric } from "../models/systemMonitorModel.js";

// Records status code + response time of every finished request (per-minute rows in api_metrics).
// Mount before all routes. The DB call is fire-and-forget: it is never awaited and never
// throws, so monitoring cannot slow down or break a real request.
export const systemMetrics = (req, res, next) => {
  // the pinger is not real traffic
  if (req.path === "/api/health") return next();

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number((process.hrtime.bigint() - start) / 1000000n);
    try {
      recordApiMetric({ status: res.statusCode, ms }).catch(() => {});
    } catch {
      // ignore: monitoring must never crash the app
    }
  });

  return next();
};
