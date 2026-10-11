import type { DomainExport } from "./domain-export.js";

export type SanitizeDomainResult = {
  domain: DomainExport;
  skippedCapabilities: string[];
  skippedGroups: string[];
};

function validAreaIds(
  domain: DomainExport,
  roomRemap?: Map<string, string>
): Set<string> {
  return new Set(
    domain.areas.map((area) => {
      const id = area.id;
      return roomRemap?.get(id) ?? id;
    })
  );
}

/** Drop stale capabilities/groups from export payloads (orphaned DB rows). */
export function sanitizeDomainExport(domain: DomainExport): DomainExport {
  const { domain: sanitized } = sanitizeDomainForRestore(domain);
  return sanitized;
}

/** Prepare backup domain for restore — skip orphans, clear invalid FK targets. */
export function sanitizeDomainForRestore(
  domain: DomainExport,
  roomRemap?: Map<string, string>
): SanitizeDomainResult {
  const areaIds = validAreaIds(domain, roomRemap);
  const deviceIds = new Set(domain.devices.map((d) => d.id));
  const groupIds = new Set(domain.groups.map((g) => g.id));

  const skippedCapabilities: string[] = [];
  const skippedGroups: string[] = [];

  const capabilities = domain.capabilities.flatMap((cap) => {
    if (!deviceIds.has(cap.deviceId)) {
      skippedCapabilities.push(cap.name);
      return [];
    }
    let areaId = cap.areaId;
    if (areaId) {
      const mapped = roomRemap?.get(areaId) ?? areaId;
      areaId = areaIds.has(mapped) ? mapped : null;
    }
    const groupId =
      cap.groupId && groupIds.has(cap.groupId) ? cap.groupId : null;
    return [{ ...cap, areaId, groupId }];
  });

  const capabilityIds = new Set(capabilities.map((c) => c.id));
  const capabilityBindings = domain.capabilityBindings.filter((binding) =>
    capabilityIds.has(binding.capabilityId)
  );

  const groups = domain.groups.flatMap((group) => {
    const areaId = roomRemap?.get(group.areaId) ?? group.areaId;
    if (!areaIds.has(areaId)) {
      skippedGroups.push(group.name);
      return [];
    }
    return [{ ...group, areaId }];
  });

  return {
    domain: {
      ...domain,
      capabilities,
      capabilityBindings,
      groups,
    },
    skippedCapabilities,
    skippedGroups,
  };
}
