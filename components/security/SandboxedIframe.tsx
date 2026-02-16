"use client";

import React, { useRef, useEffect, useState } from "react";

/**
 * Sandboxed Iframe Component for User-Uploaded HTML
 * R4 Policy - Secure Rendering of Host Pages
 *
 * This component renders user-uploaded HTML in a sandboxed iframe
 * with strict security controls to prevent XSS attacks.
 */

interface SandboxedIframeProps {
  /**
   * The HTML content to render (should already be sanitized on server)
   */
  htmlContent?: string;

  /**
   * URL to S3-hosted HTML page
   */
  srcUrl?: string;

  /**
   * Whether this is a platform-approved template
   * Templates may have slightly relaxed restrictions after security review
   */
  isApprovedTemplate?: boolean;

  /**
   * Additional CSS classes for styling
   */
  className?: string;

  /**
   * Title for accessibility
   */
  title?: string;
}

export default function SandboxedIframe({
  htmlContent,
  srcUrl,
  isApprovedTemplate = false,
  className = "",
  title = "Event host page",
}: SandboxedIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(600);

  useEffect(() => {
    if (htmlContent && iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // Auto-adjust iframe height based on content
        const adjustHeight = () => {
          try {
            const body = iframeDoc.body;
            const html = iframeDoc.documentElement;
            const height = Math.max(
              body?.scrollHeight || 0,
              body?.offsetHeight || 0,
              html?.clientHeight || 0,
              html?.scrollHeight || 0,
              html?.offsetHeight || 0
            );
            setIframeHeight(height + 20); // Add some padding
          } catch (error) {
            // If cross-origin or error, use default height
            console.warn("Unable to adjust iframe height:", error);
          }
        };

        // Adjust height after content loads
        setTimeout(adjustHeight, 100);
        setTimeout(adjustHeight, 500);
        setTimeout(adjustHeight, 1000);

        // Listen for resize events
        if (iframe.contentWindow) {
          iframe.contentWindow.addEventListener("resize", adjustHeight);
        }
      }
    }
  }, [htmlContent]);

  /**
   * Sandbox attribute restricts iframe capabilities
   *
   * For user-uploaded HTML (NOT approved templates):
   * - Block all scripts
   * - Block forms
   * - Block popups
   * - Block top-level navigation
   * - Allow same-origin (for styling only)
   *
   * For approved templates (after security review):
   * - Allow scripts (only for reviewed templates)
   * - Still block popups and top-navigation
   */
  const sandboxValue = isApprovedTemplate
    ? "allow-same-origin allow-scripts" // Only for approved templates
    : "allow-same-origin"; // User uploads: NO SCRIPTS

  if (srcUrl) {
    // Render iframe with external URL
    return (
      <iframe
        ref={iframeRef}
        src={srcUrl}
        sandbox={sandboxValue}
        title={title}
        className={`w-full border-0 ${className}`}
        style={{ height: `${iframeHeight}px`, minHeight: "400px" }}
        loading="lazy"
        // Security attributes
        referrerPolicy="no-referrer"
        allow="none"
      />
    );
  }

  if (htmlContent) {
    // Render iframe with inline content
    // Note: CSP is enforced at the application level via headers in next.config.js
    return (
      <iframe
        ref={iframeRef}
        sandbox={sandboxValue}
        title={title}
        className={`w-full border-0 ${className}`}
        style={{ height: `${iframeHeight}px`, minHeight: "400px" }}
        // Security attributes
        referrerPolicy="no-referrer"
        allow="none"
      />
    );
  }

  return (
    <div className="w-full p-8 text-center text-gray-500 border border-gray-300 rounded">
      No content to display
    </div>
  );
}
