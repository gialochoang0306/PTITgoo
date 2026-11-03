import { api } from "../lib/api";
import type { DriverDocument } from "../types";

export type DriverApplication = {
  id: number;
  driverName: string | null;
  driverPhone: string;
  documents: DriverDocument[];
  createdAt: string;
  waitingForAccount?: boolean;
};

export async function loadDocumentApplications(status: string) {
  const applications = new Map<number, DriverApplication>();
  // The API paginates documents, so group the complete queue before paginating drivers.
  for (let page = 0; ; page++) {
    const result = await api.documents({ status, page, size: 100 });
    for (const row of result.content) {
      const id = row.document.driverId;
      const application = applications.get(id);
      if (application) application.documents.push(row.document);
      else applications.set(id, {
        id,
        driverName: row.driverName,
        driverPhone: row.driverPhone,
        documents: [row.document],
        createdAt: row.document.createdAt,
      });
    }
    if (!result.hasNext) break;
  }
  if (status === "PENDING") await addPendingAccounts(applications);
  return [...applications.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
}

async function addPendingAccounts(applications: Map<number, DriverApplication>) {
  // An application remains actionable after its last document is reviewed.
  for (let page = 0; ; page++) {
    const result = await api.drivers({ verification_status: "PENDING", page, size: 100 });
    const drivers = result.content.filter(driver => driver.verificationStatus === "PENDING" && !applications.has(driver.id));
    for (let offset = 0; offset < drivers.length; offset += 4) {
      const details = await Promise.all(drivers.slice(offset, offset + 4).map(driver => api.driver(driver.id)));
      for (const { driver, documents } of details) {
        const current = documents.filter(document => document.isCurrent);
        if (driver.verificationStatus !== "PENDING" || !current.length) continue;
        const oldest = current.reduce((first, document) => Date.parse(document.createdAt) < Date.parse(first.createdAt) ? document : first);
        applications.set(driver.id, {
          id: driver.id,
          driverName: driver.fullName,
          driverPhone: driver.phoneNumber,
          documents: current,
          createdAt: oldest.createdAt,
          waitingForAccount: true,
        });
      }
    }
    if (!result.hasNext) return;
  }
}
