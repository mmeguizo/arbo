import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../firebase/config";

/**
 * Resize an image file to max dimensions using canvas before upload.
 * Returns a Blob (JPEG, quality 0.7) suitable for upload.
 * PDFs and non-image files pass through unchanged.
 */
const resizeImage = (
  file: File,
  maxWidth = 800,
  maxHeight = 800,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Only resize images
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = height * (maxWidth / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = width * (maxHeight / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create blob from canvas"));
            }
          },
          "image/jpeg",
          0.7,
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

/**
 * Upload a file to Firebase Storage and return the download URL.
 * Images are auto-resized before upload.
 *
 * @param file - The File object to upload
 * @param path - Storage path (e.g., "documents/uid/cedula_123.jpg")
 * @returns The download URL string
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  // Resize image if applicable
  const resized = await resizeImage(file);

  const storageRef = ref(storage, path);
  const snapshot = await uploadBytesResumable(storageRef, resized, {
    contentType: resized.type,
  });

  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
};

/**
 * Delete a file from Firebase Storage given its download URL.
 * Attempts to parse the URL to extract the storage path.
 * If parsing fails, logs a warning but does not throw.
 */
export const deleteFile = async (url: string): Promise<void> => {
  try {
    // Extract path from Firebase Storage URL
    // URLs look like: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token=...
    const decodedUrl = decodeURIComponent(url);
    const baseMatch = decodedUrl.match(/\/o\/(.+?)(?:\?|$)/);
    if (baseMatch) {
      const filePath = baseMatch[1];
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
    }
  } catch (err) {
    console.warn("Could not delete file from storage:", err);
    // Non-fatal — the URL in Firestore will simply be orphaned
  }
};

/**
 * Build a consistent storage path for user documents.
 */
export const getDocumentPath = (
  userId: string,
  docType: string,
  file: File,
): string => {
  const timestamp = Date.now();
  const ext = file.type === "application/pdf" ? ".pdf" : ".jpg";
  return `documents/${userId}/${docType}_${timestamp}${ext}`;
};

/**
 * Build a consistent storage path for land photos.
 */
export const getLandPhotoPath = (
  applicationId: string,
  index: number,
): string => {
  const timestamp = Date.now();
  return `landPhotos/${applicationId}/photo_${index}_${timestamp}.jpg`;
};
