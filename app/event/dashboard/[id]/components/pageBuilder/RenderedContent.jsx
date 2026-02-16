import React from "react";
import SandboxedIframe from "@/components/security/SandboxedIframe";

/**
 * Renders user-generated HTML content safely
 * R4 Policy - Secure Rendering of Host Pages
 *
 * IMPORTANT: Content is sanitized on the server before storage.
 * This component renders it in a sandboxed iframe for defense-in-depth.
 */
function RenderedContent({ content, isApprovedTemplate = false }) {
  // Use sandboxed iframe instead of dangerouslySetInnerHTML
  // This provides an additional security layer even after server-side sanitization
  return (
    <SandboxedIframe
      htmlContent={content}
      isApprovedTemplate={isApprovedTemplate}
      title="Event page content"
      className="min-h-screen"
    />
  );
}

export default RenderedContent;
