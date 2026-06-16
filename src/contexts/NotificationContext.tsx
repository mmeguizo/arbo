import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "./AuthContext";

export interface Notification {
  id: string;
  recipientId: string;
  recipientRole: string;
  type:
    | "submitted"
    | "forwarded"
    | "encoded"
    | "awarded"
    | "disputed"
    | "correction_needed"
    | "correction_resolved"
    | "training_assigned"
    | "training_reminder"
    | "training_acknowledged";
  title: string;
  message: string;
  applicationId: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  writeNotification: (
    recipientRole: string,
    type: Notification["type"],
    title: string,
    message: string,
    applicationId?: string | null,
    recipientId?: string | null,
  ) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Real-time listener — scoped to this user's uid AND role-based broadcasts
  useEffect(() => {
    if (!profile) {
      setNotifications([]);
      return;
    }

    // Query 1: Direct notifications (recipientId === user uid)
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", profile.uid),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Notification[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Notification);
        });
        setNotifications((prev) => {
          // Merge with any role-based notifications, deduplicate by ID
          const ids = new Set(list.map((n) => n.id));
          const merged = [...list];
          prev.forEach((n) => {
            if (!ids.has(n.id)) merged.push(n);
          });
          return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      },
      (err) => {
        console.error("Notification snapshot error:", err);
      },
    );

    // Query 2 (admin only): Role-based broadcasts (recipientRole === "admin" + recipientId is not a uid)
    let unsubRole: (() => void) | undefined;
    if (profile.role === "admin") {
      const qRole = query(
        collection(db, "notifications"),
        where("recipientRole", "==", "admin"),
        orderBy("createdAt", "desc"),
      );
      unsubRole = onSnapshot(qRole, (snap) => {
        const roleList: Notification[] = [];
        snap.forEach((d) => {
          const data = d.data();
          // Only include if recipientId is NOT a specific user (broadcast) or matches
          if (
            !data.recipientId ||
            data.recipientId === profile.uid ||
            data.recipientId === "admin"
          ) {
            roleList.push({ id: d.id, ...data } as Notification);
          }
        });
        setNotifications((prev) => {
          const ids = new Set(prev.map((n) => n.id));
          const merged = [...prev];
          roleList.forEach((n) => {
            if (!ids.has(n.id)) merged.push(n);
          });
          return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      });
    }

    return () => {
      unsub();
      if (unsubRole) unsubRole();
    };
  }, [profile]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    try {
      const ref = doc(db, "notifications", id);
      await updateDoc(ref, { read: true });
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (notifications.length === 0) return;
    // Optimistic local update
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read: true } : n)),
    );
    try {
      const batch = writeBatch(db);
      unreadIds.forEach((id) => {
        const ref = doc(db, "notifications", id);
        batch.update(ref, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      // Revert on failure
      setNotifications((prev) =>
        prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read: false } : n)),
      );
    }
  }, [notifications]);

  const writeNotification = useCallback(
    async (
      recipientRole: string,
      type: Notification["type"],
      title: string,
      message: string,
      applicationId: string | null = null,
      recipientId: string | null = null,
    ) => {
      try {
        // Always require a recipientId — never create shared notification docs
        await addDoc(collection(db, "notifications"), {
          recipientId: recipientId || profile?.uid || "unknown",
          recipientRole,
          type,
          title,
          message,
          applicationId: applicationId || null,
          read: false,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to write notification:", err);
      }
    },
    [profile],
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        writeNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
};

// Standalone broadcast — creates individual notification docs per user in a role
export const broadcastNotification = async (
  role: string,
  type: Notification["type"],
  title: string,
  message: string,
  applicationId: string | null = null,
) => {
  try {
    const { collection, getDocs, addDoc, query, where } =
      await import("firebase/firestore");
    const { db } = await import("../firebase/config");

    // Find all users with this role
    const usersQ = query(collection(db, "users"), where("role", "==", role));
    const usersSnap = await getDocs(usersQ);

    // Create an individual notification for each user in that role
    const batch = usersSnap.docs.map((userDoc) =>
      addDoc(collection(db, "notifications"), {
        recipientId: userDoc.id,
        recipientRole: role,
        type,
        title,
        message,
        applicationId: applicationId || null,
        read: false,
        createdAt: new Date().toISOString(),
      }),
    );

    await Promise.all(batch);
  } catch (err) {
    console.error("Failed to broadcast notification:", err);
  }
};
