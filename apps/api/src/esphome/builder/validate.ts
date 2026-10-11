import {
  boardCatalogEntry,
  componentCatalogEntry,
  type BuilderComponent,
  type BuilderFieldDef,
  type EsphomeDeviceBuilderConfig,
} from "@nexternel/domain";

export type BuilderValidationIssue = {
  path: string;
  message: string;
  code: string;
};

export type BuilderValidationResult = {
  valid: boolean;
  issues: BuilderValidationIssue[];
};

function issue(
  path: string,
  message: string,
  code: string
): BuilderValidationIssue {
  return { path, message, code };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveBuilderSlug(config: EsphomeDeviceBuilderConfig): string {
  const raw = config.slug?.trim() || slugify(config.displayName);
  return raw.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function fieldValue(comp: BuilderComponent, key: string): unknown {
  return (comp as Record<string, unknown>)[key];
}

function validateCatalogFields(
  comp: BuilderComponent,
  catalog: { label: string; fields: BuilderFieldDef[] },
  path: string,
  board: ReturnType<typeof boardCatalogEntry>,
  usedPins: Map<number, string>,
  issues: BuilderValidationIssue[]
): void {
  const gpioPins: { key: string; pin: number }[] = [];

  for (const field of catalog.fields) {
    const fieldPath = `${path}.${field.key}`;
    const value = fieldValue(comp, field.key);

    if (field.required) {
      if (field.type === "string") {
        if (typeof value !== "string" || !value.trim()) {
          issues.push(issue(fieldPath, `${field.label} is required`, "required"));
          continue;
        }
      } else if (field.type === "number") {
        if (!Number.isInteger(value)) {
          issues.push(issue(fieldPath, `${field.label} is required`, "required"));
          continue;
        }
      } else if (field.type === "select") {
        if (typeof value !== "string" || !value) {
          issues.push(issue(fieldPath, `${field.label} is required`, "required"));
          continue;
        }
      }
    }

    if (value === undefined || value === null || value === "") continue;

    if (field.type === "number" && Number.isInteger(value)) {
      const num = value as number;
      if (field.min !== undefined && num < field.min) {
        issues.push(
          issue(fieldPath, `${field.label} must be at least ${field.min}`, "out_of_range")
        );
      }
      if (field.max !== undefined && num > field.max) {
        issues.push(
          issue(fieldPath, `${field.label} must be at most ${field.max}`, "out_of_range")
        );
      }
      if (field.gpio) {
        gpioPins.push({ key: field.key, pin: num });
      }
    }

    if (field.type === "select" && typeof value === "string" && field.options) {
      const allowed = field.options.map((o) => o.value);
      if (!allowed.includes(value)) {
        issues.push(
          issue(
            fieldPath,
            `Select a valid ${field.label.toLowerCase()}`,
            "invalid_variant"
          )
        );
      }
    }
  }

  const ownerLabel =
    comp.kind === "gpio_switch" && comp.name?.trim()
      ? comp.name.trim()
      : catalog.label;

  for (const { key, pin } of gpioPins) {
    const pinPath = `${path}.${key}`;
    if (board && (pin < board.gpioMin || pin > board.gpioMax)) {
      issues.push(
        issue(pinPath, `GPIO ${pin} is not valid for ${board.label}`, "invalid_pin")
      );
      continue;
    }
    const prev = usedPins.get(pin);
    if (prev) {
      issues.push(
        issue(pinPath, `GPIO ${pin} is already used by ${prev}`, "duplicate_pin")
      );
    } else {
      usedPins.set(pin, ownerLabel);
    }
  }

  const sda = comp.sdaPin;
  const scl = comp.sclPin;
  if (Number.isInteger(sda) && Number.isInteger(scl) && sda === scl) {
    issues.push(
      issue(`${path}.sclPin`, "I²C SDA and SCL must use different GPIO pins", "duplicate_pin")
    );
  }

  const tx = comp.uartTxPin;
  const rx = comp.uartRxPin;
  if (Number.isInteger(tx) && Number.isInteger(rx) && tx === rx) {
    issues.push(
      issue(`${path}.uartRxPin`, "UART TX and RX must use different GPIO pins", "duplicate_pin")
    );
  }

  const trigger = comp.pin;
  const echo = comp.echoPin;
  if (comp.kind === "hc_sr04" && Number.isInteger(trigger) && Number.isInteger(echo) && trigger === echo) {
    issues.push(
      issue(`${path}.echoPin`, "Trigger and echo pins must be different", "duplicate_pin")
    );
  }
}

export function validateEsphomeBuilderConfig(
  input: unknown
): BuilderValidationResult {
  const issues: BuilderValidationIssue[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      issues: [issue("", "Device configuration is required", "invalid_config")],
    };
  }

  const config = input as Partial<EsphomeDeviceBuilderConfig>;

  if (config.version !== 1) {
    issues.push(
      issue("version", "Unsupported configuration version", "unsupported_version")
    );
  }

  if (!config.displayName?.trim()) {
    issues.push(issue("displayName", "Device display name is required", "required"));
  } else if (config.displayName.trim().length > 100) {
    issues.push(
      issue("displayName", "Device display name is too long", "max_length")
    );
  } else if (/^\d/.test(config.displayName.trim())) {
    issues.push(
      issue(
        "displayName",
        "Device name must not start with a number",
        "invalid_name"
      )
    );
  }

  const board = config.boardId ? boardCatalogEntry(config.boardId) : undefined;
  if (!board) {
    issues.push(issue("boardId", "Select a supported board", "invalid_board"));
  }

  if (config.platform !== "esp32" && config.platform !== "esp8266") {
    issues.push(issue("platform", "Select ESP32 or ESP8266", "invalid_platform"));
  } else if (board && board.platform !== config.platform) {
    issues.push(
      issue(
        "boardId",
        `Board ${board.label} is not compatible with platform ${config.platform}`,
        "platform_mismatch"
      )
    );
  }

  const slug = resolveBuilderSlug(config as EsphomeDeviceBuilderConfig);
  if (!slug) {
    issues.push(
      issue("slug", "Could not derive a valid device identifier", "invalid_slug")
    );
  } else if (!/^[a-z][a-z0-9-]{0,62}$/.test(slug)) {
    issues.push(
      issue(
        "slug",
        "Device identifier must start with a letter and use lowercase letters, numbers, and hyphens only",
        "invalid_slug"
      )
    );
  }

  const components = Array.isArray(config.components) ? config.components : [];
  if (components.length === 0) {
    issues.push(
      issue("components", "Add at least one component", "components_required")
    );
  }

  const usedPins = new Map<number, string>();

  components.forEach((raw, index) => {
    const path = `components[${index}]`;
    if (!raw || typeof raw !== "object") {
      issues.push(issue(path, "Invalid component entry", "invalid_component"));
      return;
    }
    const comp = raw as BuilderComponent;
    if (!comp.id?.trim()) {
      issues.push(issue(`${path}.id`, "Component id is required", "required"));
    }

    const catalog = componentCatalogEntry(comp.kind);
    if (!catalog) {
      issues.push(issue(`${path}.kind`, "Unsupported component type", "invalid_kind"));
      return;
    }

    if (config.platform && !catalog.platforms.includes(config.platform)) {
      issues.push(
        issue(
          `${path}.kind`,
          `${catalog.label} is not supported on ${config.platform}`,
          "platform_unsupported"
        )
      );
    }

    validateCatalogFields(comp, catalog, path, board, usedPins, issues);
  });

  return { valid: issues.length === 0, issues };
}

export function normalizeBuilderConfig(
  input: EsphomeDeviceBuilderConfig
): EsphomeDeviceBuilderConfig {
  const slug = resolveBuilderSlug(input);
  return {
    ...input,
    version: 1,
    displayName: input.displayName.trim(),
    slug,
    description: input.description?.trim() || undefined,
    roomId: input.roomId ?? null,
    components: input.components.map((c) => {
      const entry = componentCatalogEntry(c.kind);
      const normalized: BuilderComponent = { ...c, id: c.id.trim() };
      if (!entry) return normalized;
      for (const field of entry.fields) {
        const key = field.key;
        const current = fieldValue(normalized, key);
        if (current === undefined && field.defaultValue !== undefined) {
          (normalized as Record<string, unknown>)[key] = field.defaultValue;
        }
        if (field.type === "string" && typeof current === "string") {
          (normalized as Record<string, unknown>)[key] = current.trim();
        }
      }
      if (c.kind === "gpio_switch") {
        normalized.inverted = c.inverted !== false;
      }
      return normalized;
    }),
  };
}
