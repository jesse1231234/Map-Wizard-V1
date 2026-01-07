import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function s3Client() {
  const region = process.env.S3_REGION;
  const endpoint = process.env.S3_ENDPOINT; // optional for R2/MinIO
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("S3_REGION/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY are required");
  }

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId, secretAccessKey }
  });
}

export async function createPresignedPutUrl(args: {
  key: string;
  contentType: string;
  bucket?: string;
  expiresInSeconds?: number;
}) {
  const bucket = args.bucket ?? process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required");

  const client = s3Client();
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: args.key,
    ContentType: args.contentType
  });

  const url = await getSignedUrl(client, cmd, {
    expiresIn: args.expiresInSeconds ?? 300
  });

  return { bucket, key: args.key, url };
}
