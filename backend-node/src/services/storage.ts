/**
 * Object storage abstraction.
 *
 * The Python reference stored objects through the Emergent integrations proxy. Node uses a
 * provider-neutral interface instead: an S3-compatible adapter for staging/production and a
 * local filesystem adapter for automated tests. Object paths are unchanged
 * (`taxsimba/<case_id>/<uuid>_<filename>`) so existing stored objects stay resolvable.
 *
 * Required production environment variables:
 *   STORAGE_DRIVER=s3
 *   S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
 * Test/dev: STORAGE_DRIVER=local, LOCAL_STORAGE_DIR=<writable path>
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env, required } from "../config/env";

export interface StoredObject {
  path: string;
  content_type: string;
  size: number;
}

export interface Storage {
  put(path: string, data: Buffer, contentType: string): Promise<StoredObject>;
  get(path: string): Promise<{ data: Buffer; contentType: string }>;
}

class S3Storage implements Storage {
  private client: S3Client;

  private bucket: string;

  constructor() {
    this.bucket = required("S3_BUCKET");
    this.client = new S3Client({
      region: required("S3_REGION"),
      endpoint: env("S3_ENDPOINT"),
      // Path-style keeps non-AWS S3-compatible providers (MinIO, R2, Spaces) working.
      forcePathStyle: (env("S3_FORCE_PATH_STYLE") ?? "true") === "true",
      credentials: {
        accessKeyId: required("S3_ACCESS_KEY_ID"),
        secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
      },
    });
  }

  async put(path: string, data: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: data,
        ContentType: contentType,
      }),
    );
    return { path, content_type: contentType, size: data.length };
  }

  async get(path: string): Promise<{ data: Buffer; contentType: string }> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: path }),
    );
    const body = out.Body as unknown as AsyncIterable<Uint8Array>;
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return {
      data: Buffer.concat(chunks),
      contentType: out.ContentType ?? "application/octet-stream",
    };
  }
}

class LocalStorage implements Storage {
  private root: string;

  constructor() {
    this.root = resolve(env("LOCAL_STORAGE_DIR") ?? "./.storage");
  }

  private resolveKey(path: string): string {
    const full = resolve(join(this.root, path));
    // Object keys come from server-generated ids, but never let one escape the root.
    if (full !== this.root && !full.startsWith(`${this.root}/`)) {
      throw new Error("Invalid object path");
    }
    return full;
  }

  async put(path: string, data: Buffer, contentType: string): Promise<StoredObject> {
    const full = this.resolveKey(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
    await writeFile(`${full}.meta`, contentType, "utf8");
    return { path, content_type: contentType, size: data.length };
  }

  async get(path: string): Promise<{ data: Buffer; contentType: string }> {
    const full = this.resolveKey(path);
    const data = await readFile(full);
    let contentType = "application/octet-stream";
    try {
      contentType = (await readFile(`${full}.meta`, "utf8")).trim() || contentType;
    } catch {
      /* metadata sidecar is optional */
    }
    return { data, contentType };
  }
}

let instance: Storage | null = null;

export function storage(): Storage {
  if (instance) return instance;
  const driver = (env("STORAGE_DRIVER") ?? "s3").toLowerCase();
  if (driver === "local") instance = new LocalStorage();
  else if (driver === "s3") instance = new S3Storage();
  else throw new Error(`Unknown STORAGE_DRIVER '${driver}' (expected 's3' or 'local')`);
  return instance;
}

/** Test seam: lets suites inject a fake adapter. */
export function setStorage(custom: Storage | null): void {
  instance = custom;
}

export function putObject(path: string, data: Buffer, contentType: string): Promise<StoredObject> {
  return storage().put(path, data, contentType);
}

export function getObject(path: string): Promise<{ data: Buffer; contentType: string }> {
  return storage().get(path);
}
