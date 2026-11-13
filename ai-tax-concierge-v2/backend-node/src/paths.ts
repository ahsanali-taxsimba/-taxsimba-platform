import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));

/** backend-node/ root */
export const BACKEND_NODE_ROOT = path.resolve(SRC_DIR, "..");

/** Vendored JSON data (copies — Node runs without Python tree). */
export const DATA_DIR = path.join(BACKEND_NODE_ROOT, "data");

export const CORPUS_DIR = path.join(DATA_DIR, "corpus");
export const CATALOG_DIR = path.join(DATA_DIR, "catalog");
export const JOURNEYS_DEFINITIONS = path.join(DATA_DIR, "journeys-definitions.json");
export const ROUTES_JSON = path.join(DATA_DIR, "routes.json");

/** Widget static assets: ai-tax-concierge-v2/widget (sibling of backend-node). */
export const WIDGET_DIR = path.join(BACKEND_NODE_ROOT, "../widget");
