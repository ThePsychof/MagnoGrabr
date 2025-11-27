// Modern file type recognition based on extension and MIME type
function recognizeFileType(filename: string | null, mime: string | null): string | null {
  if (mime) {
    if (/^image\//.test(mime)) return "image";
    if (/^video\//.test(mime)) return "video";
    if (/^audio\//.test(mime)) return "audio";
    if (/^application\/pdf$/.test(mime)) return "pdf";
    if (/^application\/zip$/.test(mime)) return "archive";
    if (/^application\/(x-)?(rar|7z|tar|gzip|bzip2)$/.test(mime)) return "archive";
    if (/^text\//.test(mime)) return "text";
    if (/^application\/json$/.test(mime)) return "json";
    if (/^application\/msword$|^application\/vnd\.openxmlformats-officedocument\.wordprocessingml/.test(mime)) return "word";
    if (/^application\/vnd\.ms-excel$|^application\/vnd\.openxmlformats-officedocument\.spreadsheetml/.test(mime)) return "excel";
    if (/^application\/vnd\.ms-powerpoint$|^application\/vnd\.openxmlformats-officedocument\.presentationml/.test(mime)) return "powerpoint";
  }
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext) return null;
    if (["jpg","jpeg","png","gif","bmp","webp","svg","ico"].includes(ext)) return "image";
    if (["mp4","webm","mkv","mov","avi","flv","wmv","mpeg","mpg"].includes(ext)) return "video";
    if (["mp3","wav","ogg","flac","aac","m4a"].includes(ext)) return "audio";
    if (["pdf"].includes(ext)) return "pdf";
    if (["zip","rar","7z","tar","gz","bz2"].includes(ext)) return "archive";
    if (["txt","md","csv","log"].includes(ext)) return "text";
    if (["json"].includes(ext)) return "json";
    if (["doc","docx"].includes(ext)) return "word";
    if (["xls","xlsx"].includes(ext)) return "excel";
    if (["ppt","pptx"].includes(ext)) return "powerpoint";
  }
  return null;
}
// Convert bytes to human-readable string
function humanFileSize(bytes: number | string | null): string | null {
  if (bytes == null) return null;
  const n = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let u = -1;
  let size = n;
  do {
    size /= 1024;
    u++;
  } while (size >= 1024 && u < units.length - 1);
  return `${size.toFixed(2)} ${units[u]}`;
}

// getLinkInfo.ts — fully TS-safe, handles undefined URLs
export type LinkInfoOK = {
  ok: true;
  size: string | null;
  filename: string | null;
  type: string | null;
  mime: string | null;
};

export type LinkInfoErr = { ok: false; error: string };
export type LinkInfo = LinkInfoOK | LinkInfoErr;

const DEFAULT_TIMEOUT = 5000; // ms
const RANGE_BYTES_SMALL = 0; // try 0-0 first
const FALLBACK_RANGE_BYTES = 1023; // when full GET fallback, request up to ~1KB
const MAX_FALLBACK_READ = 2048; // maximum bytes to read from body before cancelling

function isDataUrl(u: string): boolean {
  return typeof u === "string" && u.startsWith("data:");
}

function parseDataUrl(raw: string): { size: string | null; type: string | null; mime: string | null } | null {
  try {
    const without = raw.slice(5);
    const comma = without.indexOf(",");
    if (comma === -1) return null;
    const meta = without.slice(0, comma);
    const data = without.slice(comma + 1);
    const isBase64 = /;base64$/i.test(meta);
    let sizeNumber: number | null = null;
    if (isBase64) {
      const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
      sizeNumber = Math.max(0, Math.ceil((data.length * 3) / 4) - padding);
    } else {
      try {
        const decoded = decodeURIComponent(data);
        sizeNumber = new TextEncoder().encode(decoded).length;
      } catch {
        sizeNumber = data.length;
      }
    }
    // Data URLs: try to guess type from mediatype
    const mimeMatch = meta.match(/^([^;]+)/);
    const mime: string | null = mimeMatch && typeof mimeMatch[1] === "string" ? mimeMatch[1] : null;
    const type = recognizeFileType(null, mime);
    return { size: humanFileSize(sizeNumber), type, mime };
  } catch {
    return null;
  }
}


// Parse Content-Disposition filename robustly, including RFC5987 (filename*=UTF-8'')
function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;

  // Try RFC5987: filename*=utf-8''%e2%82%ac%20rates
  const rfc5987 = /filename\*=(?:UTF-8'')?([^;\n]+)/i.exec(disposition);
  if (rfc5987 && rfc5987[1]) {
    try {
      let raw = rfc5987[1].trim().replace(/^"|"$/g, "");
      return decodeURIComponent(raw);
    } catch {}
  }

  // Fallback to regular filename=VALUE
  const regular = /filename=(?:"([^"]+)"|([^;\n]+))/i.exec(disposition);
  if (regular) {
    const v = regular[1] || regular[2];
    return v ? v.trim() : null;
  }
  return null;
}


function parseContentRange(header: string | null): string | null {
  if (!header) return null;
  const m = /bytes \d+-\d+\/(\d+|\*)/.exec(header);
  if (!m) return null;
  const total = m[1];
  if (!total || total === "*") return null;
  return total;
}


// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}


/**
 * Get link info safely.
 * @param rawUrl URL string (may be undefined)
 */
export async function getLinkInfo(rawUrl: string | undefined, timeout = DEFAULT_TIMEOUT): Promise<LinkInfo> {
  if (!rawUrl || rawUrl.trim() === "") {
    return { ok: false, error: "Invalid or missing URL" };
  }
  const url = rawUrl.trim();

  // Fast-path for data URLs
  if (isDataUrl(url)) {
    const parsed = parseDataUrl(url);
    return {
      ok: true,
      size: parsed?.size ?? null,
      filename: null,
      type: parsed?.type ?? null,
      mime: parsed?.mime ?? null,
    };
  }

  // Try HEAD request first
  try {
    const headRes = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" }, timeout);
    if (headRes?.ok) {
      const cd = headRes.headers.get("content-disposition");
      const cl = headRes.headers.get("content-length");
      const cr = headRes.headers.get("content-range");
      const sizeRaw = cl || parseContentRange(cr);
      const filename = parseFilename(cd);
      const mime = headRes.headers.get("content-type");
      const type = recognizeFileType(filename, mime);
      return {
        ok: true,
        size: humanFileSize(sizeRaw),
        filename,
        type,
        mime,
      };
    }
  } catch {}

  // Minimal builder: only parse headers, avoid reading body for speed
  const buildMinimal = (res: Response): LinkInfoOK => {
    const cd = res.headers.get("content-disposition");
    const cl = res.headers.get("content-length");
    const cr = res.headers.get("content-range");
    const sizeRaw = cl || parseContentRange(cr);
    const filename = parseFilename(cd);
    const mime = res.headers.get("content-type");
    const type = recognizeFileType(filename, mime);
    return {
      ok: true,
      size: humanFileSize(sizeRaw),
      filename,
      type,
      mime,
    };
  };

  // Try small range 0-0 (cheap) to get Content-Range or Content-Length
  try {
    const small = await fetchWithTimeout(url, { method: "GET", headers: { Range: `bytes=0-${RANGE_BYTES_SMALL}` }, redirect: "follow" }, timeout);
    if (small && (small.status === 206 || small.status === 200)) {
      return buildMinimal(small);
    }
  } catch {}

  // 8️⃣ Fallback: perform a full GET but abort the connection immediately after reading headers.
  // Use a dedicated AbortController so we can cancel the network request as soon as headers arrive.
  try {
    const controller = new AbortController();
    // Safety: ensure we don't hang longer than the overall timeout
    const abortTimeout = setTimeout(() => controller.abort(), timeout + 100);

    // Request a limited range to avoid huge transfers from servers that ignore HEAD/Range.
    const full = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { Range: `bytes=0-${FALLBACK_RANGE_BYTES}` } });
    if (full) {
      const info = buildMinimal(full);

      // Try to read at most a small chunk from the body and then cancel to ensure we don't
      // download the entire payload on misbehaving servers.
      try {
        const body: any = (full as any).body;
        if (body) {
          if (typeof body.getReader === 'function') {
            const reader = body.getReader();
            try {
              // Read a single chunk (or until MAX_FALLBACK_READ) then cancel.
              const { value, done } = await reader.read();
              // value may be Uint8Array
              // If further safety desired, we could loop until bytes read reaches MAX_FALLBACK_READ.
              try { reader.cancel(); } catch {}
            } catch {}
          } else if (typeof body.cancel === 'function') {
            try { body.cancel(); } catch {}
          }
        }
      } catch {}

      // Abort the underlying request to close the connection ASAP.
      try { controller.abort(); } catch {}
      clearTimeout(abortTimeout);

      return info;
    }
  } catch (err) {
    // If the fetch was aborted or failed, swallow and fall through to error
  }

  // If all minimal probes failed, return error
  return { ok: false, error: "Unable to retrieve size/filename with minimal probes" };
}