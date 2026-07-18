import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultLibraryPath = path.resolve(__dirname, "..", "library.json");
const defaultSchemaPath = path.resolve(__dirname, "..", "schema", "library-item.schema.json");

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function formatLocation(index) {
  return `item ${index + 1}`;
}

function validateItem(item, index, schema) {
  const errors = [];
  const location = formatLocation(index);

  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return [`${location}: must be an object`];
  }

  for (const field of schema.required) {
    if (!Object.hasOwn(item, field)) {
      errors.push(`${location}: missing required field "${field}"`);
    }
  }

  for (const [field, value] of Object.entries(item)) {
    const fieldSchema = schema.properties[field];
    if (!fieldSchema) {
      errors.push(`${location}: unknown field "${field}"`);
      continue;
    }

    if (fieldSchema.type === "string" && typeof value !== "string") {
      errors.push(`${location}: ${field} must be a string`);
      continue;
    }

    if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
      errors.push(`${location}: ${field} must not be empty`);
    }

    if (field === "date" && !new RegExp(fieldSchema.pattern).test(value)) {
      errors.push(`${location}: date must use YYYY-MM-DD`);
    }
  }

  return errors;
}

function validateUniqueField(items, field) {
  const errors = [];
  const seen = new Map();

  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item[field] !== "string") {
      return;
    }

    const firstIndex = seen.get(item[field]);
    if (firstIndex === undefined) {
      seen.set(item[field], index);
      return;
    }

    errors.push(
      `${formatLocation(index)}: duplicate ${field} "${item[field]}" also appears in item ${firstIndex + 1}`,
    );
  });

  return errors;
}

export async function validateLibraryFile(libraryPath = defaultLibraryPath, schemaPath = defaultSchemaPath) {
  const errors = [];
  let schema;
  let library;

  try {
    schema = await readJson(schemaPath);
  } catch (error) {
    return { ok: false, errors: [`schema: ${error.message}`] };
  }

  try {
    library = await readJson(libraryPath);
  } catch (error) {
    return { ok: false, errors: [`library: ${error.message}`] };
  }

  if (!Array.isArray(library)) {
    errors.push("library: must be an array");
    return { ok: false, errors };
  }

  library.forEach((item, index) => {
    errors.push(...validateItem(item, index, schema));
  });
  errors.push(...validateUniqueField(library, "jobId"));
  errors.push(...validateUniqueField(library, "url"));

  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const libraryPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultLibraryPath;
  const result = await validateLibraryFile(libraryPath);

  if (result.ok) {
    console.log(`${path.relative(process.cwd(), libraryPath) || libraryPath}: valid`);
  } else {
    console.error(`${path.relative(process.cwd(), libraryPath) || libraryPath}: invalid`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}
