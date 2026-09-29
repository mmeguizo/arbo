import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase/config";

export interface AuditActor {
  uid?: string | null;
  name?: string | null;
  role?: string | null;
}

export interface AuditLogInput {
  actor?: AuditActor | null;
  action: string;
  notes?: string;
  applicationId?: string | null;
  entityType?: string;
  entityId?: string | null;
  oldStatus?: string | null;
  newStatus?: string | null;
}

export const writeAuditLog = async ({
  actor,
  action,
  notes = "",
  applicationId = null,
  entityType = "system",
  entityId = null,
  oldStatus = null,
  newStatus = null,
}: AuditLogInput): Promise<boolean> => {
  try {
    await addDoc(collection(db, "auditLogs"), {
      applicationId: applicationId || (entityType === "loan" ? entityId : null),
      entityType,
      entityId,
      actorId: actor?.uid || null,
      actor: actor?.name || "Unknown",
      actorRole: actor?.role || "unknown",
      action,
      oldStatus,
      newStatus,
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error(`Failed to write audit log for "${action}":`, error);
    return false;
  }
};
