import crypto from "crypto";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;
const ROOT_FOLDER = process.env.AWS_FOLDER_NAME;

// the bucket is private, so the browser can only open a file through a signed URL
const SIGNED_URL_EXPIRES_IN = 60 * 60; // 1 hour

// Uploads a multer file (memory storage) and returns the S3 key that gets saved in the DB
export const uploadToS3 = async (file, folder) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const key = [ROOT_FOLDER, folder, `${Date.now()}-${crypto.randomUUID()}${ext}`]
    .filter(Boolean)
    .join("/");

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return key;
};

// Uploads a base64 data URI (data:image/jpeg;base64,...) and returns the S3 key + file info.
// Returns null when the string is not a valid base64 data URI.
export const uploadDataUriToS3 = async (dataUri, folder, fileName) => {
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/s.exec(dataUri || "");
  if (!match) return null;

  const [, mimetype, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  const ext = path.extname(fileName || "") || `.${mimetype.split("/")[1]}`;
  const key = await uploadToS3(
    { buffer, mimetype, originalname: `file${ext}` },
    folder
  );

  return { key, mimetype, sizeKb: Math.ceil(buffer.length / 1024) };
};

// Removes files that were uploaded but then rejected by the SP
export const deleteFromS3 = async (keys) => {
  if (!keys.length) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    })
  );
};

// Uploads the form-data "media" files to S3 and builds the media JSON the SP expects.
// Keys are pushed into uploadedKeys as they finish, so the caller can clean them up on failure.
export const uploadMediaFiles = (files, folder, uploadedKeys) =>
  Promise.all(
    files.map(async (file) => {
      const key = await uploadToS3(file, folder);
      uploadedKeys.push(key);
      return {
        kind: file.mimetype.startsWith("video/") ? "video" : "photo",
        file_url: key,
        file_name: file.originalname,
        mime_type: file.mimetype,
        file_size_kb: Math.ceil(file.size / 1024),
      };
    })
  );

// Moves base64 photos from a JSON "media" array to S3 so the DB only stores S3 keys.
// Anything that is not a JSON array is returned unchanged and the SP rejects it.
export const uploadBase64Media = async (media, folder, uploadedKeys) => {
  let items = media;
  if (typeof media === "string") {
    try {
      items = JSON.parse(media);
    } catch {
      return media;
    }
  }
  if (!Array.isArray(items)) return media;

  return Promise.all(
    items.map(async (item) => {
      if (!/^data:/i.test(item?.file_url || "")) return item;
      const uploaded = await uploadDataUriToS3(item.file_url, folder, item.file_name);
      if (!uploaded) return item;
      uploadedKeys.push(uploaded.key);
      return {
        ...item,
        file_url: uploaded.key,
        mime_type: item.mime_type ?? uploaded.mimetype,
        file_size_kb: item.file_size_kb ?? uploaded.sizeKb,
      };
    })
  );
};

// Deletes uploaded files when the SP rejects the request, so S3 has no orphans
export const cleanupUploads = (keys) =>
  deleteFromS3(keys).catch((err) => console.error("S3 cleanup error:", err));

// Turns a stored S3 key into a URL the frontend can show.
// Full URLs and old base64 data URIs are returned as-is.
export const getFileUrl = async (fileUrl) => {
  if (!fileUrl || /^(https?:|data:)/i.test(fileUrl)) return fileUrl;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: fileUrl }), {
    expiresIn: SIGNED_URL_EXPIRES_IN,
  });
};

// Replaces file_url on every media row with a URL the frontend can show
export const withFileUrls = (mediaRows) =>
  Promise.all(
    mediaRows.map(async (m) => ({ ...m, file_url: await getFileUrl(m.file_url) }))
  );
