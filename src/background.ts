import { browserAPI, MessageTypes } from "./utils/browser-api";
import type { GrabbedLink } from "./utils/helpers";

// --- Storage key constant ---
const STORAGE_KEY = "MagnoGrabr_links";

// --- Message types ---
interface Message {
  type: string;
  payload?: any;
  urls?: string[];
}

interface MessageResponse {
  session?: GrabbedLink[];
  started?: boolean;
  error?: string;
}

// --- Typed listener alias ---
type ExtensionMessageListener = (
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: MessageResponse) => void
) => void;

// --- Background listener ---
const backgroundListener: ExtensionMessageListener = (msg, _sender, sendResponse) => {
  (async () => {
    try {
      let response: MessageResponse;

      switch (msg.type) {
        case MessageTypes.GET_SESSION:
          const session = await browserAPI.getGrabbedLinks();
          response = { session };
          break;

        case MessageTypes.DOWNLOAD_URLS:
          const urls = msg.payload?.urls || msg.urls;
          if (!urls || !urls.length) {
            response = { error: "No URLs provided for download" };
            break;
          }
          await Promise.all(
            urls.map((u: string) =>
              browserAPI.downloadFile({ url: u }).catch(() => {
                // Download failed silently
              })
            )
          );
          response = { started: true };
          break;

        default:
          response = { error: `Unknown message type: ${msg.type}`};
      }

      sendResponse(response);
    } catch (err) {
      sendResponse({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  })();

  return true; // Keep the message channel open for async
};

// --- Attach listener ---
browserAPI.addMessageListener(backgroundListener);