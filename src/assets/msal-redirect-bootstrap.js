"use strict";

function reportFailure(message) {
  document.querySelector("p").textContent = message;
}

// Without this guard a missing/unservable bridge script throws synchronously and
// the popup sits on "Completing sign-in…" forever while loginPopup() never settles.
if (!window.msalRedirectBridge) {
  reportFailure("Sign-in helper failed to load. Close this window and try again.");
} else {
  window.msalRedirectBridge.broadcastResponseToMainFrame().catch(function () {
    reportFailure("Sign-in could not be completed. Close this window and try again.");
  });
}