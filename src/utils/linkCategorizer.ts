// --------------------------
// Link Category Types
// --------------------------
export type LinkCategory = "media" | "files" | "links" | "software" | "suspicious" | "misc";

export interface CategorizeHints {
  filename?: string | null;
  mime?: string | null;
  typeHint?: string | null;
}

// --------------------------
// Grabbed Link Interface
// --------------------------
export interface GrabbedLink {
  id: string;
  url: string;
  normalized: string;
  category: LinkCategory;
  text?: string;
  timestamp: number;
  type?: string | null;
  mime?: string | null;
  size?: string | null;
  filename?: string | null;
}

// --------------------------
// Generate Unique ID
// --------------------------
export function uid(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// --------------------------
// Normalize/resolve an href to absolute URL string and strip fragment
// --------------------------
export function normalizeHref(href: string, base?: string): string {
  if (!href) throw new Error('empty href');
  try {
    const url = new URL(href, base || (typeof window !== 'undefined' ? window.location.href : 'http://localhost'));
    // strip fragment
    url.hash = '';
    return url.toString();
  } catch (err) {
    // fallback: try to coerce simple protocol-less urls
    const trimmed = href.trim();
    if (/^\/\//.test(trimmed)) return (typeof location !== 'undefined' ? location.protocol : 'http:') + trimmed;
    if (/^[a-z0-9.+-]+:\/\//i.test(trimmed)) return trimmed;
    throw err;
  }
}

// --------------------------
// Category Extensions
// --------------------------
const CATEGORY_EXTENSIONS: Record<LinkCategory, Set<string>> = {
  media: new Set([
    // Images
    "jpg","jpeg","png","webp","gif","bmp","svg","ico","tiff","tif","heic","heif","jfif","raw",
    // Videos
    "mp4","webm","mkv","mov","avi","flv","wmv","m4v","mpg","mpeg","3gp","ogv","ts","mts","m2ts","vob","f4v",
    // Audio
    "mp3","wav","flac","ogg","m4a","aac","mid","midi","wma","opus","aiff","ape","alac"
  ]),
  files: new Set([
    // Documents
    "pdf","doc","docx","txt","rtf","odt",
    // Spreadsheets
    "xls","xlsx","csv","ods","tsv",
    // Presentations
    "ppt","pptx","odp",
    // Archives
    "zip","rar","7z","tar","gz","bz2","xz","iso","dmg","cab","lz4","brotli",
    // Code
    "js","ts","py","sh","bash","bat","ps1","java","cpp","c","h","hpp","rb","go","rs","php","pl","lua","scala","kotlin",
    // Web
    "html","css","scss","less","json","xml","yaml","yml","toml","sql",
    // Markup
    "md","markdown","rst","tex","latex",
    // Fonts
    "ttf","otf","woff","woff2","eot",
    // Other
    "sql","db","sqlite","conf","config","ini","env"
  ]),
  software: new Set([
    // Windows
    "exe","msi","msix","appx","dll","sys",
    // macOS
    "app","dmg",
    // Linux/Unix
    "rpm","deb","apk","snap","flatpak","run","bin","sh",
    // Mobile
    "apk","ipa",
    // Archives/Installers
    "iso","jar","war","aar"
  ]),
  links: new Set(["url","link","http","https","anchor"]),
  suspicious: new Set([
    "sus","unknown","malware","phishing","exploit","trojan","virus","worm",
    "ransomware","adware","spyware","rootkit","backdoor","suspicious"
  ]),
  misc: new Set(["other","misc","undefined","random","leftover"])
};

// --------------------------
// MIME Category Mapping
// --------------------------
const MIME_CATEGORIES: Record<string, LinkCategory> = {
  // Images
  "image/jpeg": "media",
  "image/png": "media",
  "image/webp": "media",
  "image/gif": "media",
  "image/svg+xml": "media",
  "image/bmp": "media",
  "image/tiff": "media",
  "image/heic": "media",
  "image/heif": "media",
  "image/vnd.adobe.photoshop": "media",

  // Videos
  "video/mp4": "media",
  "video/webm": "media",
  "video/quicktime": "media",
  "video/x-msvideo": "media",
  "video/x-matroska": "media",
  "video/mpeg": "media",
  "video/ogg": "media",
  "video/3gpp": "media",

  // Audio
  "audio/mpeg": "media",
  "audio/wav": "media",
  "audio/flac": "media",
  "audio/ogg": "media",
  "audio/aac": "media",
  "audio/mp4": "media",
  "audio/webm": "media",

  // Documents
  "application/pdf": "files",
  "application/msword": "files",
  "application/vnd.ms-excel": "files",
  "application/vnd.ms-powerpoint": "files",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "files",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "files",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "files",
  "application/vnd.oasis.opendocument.text": "files",
  "application/vnd.oasis.opendocument.spreadsheet": "files",
  "application/vnd.oasis.opendocument.presentation": "files",
  "text/plain": "files",
  "text/csv": "files",
  "text/rtf": "files",

  // Code
  "application/javascript": "files",
  "text/javascript": "files",
  "text/typescript": "files",
  "text/x-python": "files",
  "text/x-shellscript": "files",
  "text/x-java": "files",
  "text/x-c++src": "files",
  "text/x-csrc": "files",
  "text/x-ruby": "files",
  "text/x-go": "files",
  "text/x-rust": "files",
  "application/x-php": "files",
  "text/x-perl": "files",

  // Web
  "text/html": "links",
  "application/xhtml+xml": "links",
  "text/css": "files",
  "application/json": "files",
  "application/xml": "files",
  "text/xml": "files",
  "application/yaml": "files",
  "text/markdown": "files",

  // Archives
  "application/zip": "files",
  "application/x-rar-compressed": "files",
  "application/x-7z-compressed": "files",
  "application/x-tar": "files",
  "application/gzip": "files",
  "application/x-bzip2": "files",
  "application/x-xz": "files",

  // Fonts
  "font/ttf": "files",
  "font/otf": "files",
  "font/woff": "files",
  "font/woff2": "files",

  // Software/Executables
  "application/x-msdownload": "software",
  "application/x-msdos-program": "software",
  "application/x-executable": "software",
  "application/x-elf": "software",
  "application/x-deb": "software",
  "application/x-rpm": "software",
  "application/x-android-package-archive": "software",
  "application/x-apple-diskimage": "software",
  "application/x-iso9660-image": "software",
  "application/java-archive": "software"
};

// --------------------------
// Modern Domain Mapping
// --------------------------
const DOMAIN_CATEGORIES: Record<string, LinkCategory> = {
  // Videos
  "youtube.com": "media",
  "youtu.be": "media",
  "vimeo.com": "media",
  "dailymotion.com": "media",
  "twitch.tv": "media",
  "rumble.com": "media",
  "odysee.com": "media",
  "bitchute.com": "media",

  // Audio/Music
  "soundcloud.com": "media",
  "bandcamp.com": "media",
  "spotify.com": "media",
  "music.apple.com": "media",
  "music.youtube.com": "media",
  "tidal.com": "media",
  "deezer.com": "media",

  // Photo/Image Sharing
  "instagram.com": "media",
  "flickr.com": "media",
  "imgur.com": "media",
  "pinterest.com": "media",
  "pixiv.net": "media",
  "deviantart.com": "media",

  // Cloud Storage / Files
  "drive.google.com": "files",
  "dropbox.com": "files",
  "onedrive.live.com": "files",
  "icloud.com": "files",
  "mega.nz": "files",
  "box.com": "files",
  "sync.com": "files",
  "nextcloud": "files",
  "owncloud": "files",
  "seafile": "files",

  // Software / Development
  "github.com": "software",
  "gitlab.com": "software",
  "bitbucket.org": "software",
  "sourceforge.net": "software",
  "codeberg.org": "software",
  "gitea": "software",
  "gogs": "software",
  "npm.js": "software",
  "npmjs.com": "software",
  "pypi.org": "software",
  "crates.io": "software",
  "maven.org": "software",
  "nuget.org": "software"
};

// --------------------------
// Format bytes human readable
// --------------------------
export function formatBytes(bytes: number | null | undefined, decimals = 2): string | null {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return null;
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = Math.max(0, decimals);
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i] as string;
}

// --------------------------
// Categorize URL
// Accepts either a mime string or a hints object as second parameter
// --------------------------
export function categorizeUrl(url: string, hints?: string | CategorizeHints): LinkCategory {
  const lowerUrl = (url || '').toLowerCase().trim();

  const hintObj: CategorizeHints = typeof hints === 'string' ? { mime: hints } : (hints || {});

  // 1️⃣ MIME detection (highest priority - most explicit)
  if (hintObj.mime) {
    const mime = String(hintObj.mime).trim().toLowerCase();

    // Exact match
    if (MIME_CATEGORIES[mime]) return MIME_CATEGORIES[mime];

    // Prefix match (e.g., "image/*")
    const mimePrefix = mime.split('/')[0] || '';
    for (const [key, category] of Object.entries(MIME_CATEGORIES)) {
      if (key.startsWith(mimePrefix + '/')) return category;
    }
  }

  // Special heuristic: if MIME is missing or generic octet-stream
  // and there's no explicit filename hint and the URL path has no
  // filename/extension, assume this is a web link (not a downloadable file).
  // This helps servers that respond with `application/octet-stream` for HTML pages.
  const providedMime = hintObj.mime ? String(hintObj.mime).trim().toLowerCase() : '';
  if ((!providedMime || providedMime === 'application/octet-stream') && !hintObj.filename) {
    try {
      const cleanForMime = String(lowerUrl).split(/[?#]/)[0] || '';
      const lastSeg = cleanForMime.substring(cleanForMime.lastIndexOf('/') + 1);
      // if last segment doesn't contain a dot (no filename.ext), treat as link
      if (!/\.[a-z0-9]+$/i.test(lastSeg)) return 'links';
    } catch { /* ignore errors and continue */ }
  }

  // 2️⃣ Filename extension hint
  if (hintObj.filename) {
    const filename = String(hintObj.filename).toLowerCase();
    const extMatch = filename.match(/\.([a-z0-9]+)$/);
    let ext = extMatch ? extMatch[1] : undefined;
    // validate extension: must not be purely numeric and name before dot must be non-empty
    if (ext) {
      const nameBefore = filename.replace(/\.[a-z0-9]+$/i, '');
      if (nameBefore.length === 0 || /^\d+$/.test(ext)) ext = undefined;
    }
    if (ext) {
      for (const category of ['media', 'files', 'software'] as LinkCategory[]) {
        if (CATEGORY_EXTENSIONS[category].has(ext)) return category;
      }
    }
  }

  // 3️⃣ Domain-based detection
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    for (const [domain, category] of Object.entries(DOMAIN_CATEGORIES)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) return category;
    }
  } catch { /* invalid URLs ignored */ }

  // 4️⃣ Multi-part extensions (tar.gz, tar.bz2, tar.xz) - high confidence
  const clean = String(lowerUrl).split(/[?#]/)[0] || '';
  const multiExtMatch = clean.match(/\.([a-z0-9]+\.[a-z0-9]+)$/);
  if (multiExtMatch) {
    const multiExt = multiExtMatch[1];
    if (multiExt && ["tar.gz","tar.bz2","tar.xz","tar.br"].includes(multiExt)) return 'files';
  }

  // 5️⃣ Single extension from URL (only check actual filename, not path segments)
  const lastSlash = clean.lastIndexOf('/');
  const filenameOnly = lastSlash === -1 ? clean : clean.substring(lastSlash + 1);
  const extMatch2 = filenameOnly.match(/\.([a-z0-9]+)$/);
  let ext = extMatch2 && extMatch2[1] ? extMatch2[1] : undefined;
  // stronger validation: ignore purely numeric extensions and filenames that are just dots or start with '@'
  if (ext) {
    const nameBefore = filenameOnly.replace(/\.[a-z0-9]+$/i, '');
    if (nameBefore.length === 0 || nameBefore.startsWith('@') || /^\d+$/.test(ext)) {
      ext = undefined;
    }
  }
  if (ext) {
    for (const category of ['media', 'files', 'software'] as LinkCategory[]) {
      if (CATEGORY_EXTENSIONS[category].has(ext)) return category;
    }
  }

  // 6️⃣ Suspicious keyword detection
  for (const tag of CATEGORY_EXTENSIONS.suspicious) {
    if (lowerUrl.includes(tag)) return 'suspicious';
  }

  // 7️⃣ Plain URL detection (http/https/www)
  if (/^https?:\/\//.test(lowerUrl) || /^www\./.test(lowerUrl)) return 'links';

  // 8️⃣ Fallback
  return 'misc';
}
