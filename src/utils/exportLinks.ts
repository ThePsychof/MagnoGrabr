// Utility for exporting links in various formats
import type { GrabbedLink } from "./linkCategorizer";

export type ExportFormat = "text" | "csv" | "json";

function getNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/').filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : '';
    return last ? decodeURIComponent(last) : '';
  } catch {
    return '';
  }
}

function getFileTag(url: string, filename?: string | null): string {
  const nameToCheck = filename || getNameFromUrl(url);
  const match = nameToCheck.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() || '';
}

function getBlob(links: GrabbedLink[], format: ExportFormat = "text"): Blob {
  if (!links.length) {
    return new Blob([""], { type: "text/plain" });
  }
  if (format === "csv") {
    const header = "name,size,type,tag,url";
    const rows = links.map(l => {
      const normalized = l.normalized || "";
      const name = l.filename || getNameFromUrl(normalized) || "";
      const size = l.size || "";
      const type = l.type || "";
      const tag = getFileTag(normalized, l.filename) || "";
      const url = normalized;
      return `"${name}","${size}","${type}","${tag}","${url}"`;
    });
    return new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
  }
  if (format === "json") {
    const arr = links.map(l => {
      const normalized = l.normalized || "";
      return {
        name: l.filename || getNameFromUrl(normalized) || "",
        size: l.size || "",
        type: l.type || "",
        tag: getFileTag(normalized, l.filename) || "",
        url: normalized
      };
    });
    return new Blob([JSON.stringify(arr, null, 2)], { type: "application/json" });
  }
  // default: text
  const text = links.map(l => l.normalized).join("\n");
  return new Blob([text], { type: "text/plain" });
}

function getFileExtension(format: ExportFormat): string {
  if (format === "csv") return "csv";
  if (format === "json") return "json";
  return "txt";
}

function getFilename(format: ExportFormat): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const ext = getFileExtension(format);
  return `MagnoGrabr_Links_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${ext}`;
}

export function getExportFilename(format: ExportFormat): string {
  return getFilename(format);
}

export async function exportLinks(links: GrabbedLink[], format: ExportFormat = "text"): Promise<void> {
  if (!links || !links.length) {
    throw new Error("No links to export");
  }

  const blob = getBlob(links, format);
  const url = URL.createObjectURL(blob);
  const filename = getFilename(format);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
