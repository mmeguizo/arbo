import { supabase, supabaseStorageBucket } from "../supabase/config";

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
 * Upload a file to Supabase Storage and return its public URL.
 * Images are auto-resized before upload.
 *
 * @param file - The File object to upload
 * @param path - Storage path (e.g., "documents/uid/cedula_123.jpg")
 * @returns The download URL string
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  // Resize image if applicable
  const resized = await resizeImage(file);

  const { error } = await supabase.storage
    .from(supabaseStorageBucket)
    .upload(path, resized, {
      contentType: resized.type || file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    if (error.message.toLowerCase().includes("row-level security")) {
      throw new Error(
        "Supabase Storage upload is blocked by its storage.objects policy. Add an INSERT policy for the public uploads bucket.",
      );
    }
    throw new Error(
      `Supabase Storage upload failed for ${path}: ${error.message}`,
    );
  }

  const { data } = supabase.storage
    .from(supabaseStorageBucket)
    .getPublicUrl(path);

  if (!data.publicUrl) {
    throw new Error(`Supabase Storage returned no public URL for ${path}.`);
  }

  return data.publicUrl;
};

const getSupabaseStoragePath = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    const marker = `/storage/v1/object/public/${supabaseStorageBucket}/`;
    const markerIndex = parsedUrl.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(
      parsedUrl.pathname.slice(markerIndex + marker.length),
    );
  } catch {
    return null;
  }
};

/**
 * Delete a file from Supabase Storage given its public URL.
 * Legacy Firebase Storage URLs are intentionally left untouched.
 */
export const deleteFile = async (url: string): Promise<void> => {
  const path = getSupabaseStoragePath(url);
  if (!path) {
    return;
  }

  const { error } = await supabase.storage
    .from(supabaseStorageBucket)
    .remove([path]);

  if (error) {
    console.warn("Could not delete file from Supabase Storage:", error);
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
