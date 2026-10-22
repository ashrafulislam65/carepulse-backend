import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: env.AWS_ACCESS_KEY_ID
    ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
    : undefined,
});

const bucket = () => {
  if (!env.S3_BUCKET) throw new AppError(503, "File storage (S3) is not configured");
  return env.S3_BUCKET;
};

export const createUploadUrl = (key: string, contentType: string) =>
  getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn: 300,
  });

export const createDownloadUrl = (key: string) =>
  getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 300 });

export const deleteObject = async (key: string) => {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch (e) {
    console.error("S3 delete failed", e);
  }
};