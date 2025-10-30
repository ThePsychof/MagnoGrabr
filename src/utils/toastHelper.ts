import "../styles/tailwind.css";

type ToastType = "success" | "error" | "info";

const defaultConfig: Record<ToastType, { duration: number; className: string }> = {
  success: {
    duration: 2000,
    className:
      "bg-green-600 text-white font-semibold rounded-lg px-4 py-2 shadow-lg flex items-center justify-center gap-2",
  },
  error: {
    duration: 3000,
    className:
      "bg-red-600 text-white font-semibold rounded-lg px-4 py-2 shadow-lg flex items-center justify-center gap-2",
  },
  info: {
    duration: 4000,
    className:
      "bg-yellow-600 text-white font-semibold rounded-lg px-4 py-2 shadow-lg flex items-center justify-center gap-2",
  },
};

// Toast container + stack
let container: HTMLElement | null = null;
let activeToasts: HTMLElement[] = [];
const MAX_TOASTS = 1; // Max Stack limit

function ensureContainer() {
  if (container) return container;
  container = document.createElement("div");
  container.className =
    "fixed top-1 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none";
  document.body.appendChild(container);
  return container;
}

export function showToast(message: string, type: ToastType = "info") {
  const config = defaultConfig[type];
  const toastEl = document.createElement("div");
  toastEl.className =
    config.className + " opacity-0 translate-y-[-10px] transition-all duration-300";
  toastEl.innerHTML = `<span>${message}</span>`;

  const containerEl = ensureContainer();

  // Remove oldest toast if over stack limit
  if (activeToasts.length >= MAX_TOASTS) {
    const oldest = activeToasts.shift();
    if (oldest) {
      oldest.remove();
    }
  }

  activeToasts.push(toastEl);
  containerEl.appendChild(toastEl);

  // entrance animation
  requestAnimationFrame(() => {
    toastEl.classList.remove("opacity-0", "translate-y-[-10px]");
    toastEl.classList.add("opacity-100", "translate-y-0");
  });

  // auto remove
  setTimeout(() => {
    toastEl.classList.add("opacity-0", "translate-y-[-10px]");
    setTimeout(() => {
      toastEl.remove();
      activeToasts = activeToasts.filter((t) => t !== toastEl);
    }, 300);
  }, config.duration);
}