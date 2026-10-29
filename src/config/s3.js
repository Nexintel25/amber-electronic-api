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
