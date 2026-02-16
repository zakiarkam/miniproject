import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window as unknown as Window);

export function sanitizeText(input: string): string {
  if (!input) return "";

  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export function sanitizeHTML(html: string): string {
  if (!html) return "";

  const config = {
    ALLOWED_TAGS: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "span",
      "div",
      "strong",
      "em",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "blockquote",
      "pre",
      "code",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "class",
      "id",
      "width",
      "height",
      "target",
      "rel",
    ],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "textarea",
      "button",
    ],
    FORBID_ATTR: [
      "onerror",
      "onload",
      "onclick",
      "onmouseover",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit",
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    FORCE_BODY: true,
    SANITIZE_DOM: true,
    SANITIZE_NAMED_PROPS: true,
    KEEP_CONTENT: true,
  };

  return DOMPurify.sanitize(html, config) as string;
}

export function sanitizeTemplateHTML(html: string): string {
  if (!html) return "";

  const config = {
    ALLOWED_TAGS: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "span",
      "div",
      "section",
      "article",
      "header",
      "footer",
      "nav",
      "aside",
      "strong",
      "em",
      "u",
      "s",
      "i",
      "b",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "blockquote",
      "pre",
      "code",
      "video",
      "audio",
      "source",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "class",
      "id",
      "style",
      "width",
      "height",
      "target",
      "rel",
      "controls",
      "autoplay",
      "loop",
      "muted",
    ],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "textarea",
      "button",
    ],
    FORBID_ATTR: [
      "onerror",
      "onload",
      "onclick",
      "onmouseover",
      "onfocus",
      "onblur",
      "onchange",
      "onsubmit",
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
  };

  return DOMPurify.sanitize(html, config) as string;
}

/**
 * Validates and sanitizes URL to prevent javascript: and data: protocols
 */
export function sanitizeURL(url: string): string {
  if (!url) return "";

  const trimmedUrl = url.trim();
  const lowerUrl = trimmedUrl.toLowerCase();

  // Block dangerous protocols
  if (
    lowerUrl.startsWith("javascript:") ||
    lowerUrl.startsWith("data:") ||
    lowerUrl.startsWith("vbscript:") ||
    lowerUrl.startsWith("file:")
  ) {
    return "";
  }

  return trimmedUrl;
}

export function validateHTMLUpload(
  html: string,
  allowScripts: boolean = false,
): {
  sanitized: string;
  hasScripts: boolean;
  hasDangerousContent: boolean;
} {
  const hasScripts = /<script[\s\S]*?>[\s\S]*?<\/script>/gi.test(html);
  const hasDangerousContent =
    /on\w+\s*=/gi.test(html) || // Event handlers
    /javascript:/gi.test(html) || // JavaScript protocol
    /<iframe/gi.test(html) || // Iframes
    /<object/gi.test(html) || // Objects
    /<embed/gi.test(html); // Embeds

  let sanitized: string;

  if (allowScripts && !hasDangerousContent) {
    // For approved templates - allow more content but still sanitize
    sanitized = sanitizeTemplateHTML(html);
  } else {
    // For user uploads - strict sanitization
    sanitized = sanitizeHTML(html);
  }

  return {
    sanitized,
    hasScripts,
    hasDangerousContent,
  };
}
