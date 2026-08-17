"use strict";

window.msalRedirectBridge.broadcastResponseToMainFrame().catch(function () {
  document.querySelector("p").textContent = "Sign-in could not be completed. Close this window and try again.";
});