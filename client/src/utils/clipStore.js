// In-memory store to pass recorded broadcast clips & AI Director prompts into Post-Production Studio
let pendingBroadcastClip = null;

export function setPendingClip(clipData) {
  pendingBroadcastClip = clipData;
}

export function getPendingClip() {
  return pendingBroadcastClip;
}

export function clearPendingClip() {
  pendingBroadcastClip = null;
}
