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

export type DigestJobData = {
  alertId: string;
  userId: string;
  userEmail: string;
  alertName: string;
  sinceDate: string;
};
