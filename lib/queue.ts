import { Queue } from "bullmq";
import type { Alert } from "@/db/schema/alerts";

export type ScrapeJobData = {
  alertId: string;
  userId: string;
  keywords: string[];
  location: string;
  radiusMiles: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  conditions: string[];
};

let _scrapeQueue: Queue<ScrapeJobData> | null = null;

export function getScrapeQueue(): Queue<ScrapeJobData> {
  if (!_scrapeQueue) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");
    _scrapeQueue = new Queue<ScrapeJobData>("flipalert:scrape", {
      connection: { url },
    });
  }
  return _scrapeQueue;
}

export function buildScrapeJobData(alert: Alert): ScrapeJobData {
  return {
    alertId: alert.id,
    userId: alert.userId,
    keywords: alert.keywords,
    location: alert.location,
    radiusMiles: alert.radiusMiles,
    minPrice: alert.minPrice,
    maxPrice: alert.maxPrice,
    conditions: alert.conditions,
  };
}
